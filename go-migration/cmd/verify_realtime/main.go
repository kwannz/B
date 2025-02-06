package main

import (
    "context"
    "os"
    "time"

    "github.com/shopspring/decimal"
    "go.uber.org/zap"

    "github.com/kwanRoshi/B/go-migration/internal/market/pump"
    "github.com/kwanRoshi/B/go-migration/internal/metrics"
    "github.com/kwanRoshi/B/go-migration/internal/risk"
    "github.com/kwanRoshi/B/go-migration/internal/trading/executor"
    "github.com/kwanRoshi/B/go-migration/internal/types"
)

func main() {
    logger, _ := zap.NewDevelopment()
    defer logger.Sync()

    ctx := context.Background()

    logger.Info("Starting real-time trading verification")

    // Initialize pump.fun provider
    pumpConfig := pump.Config{
        BaseURL:      "https://frontend-api.pump.fun",
        WebSocketURL: "wss://frontend-api.pump.fun/ws",
        TimeoutSec:   60,
    }

    provider := pump.NewProvider(pumpConfig, logger)

    // Initialize risk manager
    limits := risk.Limits{
        MaxPositionSize:  1000.0,
        MaxDrawdown:      0.1,
        MaxDailyLoss:     100.0,
        MaxLeverage:      1.0,
        MinMarginLevel:   1.5,
        MaxConcentration: 0.2,
    }
    riskManager := risk.NewManager(limits, logger)

    // Initialize trading config
    tradingConfig := &types.PumpTradingConfig{
        StopLossPercent:   15.0,
        TakeProfitLevels: []float64{2.0, 3.0, 5.0},
        BatchSizes:       []float64{0.2, 0.25, 0.2},
    }

    // Initialize executor with API key
    apiKey := os.Getenv("PUMP_FUN_API_KEY")
    if apiKey == "" {
        logger.Fatal("PUMP_FUN_API_KEY environment variable is required")
    }

    executor := executor.NewPumpExecutor(logger, provider, riskManager, tradingConfig, apiKey)
    if err := executor.Start(); err != nil {
        logger.Fatal("Failed to start executor", zap.Error(err))
    }
    defer executor.Stop()

    // Create test trade signal
    signal := &types.Signal{
        Symbol:    "TEST/SOL",
        Type:      types.SignalTypeBuy,
        Amount:    decimal.NewFromFloat(1.0),
        Price:     decimal.NewFromFloat(100.0),
        Provider:  "pump.fun",
        Timestamp: time.Now(),
    }

    // Execute test trade
    if err := executor.ExecuteTrade(ctx, signal); err != nil {
        logger.Error("Failed to execute trade", zap.Error(err))
        return
    }

    logger.Info("Test trade executed successfully")

    // Keep running to maintain WebSocket connection
    select {
    case <-ctx.Done():
        return
    case <-time.After(time.Minute * 5):
        return
    }
}
