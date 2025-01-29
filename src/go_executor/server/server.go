package server

import (
    "context"
    "sync"
    pb "tradingbot/protos"
    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
)

type TradingServer struct {
    pb.UnimplementedTradingExecutorServer
    orderBook     *OrderBook
    marketData    *MarketDataManager
    orderManager  *OrderManager
    rateLimiter   *RateLimiter
    mu            sync.RWMutex
}

func NewTradingServer() *TradingServer {
    return &TradingServer{
        orderBook:    NewOrderBook(),
        marketData:   NewMarketDataManager(),
        orderManager: NewOrderManager(),
        rateLimiter:  NewRateLimiter(),
    }
}

func (s *TradingServer) ExecuteTrade(ctx context.Context, req *pb.TradeRequest) (*pb.TradeResponse, error) {
    if err := s.rateLimiter.Allow(); err != nil {
        return nil, status.Error(codes.ResourceExhausted, "rate limit exceeded")
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    order := &Order{
        Symbol:     req.Symbol,
        Side:       req.Side,
        Amount:     req.Amount,
        Price:      req.Price,
        OrderType:  req.OrderType,
        Parameters: req.Params,
    }

    result, err := s.orderManager.ExecuteOrder(ctx, order)
    if err != nil {
        return nil, status.Error(codes.Internal, err.Error())
    }

    return &pb.TradeResponse{
        OrderId:        result.OrderID,
        Status:         result.Status,
        ExecutedPrice:  result.ExecutedPrice,
        ExecutedAmount: result.ExecutedAmount,
        Fee:           result.Fee,
        Metadata:      result.Metadata,
    }, nil
}

func (s *TradingServer) GetMarketData(req *pb.MarketDataRequest, stream pb.TradingExecutor_GetMarketDataServer) error {
    dataChan := make(chan *MarketData)
    errChan := make(chan error)

    go s.marketData.StreamData(req.Symbol, req.DataType, req.Depth, dataChan, errChan)

    for {
        select {
        case data := <-dataChan:
            resp := &pb.MarketDataResponse{
                Symbol:    data.Symbol,
                Price:     data.Price,
                Volume:    data.Volume,
                Bid:      data.Bid,
                Ask:      data.Ask,
                Timestamp: data.Timestamp,
            }
            if err := stream.Send(resp); err != nil {
                return status.Error(codes.Internal, err.Error())
            }
        case err := <-errChan:
            return status.Error(codes.Internal, err.Error())
        case <-stream.Context().Done():
            return nil
        }
    }
}

func (s *TradingServer) BatchExecuteTrades(ctx context.Context, req *pb.BatchTradeRequest) (*pb.BatchTradeResponse, error) {
    if err := s.rateLimiter.AllowBatch(len(req.Trades)); err != nil {
        return nil, status.Error(codes.ResourceExhausted, "batch rate limit exceeded")
    }

    s.mu.Lock()
    defer s.mu.Unlock()

    results := make([]*pb.TradeResponse, 0, len(req.Trades))
    var failed bool

    for _, trade := range req.Trades {
        result, err := s.ExecuteTrade(ctx, trade)
        if err != nil {
            if req.Atomic {
                return &pb.BatchTradeResponse{
                    Success: false,
                    Error:   err.Error(),
                }, nil
            }
            failed = true
        }
        results = append(results, result)
    }

    return &pb.BatchTradeResponse{
        Results: results,
        Success: !failed,
    }, nil
}
