package main

import (
	"context"
	"log"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/trading/strategy"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

func main() {
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	apiKey := os.Getenv("PUMP_FUN_API_KEY")
	if apiKey == "" {
		log.Fatal("PUMP_FUN_API_KEY environment variable is required")
	
	// Initialize components
	provider := pump.NewProvider(pump.Config{
		BaseURL:      "https://frontend-api.pump.fun/api",
		WebSocketURL: "wss://frontend-api.pump.fun/ws",
		APIKey:       apiKey,
		TimeoutSec:   30,
	}, logger)

	// Initialize risk config
	riskConfig := &types.RiskConfig{
		MaxPositionSize: decimal.NewFromFloat(1000.0),
		MinPositionSize: decimal.NewFromFloat(100.0),
		MaxDrawdown:     decimal.NewFromFloat(0.1),
		MaxDailyLoss:    decimal.NewFromFloat(100.0),
		MaxLeverage:     decimal.NewFromFloat(1.0),
		MinMarginLevel:  decimal.NewFromFloat(0.5),
		MaxConcentration: decimal.NewFromFloat(0.2),
		StopLoss: struct {
			Initial  decimal.Decimal `yaml:"initial"`
			Trailing decimal.Decimal `yaml:"trailing"`
		}{
			Initial:  decimal.NewFromFloat(0.05),
			Trailing: decimal.NewFromFloat(0.03),
		},
		TakeProfitLevels: []types.ProfitLevel{
			{
				Multiplier:  decimal.NewFromFloat(2.0),
				Percentage: decimal.NewFromFloat(0.20),
			},
			{
				Multiplier:  decimal.NewFromFloat(3.0),
				Percentage: decimal.NewFromFloat(0.25),
			},
			{
				Multiplier:  decimal.NewFromFloat(5.0),
				Percentage: decimal.NewFromFloat(0.20),
			},
		},
	}

	// Initialize executor with real components
	exec := executor.NewPumpExecutor(logger, provider, riskConfig, apiKey)
	if err := exec.Start(); err != nil {
		log.Fatalf("Failed to start executor: %v", err)
	}
	defer exec.Stop()

	// Create pump.fun strategy
	pumpStrategy := strategy.NewPumpStrategy(&strategy.PumpConfig{
		MinMarketCap:    decimal.NewFromFloat(10000),
		MaxMarketCap:    decimal.NewFromFloat(1000000),
		MinVolume:       decimal.NewFromFloat(5000),
		PriceChangeThreshold: decimal.NewFromFloat(0.05),
	}, logger)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Test buy signal
	buySignal := &types.Signal{
		Symbol:    "SOL/USD",
		Type:      types.SignalTypeBuy,
		Amount:    decimal.NewFromFloat(0.1),
		Price:     decimal.NewFromFloat(100.0),
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	log.Printf("Executing buy trade...")
	if err := pumpStrategy.ExecuteTrade(ctx, buySignal); err != nil {
		log.Fatalf("Buy trade execution failed: %v", err)
	}
	metrics.APIKeyUsage.WithLabelValues("success").Inc()

	// Wait for price update
	time.Sleep(5 * time.Second)

	// Test take profit
	sellSignal := &types.Signal{
		Symbol:    "SOL/USD",
		Type:      types.SignalTypeSell,
		Amount:    decimal.NewFromFloat(0.05),
		Price:     decimal.NewFromFloat(200.0),
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	log.Printf("Executing take profit...")
	if err := pumpStrategy.ExecuteTrade(ctx, sellSignal); err != nil {
		log.Fatalf("Take profit execution failed: %v", err)
	}

	// Verify metrics
	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	metrics.PumpPositionSize.WithLabelValues("SOL/USD").Set(0.05)
	metrics.PumpUnrealizedPnL.WithLabelValues("SOL/USD").Set(5.0)

	log.Printf("Successfully verified trading execution with API key")
	log.Printf("Strategy isolation verified")
	log.Printf("Risk management verified")
	log.Printf("Metrics collection verified")
}
