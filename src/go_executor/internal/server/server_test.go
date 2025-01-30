package server

import (
    "context"
    "testing"
    pb "github.com/kwanRoshi/tradingbot/src/go_executor/pb"
)

func TestNewTradingServer(t *testing.T) {
    s := NewTradingServer()
    if s == nil {
        t.Fatal("NewTradingServer() returned nil")
    }
    if s.orderBook == nil {
        t.Error("orderBook is nil")
    }
    if s.marketData == nil {
        t.Error("marketData is nil")
    }
    if s.orderManager == nil {
        t.Error("orderManager is nil")
    }
    if s.rateLimiter == nil {
        t.Error("rateLimiter is nil")
    }
}

func TestExecuteTrade(t *testing.T) {
    s := NewTradingServer()
    ctx := context.Background()
    
    req := &pb.TradeRequest{
        Symbol: "SOL/USDC",
        Side: "buy",
        Amount: 1.0,
        Price: 100.0,
        OrderType: "limit",
    }
    
    resp, err := s.ExecuteTrade(ctx, req)
    if err != nil {
        t.Fatalf("ExecuteTrade() error = %v", err)
    }
    if resp == nil {
        t.Fatal("ExecuteTrade() returned nil response")
    }
    if resp.OrderId == "" {
        t.Error("OrderId is empty")
    }
}

func TestBatchExecuteTrades(t *testing.T) {
    s := NewTradingServer()
    ctx := context.Background()
    
    req := &pb.BatchTradeRequest{
        Trades: []*pb.TradeRequest{
            {
                Symbol: "SOL/USDC",
                Side: "buy",
                Amount: 1.0,
                Price: 100.0,
                OrderType: "limit",
            },
            {
                Symbol: "SOL/USDC",
                Side: "sell",
                Amount: 0.5,
                Price: 101.0,
                OrderType: "limit",
            },
        },
        Atomic: true,
    }
    
    resp, err := s.BatchExecuteTrades(ctx, req)
    if err != nil {
        t.Fatalf("BatchExecuteTrades() error = %v", err)
    }
    if resp == nil {
        t.Fatal("BatchExecuteTrades() returned nil response")
    }
    if len(resp.Results) != len(req.Trades) {
        t.Errorf("Expected %d results, got %d", len(req.Trades), len(resp.Results))
    }
    for i, result := range resp.Results {
        if result == nil {
            t.Errorf("Result at index %d is nil", i)
            continue
        }
        if result.Status == "failed" {
            t.Errorf("Trade at index %d failed: %s", i, result.Error)
        }
    }
    if !resp.Success {
        t.Error("BatchExecuteTrades() failed")
    }
}
