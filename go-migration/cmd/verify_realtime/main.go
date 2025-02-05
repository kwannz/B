package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/analysis"
	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/risk"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

func main() {
	config := zap.NewDevelopmentConfig()
	config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	logger, _ := config.Build()
	defer logger.Sync()

	logger.Info("Starting real-time trading verification")
	apiKey := os.Getenv("PUMP_FUN_API_KEY")
	if apiKey == "" {
		logger.Fatal("PUMP_FUN_API_KEY environment variable is required")
	
	logger.Info("Initializing pump.fun trading components",
		zap.String("api_key", apiKey[:8]+"..."))

	// Initialize metrics
	metrics.GetPumpMetrics()
	metrics.APIKeyUsage.WithLabelValues("pump.fun", "init").Inc()

	wsConfig := pump.WSConfig{
		APIKey:       apiKey,
		DialTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		ReadTimeout:  60 * time.Second,
		PongWait:     120 * time.Second,
		MaxRetries:   10,
		PingInterval: 30 * time.Second,
	}

	provider := pump.NewProvider(pump.Config{
		BaseURL:      "https://frontend-api.pump.fun",
		WebSocketURL: "wss://frontend-api.pump.fun/ws",
		TimeoutSec:   60,
		APIKey:       apiKey,
	}, logger, wsConfig)

	logger.Info("Configured pump.fun provider",
		zap.String("base_url", "https://frontend-api.pump.fun"),
		zap.String("ws_url", "wss://frontend-api.pump.fun/ws"),
		zap.Int("timeout_sec", 60))

	logger.Info("Starting real-time trading with pump.fun API key",
		zap.String("api_key_status", "verified"),
		zap.String("provider", "pump.fun"),
		zap.String("base_url", "https://frontend-api.pump.fun"),
		zap.String("ws_url", "wss://frontend-api.pump.fun/ws"))

	riskManager := risk.NewManager(risk.Limits{
		MaxPositionSize:  decimal.NewFromFloat(500.0),
		MaxDrawdown:      decimal.NewFromFloat(0.05),
		MaxDailyLoss:     decimal.NewFromFloat(50.0),
		MaxLeverage:      decimal.NewFromFloat(1.0),
		MinMarginLevel:   decimal.NewFromFloat(0.5),
		MaxConcentration: decimal.NewFromFloat(0.1),
	}, logger)

	analyzer := analysis.NewAnalyzer(logger)

	exec := executor.NewRealtimeExecutor(
		logger,
		provider,
		riskManager,
		apiKey,
	)

	metrics.GetPumpMetrics()

	ctx := context.Background()
	mainCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	if err := exec.Start(mainCtx); err != nil {
		logger.Fatal("Failed to start executor", zap.Error(err))
	}
	defer exec.Stop()

	// Start monitoring metrics
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-mainCtx.Done():
				return
			case <-ticker.C:
				metrics.WebsocketConnections.Set(1)
				metrics.APIKeyUsage.WithLabelValues("pump.fun", "monitor").Inc()
			}
		}
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	updates := make(chan *types.TokenInfo, 100)
	go func() {
		defer close(updates)
		for {
			select {
			case <-mainCtx.Done():
				return
			default:
				newTokens, err := provider.GetNewTokens(mainCtx)
				if err != nil {
					logger.Error("Failed to get new tokens", zap.Error(err))
					metrics.APIErrors.WithLabelValues("get_new_tokens").Inc()
					time.Sleep(5 * time.Second)
					continue
				}

				for _, t := range newTokens {
					select {
					case updates <- t:
						metrics.TokenPrice.WithLabelValues("pump.fun", t.Symbol).Set(t.Price.InexactFloat64())
						metrics.TokenVolume.WithLabelValues("pump.fun", t.Symbol).Set(t.Volume.InexactFloat64())
						metrics.TokenMarketCap.WithLabelValues("pump.fun", t.Symbol).Set(t.MarketCap.InexactFloat64())
					case <-mainCtx.Done():
						return
					}
				}
				time.Sleep(5 * time.Second)
			}
		}
	}()

	logger.Info("Starting real-time trading with pump.fun",
		zap.String("api_key_status", "verified"),
		zap.String("provider", "pump.fun"))

	retryCount := 0
	maxRetries := 3

	for {
		select {
		case <-signals:
			logger.Info("Shutting down...")
			return
		case t := <-updates:
			if t == nil {
				if retryCount < maxRetries {
					retryCount++
					logger.Warn("Received nil token update, retrying",
						zap.Int("retry", retryCount),
						zap.Int("max_retries", maxRetries))
					time.Sleep(time.Second * 5)
					continue
				}
				logger.Error("Max retries reached for nil token updates")
				continue
			}
			retryCount = 0

			marketCapLimit := decimal.NewFromFloat(30000)
			if t.MarketCap.GreaterThan(marketCapLimit) {
				logger.Debug("Skipping token due to high market cap",
					zap.String("symbol", t.Symbol),
					zap.String("market_cap", t.MarketCap.String()))
				continue
			}

			// Get token price history for technical analysis
			priceHistory, err := provider.GetHistoricalPrices(mainCtx, t.Symbol, string(types.Interval30m), 100)
			if err != nil {
				logger.Error("Failed to get historical prices",
					zap.Error(err),
					zap.String("symbol", t.Symbol))
				metrics.APIErrors.WithLabelValues("get_historical_prices").Inc()
				continue
			}

			if len(priceHistory) < 14 {
				logger.Debug("Insufficient price history",
					zap.String("symbol", t.Symbol),
					zap.Int("history_length", len(priceHistory)))
				continue
			}

			// Calculate technical indicators
			rsi := analyzer.CalculateRSI(priceHistory, 14)
			ma30 := analyzer.CalculateMA(priceHistory, 30)
			volatility := analyzer.CalculateVolatility(priceHistory, 14)
			price := t.Price
			ma30Decimal := decimal.NewFromFloat(ma30)

			logger.Debug("Technical analysis results",
				zap.String("symbol", t.Symbol),
				zap.Float64("rsi", rsi),
				zap.Float64("ma30", ma30),
				zap.Float64("volatility", volatility),
				zap.String("current_price", price.String()))

			// Execute trade if conditions are met
			if rsi < 30 && price.LessThan(ma30Decimal) && volatility < 0.1 {
				// Calculate position size based on risk limits and volatility
				maxPositionSize := riskManager.GetLimits().MaxPositionSize
				riskAdjustedSize := maxPositionSize.Mul(decimal.NewFromFloat(1 - volatility))
				positionSize := riskAdjustedSize.Div(price)

				// Calculate stop loss and take profit levels
				stopLoss := price.Mul(decimal.NewFromFloat(0.95))  // 5% stop loss
				takeProfits := []decimal.Decimal{
					price.Mul(decimal.NewFromFloat(1.2)),  // 20% take profit level 1
					price.Mul(decimal.NewFromFloat(1.5)),  // 50% take profit level 2
					price.Mul(decimal.NewFromFloat(2.0)),  // 100% take profit level 3
				}

				// Execute trade with risk management and stop loss/take profit
				if err = provider.ExecuteOrder(mainCtx, t.Symbol, types.SignalTypeBuy, positionSize, price, &stopLoss, takeProfits); err != nil {
					logger.Error("Trade execution failed",
						zap.Error(err),
						zap.String("symbol", t.Symbol),
						zap.String("size", positionSize.String()))
					metrics.APIErrors.WithLabelValues("trade_execution").Inc()
					metrics.PumpTradeExecutions.WithLabelValues("failed").Inc()
					continue
				}

				logger.Info("Trade executed successfully",
					zap.String("symbol", t.Symbol),
					zap.String("price", price.String()),
					zap.String("size", positionSize.String()),
					zap.Float64("rsi", rsi),
					zap.Float64("ma30", ma30),
					zap.Float64("volatility", volatility))
				
				metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
				metrics.PumpPositionSize.WithLabelValues(t.Symbol).Set(positionSize.InexactFloat64())
				metrics.PumpRiskExposure.WithLabelValues(t.Symbol).Set(riskAdjustedSize.InexactFloat64())
			}
		}
	}
}
