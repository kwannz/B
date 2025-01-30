package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	pb "tradingbot/go_executor/tradingbot/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"
)

type TradeServer struct {
	pb.UnimplementedTradeServiceServer
	mu               sync.RWMutex
	activeOrders     map[string]*pb.TradeReply
	priceSubscribers map[string][]pb.TradeService_SubscribePriceUpdatesServer
	orderBatch       []*pb.TradeRequest
	batchTimer       *time.Timer
	redisClient      *redis.Client
	retryCount       int
	circuitOpen      bool
	lastError        time.Time
	errorCount       int
}

func NewTradeServer() *TradeServer {
	s := &TradeServer{
		activeOrders:     make(map[string]*pb.TradeReply),
		priceSubscribers: make(map[string][]pb.TradeService_SubscribePriceUpdatesServer),
		orderBatch:       make([]*pb.TradeRequest, 0),
		redisClient: redis.NewClient(&redis.Options{
			Addr: "localhost:6379",
			DB:   0,
		}),
		retryCount:  3,
		circuitOpen: false,
		errorCount:  0,
	}
	s.startBatchProcessor()
	return s
}

func (s *TradeServer) startBatchProcessor() {
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		for range ticker.C {
			s.processBatch()
		}
	}()
}

func (s *TradeServer) processBatch() {
	s.mu.Lock()
	if len(s.orderBatch) == 0 {
		s.mu.Unlock()
		return
	}

	batch := s.orderBatch
	s.orderBatch = make([]*pb.TradeRequest, 0)
	s.mu.Unlock()

	for _, order := range batch {
		orderId := s.executeOrder(order)
		if trade, exists := s.activeOrders[orderId]; exists {
			trade.Status = "executed"
		}
	}
}

func (s *TradeServer) executeOrder(order *pb.TradeRequest) string {
	orderId := fmt.Sprintf("order_%d", time.Now().UnixNano())
	log.Printf("[executeOrder] Processing order: id=%s symbol=%s side=%s amount=%.2f price=%.2f",
		orderId, order.Symbol, order.Side, order.Amount, order.Price)
	trade := &pb.TradeReply{
		OrderId:        orderId,
		Status:         "executed",
		ExecutedPrice:  order.Price,
		ExecutedAmount: order.Amount,
		Timestamp:      time.Now().Unix(),
	}

	s.mu.Lock()
	s.activeOrders[orderId] = trade
	s.mu.Unlock()
	
	return orderId
}

func (s *TradeServer) GetMarketData(ctx context.Context, req *pb.MarketDataRequest) (*pb.MarketDataReply, error) {
	if s.circuitOpen {
		if time.Since(s.lastError) < 30*time.Second {
			return nil, fmt.Errorf("circuit breaker open")
		}
		s.circuitOpen = false
		s.errorCount = 0
	}

	cacheKey := fmt.Sprintf("market_data:%s:%s:%d", req.Symbol, req.Timeframe, req.Limit)
	if cached, err := s.redisClient.Get(ctx, cacheKey).Result(); err == nil {
		var candles []*pb.Candle
		if err := json.Unmarshal([]byte(cached), &candles); err == nil {
			return &pb.MarketDataReply{Candles: candles}, nil
		}
	}

	candles := make([]*pb.Candle, 0)
	candle := &pb.Candle{
		Open:      100.0,
		High:      101.0,
		Low:       99.0,
		Close:     100.5,
		Volume:    1000.0,
		Timestamp: time.Now().Unix(),
	}
	candles = append(candles, candle)

	if data, err := json.Marshal(candles); err == nil {
		s.redisClient.Set(ctx, cacheKey, string(data), 5*time.Second)
	}

	return &pb.MarketDataReply{Candles: candles}, nil
}

func (s *TradeServer) ExecuteTrade(ctx context.Context, req *pb.TradeRequest) (*pb.TradeReply, error) {
	log.Printf("[ExecuteTrade] Request: symbol=%s side=%s amount=%.2f price=%.2f", req.Symbol, req.Side, req.Amount, req.Price)
	
	if s.circuitOpen {
		if time.Since(s.lastError) < 30*time.Second {
			log.Printf("[ExecuteTrade] Circuit breaker open, request rejected")
			return nil, fmt.Errorf("circuit breaker open")
		}
		log.Printf("[ExecuteTrade] Circuit breaker reset")
		s.circuitOpen = false
		s.errorCount = 0
	}

	orderId := s.executeOrder(req)
	result := s.activeOrders[orderId]
	log.Printf("[ExecuteTrade] Order executed: id=%s status=%s executed_price=%.2f executed_amount=%.2f", 
		orderId, result.Status, result.ExecutedPrice, result.ExecutedAmount)
	return result, nil
}

func (s *TradeServer) GetOrderStatus(ctx context.Context, req *pb.OrderStatusRequest) (*pb.OrderStatusReply, error) {
	s.mu.RLock()
	trade, exists := s.activeOrders[req.OrderId]
	s.mu.RUnlock()

	if !exists {
		return &pb.OrderStatusReply{
			OrderId: req.OrderId,
			Status:  "not_found",
		}, nil
	}

	return &pb.OrderStatusReply{
		OrderId:      trade.OrderId,
		Status:       trade.Status,
		FilledAmount: trade.ExecutedAmount,
		AveragePrice: trade.ExecutedPrice,
	}, nil
}

func (s *TradeServer) MonitorOrderStatus(req *pb.OrderStatusRequest, stream pb.TradeService_MonitorOrderStatusServer) error {
	log.Printf("[MonitorOrderStatus] Starting monitoring for order_id=%s", req.OrderId)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.RLock()
		trade, exists := s.activeOrders[req.OrderId]
		s.mu.RUnlock()

		status := &pb.OrderStatusResponse{
			OrderId:          req.OrderId,
			Status:          "not_found",
			FilledAmount:    0,
			RemainingAmount: 0,
			AveragePrice:    0,
		}

		if exists {
			status.Status = trade.Status
			status.FilledAmount = trade.ExecutedAmount
			status.AveragePrice = trade.ExecutedPrice
			status.RemainingAmount = 0
		}

		if err := stream.Send(status); err != nil {
			return err
		}

		if status.Status == "executed" || status.Status == "cancelled" {
			return nil
		}
	}
	return nil
}

func (s *TradeServer) BatchExecuteTrades(ctx context.Context, req *pb.BatchTradeRequest) (*pb.BatchTradeResponse, error) {
	log.Printf("[BatchExecuteTrades] Processing batch of %d trades, atomic=%v", len(req.Trades), req.Atomic)
	if s.circuitOpen {
		if time.Since(s.lastError) < 30*time.Second {
			return nil, fmt.Errorf("circuit breaker open")
		}
		s.circuitOpen = false
		s.errorCount = 0
	}

	results := make([]*pb.TradeResponse, 0, len(req.Trades))
	success := true
	var lastError string

	for _, trade := range req.Trades {
		orderId := s.executeOrder(trade)
		if result, exists := s.activeOrders[orderId]; exists {
			results = append(results, &pb.TradeResponse{
				OrderId:         orderId,
				Status:         result.Status,
				ExecutedPrice:  result.ExecutedPrice,
				ExecutedAmount: result.ExecutedAmount,
			})
		} else {
			success = false
			lastError = fmt.Sprintf("failed to execute trade for symbol %s", trade.Symbol)
			if req.Atomic {
				return &pb.BatchTradeResponse{
					Success: false,
					Error:   lastError,
				}, nil
			}
		}
	}

	response := &pb.BatchTradeResponse{
		Results: results,
		Success: success,
		Error:   lastError,
	}
	log.Printf("[BatchExecuteTrades] Batch completed: success=%v error=%s results=%d", 
		response.Success, response.Error, len(response.Results))
	return response, nil
}

func (s *TradeServer) SubscribePriceUpdates(req *pb.PriceSubscriptionRequest, stream pb.TradeService_SubscribePriceUpdatesServer) error {
	for _, symbol := range req.Symbols {
		s.mu.Lock()
		s.priceSubscribers[symbol] = append(s.priceSubscribers[symbol], stream)
		s.mu.Unlock()
	}

	ticker := time.NewTicker(time.Duration(req.UpdateIntervalMs) * time.Millisecond)
	for range ticker.C {
		for _, symbol := range req.Symbols {
			update := &pb.PriceUpdateReply{
				Symbol:    symbol,
				Price:     100.0,
				Volume:    1000.0,
				Timestamp: time.Now().Unix(),
				Bid:      99.9,
				Ask:      100.1,
			}
			if err := stream.Send(update); err != nil {
				return err
			}
		}
	}
	return nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	server := grpc.NewServer(
		grpc.MaxConcurrentStreams(1000),
		grpc.MaxRecvMsgSize(4 * 1024 * 1024),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 5 * time.Minute,
			Time:             20 * time.Second,
			Timeout:          1 * time.Second,
		}),
	)
	pb.RegisterTradeServiceServer(server, NewTradeServer())

	log.Printf("Starting gRPC server on :50051")
	if err := server.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
