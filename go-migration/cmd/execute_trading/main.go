package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/monitoring"
	"github.com/kwanRoshi/B/go-migration/internal/risk"
	"github.com/kwanRoshi/B/go-migration/internal/trading"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/trading/strategy"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

func main() {
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	apiKey := os.Getenv("PUMP_API_KEY")
	if apiKey == "" {
		logger.Fatal("PUMP_API_KEY environment variable not set")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	wsConfig := types.WSConfig{
		ReconnectTimeout: time.Second * 5,
		PingInterval:     time.Second * 15,
		WriteTimeout:     time.Second * 10,
		ReadTimeout:      time.Second * 60,
		PongWait:        time.Second * 60,
		MaxRetries:      5,
	}

	pumpProvider := pump.NewProvider(pump.Config{
		APIKey:       apiKey,
		TimeoutSec:   30,
		BaseURL:      "https://frontend-api.pump.fun",
		WebSocketURL: "wss://frontend-api.pump.fun/ws",
	}, logger)

	monitor := monitoring.NewPumpMonitor(logger, pumpProvider)
	if err := monitor.Start(ctx); err != nil {
		logger.Fatal("Failed to start pump monitor", zap.Error(err))
	}

	riskLimits := risk.Limits{
		MaxPositionSize:  decimal.NewFromFloat(1000.0),
		MaxDrawdown:      decimal.NewFromFloat(0.15),
		MaxDailyLoss:     decimal.NewFromFloat(500.0),
		MaxLeverage:      decimal.NewFromFloat(1.0),
		MinMarginLevel:   decimal.NewFromFloat(1.5),
		MaxConcentration: decimal.NewFromFloat(0.2),
	}
	riskMgr := risk.NewManager(riskLimits, logger)

	pumpConfig := &types.PumpTradingConfig{
		MaxMarketCap: decimal.NewFromFloat(30000.0),
		MinVolume:    decimal.NewFromFloat(1000.0),
		WebSocket:    wsConfig,
		Risk: struct {
			MaxPositionSize   decimal.Decimal   `yaml:"max_position_size"`
			MinPositionSize   decimal.Decimal   `yaml:"min_position_size"`
			StopLossPercent   decimal.Decimal   `yaml:"stop_loss_percent"`
			TakeProfitLevels  []decimal.Decimal `yaml:"take_profit_levels"`
		}{
			MaxPositionSize:  decimal.NewFromFloat(1000.0),
			MinPositionSize:  decimal.NewFromFloat(100.0),
			StopLossPercent:  decimal.NewFromFloat(15.0),
			TakeProfitLevels: []decimal.Decimal{
				decimal.NewFromFloat(2.0),
				decimal.NewFromFloat(3.0),
				decimal.NewFromFloat(5.0),
			},
		},
	}

	engine := trading.NewEngine(logger, riskMgr)
	pumpExecutor := executor.NewPumpExecutor(logger, pumpProvider, riskMgr, pumpConfig, apiKey)
	if err := pumpExecutor.Start(); err != nil {
		logger.Fatal("Failed to start pump executor", zap.Error(err))
	}
	defer pumpExecutor.Stop()

	pumpStrategy := strategy.NewPumpStrategy(pumpConfig, pumpExecutor, logger)
	if err := pumpStrategy.Init(ctx); err != nil {
		logger.Fatal("Failed to initialize pump strategy", zap.Error(err))
	}

	engine.RegisterStrategy("pump_fun", pumpStrategy)

	updates := monitor.GetUpdates()
	signals := make(chan *types.Signal, 100)

	go func() {
		for update := range updates {
			signal := pumpStrategy.ProcessUpdate(update)
			if signal != nil {
				select {
				case signals <- signal:
				default:
					logger.Warn("Signal channel full, dropping signal",
						zap.String("symbol", signal.Symbol))
				}
			}
		}
	}()

	go func() {
		for signal := range signals {
			if err := engine.ExecuteStrategyTrade(ctx, pumpStrategy, signal); err != nil {
				logger.Error("Failed to execute trade",
					zap.Error(err),
					zap.String("symbol", signal.Symbol))
			}
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	logger.Info("Starting trading execution with pump.fun API key",
		zap.Bool("api_key_configured", true),
		zap.String("provider", "pump.fun"))
	metrics.PumpTradeExecutions.WithLabelValues("start").Inc()

	<-sigChan
	logger.Info("Shutting down trading system")
	cancel()
}
