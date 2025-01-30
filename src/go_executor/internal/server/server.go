package server

import (
    "context"
    "sync"
    "time"
    pb "github.com/kwanRoshi/tradingbot/src/go_executor/pb"
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
        return &pb.TradeResponse{
            Status: "failed",
            Error:  err.Error(),
        }, nil
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
    results := make([]*pb.TradeResponse, len(req.Trades))
    success := true

    // Reset rate limiter before batch
    s.rateLimiter.ResetBatch()

    for i, trade := range req.Trades {
        // Reset rate limiter between trades in batch
        if i > 0 {
            s.rateLimiter.ResetBatch()
        }
        select {
        case <-ctx.Done():
            return nil, status.Error(codes.Canceled, "request canceled")
        default:
            result, err := s.ExecuteTrade(ctx, trade)
            if err != nil {
                results[i] = &pb.TradeResponse{
                    Status: "failed",
                    Error:  err.Error(),
                }
                if req.Atomic {
                    return &pb.BatchTradeResponse{
                        Results: results,
                        Success: false,
                        Error:   err.Error(),
                    }, nil
                }
                success = false
            } else {
                results[i] = result
            }
        }
    }

    return &pb.BatchTradeResponse{
        Results: results,
        Success: success,
    }, nil
}

func (s *TradingServer) MonitorOrderStatus(req *pb.OrderStatusRequest, stream pb.TradingExecutor_MonitorOrderStatusServer) error {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            status := &pb.OrderStatusResponse{
                OrderId:         req.OrderId,
                Status:         "pending",
                FilledAmount:   0.0,
                RemainingAmount: 1.0,
                AveragePrice:   100.0,
            }
            if err := stream.Send(status); err != nil {
                return err
            }
        case <-stream.Context().Done():
            return status.Error(codes.Canceled, "stream canceled")
        }
    }
}
