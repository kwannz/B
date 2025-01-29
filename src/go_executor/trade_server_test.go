package main

import (
	"context"
	"testing"
	"time"

	pb "tradingbot/go_executor/tradingbot/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestTradeServer(t *testing.T) {
	conn, err := grpc.Dial("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewTradeServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	t.Run("GetMarketData", func(t *testing.T) {
		req := &pb.MarketDataRequest{
			Symbol:    "SOL/USDC",
			Timeframe: "1m",
			Limit:     100,
		}
		resp, err := client.GetMarketData(ctx, req)
		if err != nil {
			t.Fatalf("GetMarketData failed: %v", err)
		}
		if len(resp.Candles) == 0 {
			t.Error("Expected non-empty candles")
		}
	})

	t.Run("ExecuteTrade", func(t *testing.T) {
		req := &pb.TradeRequest{
			Symbol:    "SOL/USDC",
			Side:      "buy",
			Amount:    1.0,
			Price:     100.0,
			OrderType: "market",
		}
		resp, err := client.ExecuteTrade(ctx, req)
		if err != nil {
			t.Fatalf("ExecuteTrade failed: %v", err)
		}
		if resp.OrderId == "" {
			t.Error("Expected non-empty order ID")
		}
	})

	t.Run("GetOrderStatus", func(t *testing.T) {
		tradeReq := &pb.TradeRequest{
			Symbol:    "SOL/USDC",
			Side:      "buy",
			Amount:    1.0,
			Price:     100.0,
			OrderType: "market",
		}
		tradeResp, err := client.ExecuteTrade(ctx, tradeReq)
		if err != nil {
			t.Fatalf("ExecuteTrade failed: %v", err)
		}

		statusReq := &pb.OrderStatusRequest{
			OrderId: tradeResp.OrderId,
		}
		statusResp, err := client.GetOrderStatus(ctx, statusReq)
		if err != nil {
			t.Fatalf("GetOrderStatus failed: %v", err)
		}
		if statusResp.Status == "" {
			t.Error("Expected non-empty status")
		}
	})

	t.Run("CircuitBreaker", func(t *testing.T) {
		server := NewTradeServer()
		server.circuitOpen = true
		server.lastError = time.Now()

		req := &pb.MarketDataRequest{
			Symbol:    "SOL/USDC",
			Timeframe: "1m",
			Limit:     100,
		}
		_, err := server.GetMarketData(context.Background(), req)
		if err == nil || err.Error() != "circuit breaker open" {
			t.Error("Expected circuit breaker error")
		}
	})

	t.Run("BatchProcessing", func(t *testing.T) {
		server := NewTradeServer()
		req := &pb.TradeRequest{
			Symbol:    "SOL/USDC",
			Side:      "buy",
			Amount:    1.0,
			Price:     100.0,
			OrderType: "market",
		}

		resp, err := server.ExecuteTrade(context.Background(), req)
		if err != nil {
			t.Fatalf("ExecuteTrade failed: %v", err)
		}

		time.Sleep(200 * time.Millisecond)
		statusReq := &pb.OrderStatusRequest{
			OrderId: resp.OrderId,
		}
		statusResp, err := server.GetOrderStatus(context.Background(), statusReq)
		if err != nil {
			t.Fatalf("GetOrderStatus failed: %v", err)
		}
		if statusResp.Status != "executed" {
			t.Errorf("Expected status 'executed', got %s", statusResp.Status)
		}
	})
}
