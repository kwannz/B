package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/monitoring"
	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type SolanaTransaction struct {
	Signature  string  `json:"signature"`
	BlockTime  int64   `json:"blockTime"`
	Status     string  `json:"status"`
	Fee        float64 `json:"fee"`
	Slot      int64   `json:"slot"`
}

func main() {
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	apiKey := os.Getenv("PUMP_API_KEY")
	if apiKey == "" {
		logger.Fatal("PUMP_API_KEY environment variable not set")
	}

	pumpMetrics := metrics.NewPumpMetrics()
	monitorService := monitoring.NewMonitorService(logger, pumpMetrics)

	if err := monitorService.Start(ctx); err != nil {
		logger.Fatal("Failed to start monitor service", zap.Error(err))
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Monitor Solana account transactions
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(time.Second * 30)
		defer ticker.Stop()

		checkSolanaAccount := func() {
			url := "https://public-api.solscan.io/account/AJuZ3Es8cJBaVeRkfPWxZq8q1KPaZgtdacPWUH1F8XM5/transactions"
			resp, err := http.Get(url)
			if err != nil {
				logger.Error("Failed to fetch Solana transactions", zap.Error(err))
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				logger.Error("Non-200 response from Solscan", zap.Int("status", resp.StatusCode))
				return
			}

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				logger.Error("Failed to read response body", zap.Error(err))
				return
			}

			var txs []SolanaTransaction
			if err := json.Unmarshal(body, &txs); err != nil {
				logger.Error("Failed to parse transactions", zap.Error(err))
				return
			}

			for _, tx := range txs {
				if time.Now().Unix()-tx.BlockTime < 3600 {
					logger.Info("Recent transaction detected",
						zap.String("signature", tx.Signature),
						zap.Int64("block_time", tx.BlockTime),
						zap.String("status", tx.Status),
						zap.Float64("fee", tx.Fee))
					
					metrics.SolanaTransactions.WithLabelValues("transfer").Inc()
					metrics.SolanaTransactionFees.WithLabelValues("transfer").Set(tx.Fee)
				}
			}
		}

		checkSolanaAccount()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				checkSolanaAccount()
			}
		}
	}()

	pumpProvider := pump.NewProvider(pump.Config{
		APIKey:       apiKey,
		TimeoutSec:   30,
		BaseURL:      "https://frontend-api.pump.fun",
		WebSocketURL: "wss://frontend-api.pump.fun/ws",
	}, logger)

	if err := pumpProvider.Connect(ctx); err != nil {
		logger.Fatal("Failed to connect to pump.fun", zap.Error(err))
	}
	defer pumpProvider.Close()

	updates := make(chan *types.TokenUpdate, 100)
	go func() {
		for update := range pumpProvider.GetTokenUpdates() {
			select {
			case updates <- update:
			default:
				logger.Warn("Update channel full, dropping update")
			}
		}
	}()

	go func() {
		for update := range updates {
			monitorService.OnTokenUpdate(update)

			if update.MarketCap.LessThan(decimal.NewFromFloat(30000)) {
				logger.Info("New low cap token detected",
					zap.String("symbol", update.Symbol),
					zap.Float64("market_cap", update.MarketCap.InexactFloat64()))
			}

			if update.Volume.GreaterThan(decimal.NewFromFloat(1000)) {
				logger.Info("High volume token detected",
					zap.String("symbol", update.Symbol),
					zap.Float64("volume", update.Volume.InexactFloat64()))
			}
		}
	}()

	// Monitor pump.fun trading activity
	go func() {
		defer wg.Done()

		pumpProvider := pump.NewProvider(pump.Config{
			APIKey:       apiKey,
			TimeoutSec:   30,
			BaseURL:      "https://frontend-api.pump.fun",
			WebSocketURL: "wss://frontend-api.pump.fun/ws",
		}, logger)

		if err := pumpProvider.Connect(ctx); err != nil {
			logger.Fatal("Failed to connect to pump.fun", zap.Error(err))
		}
		defer pumpProvider.Close()

		pingTicker := time.NewTicker(time.Second * 30)
		defer pingTicker.Stop()

		updates := make(chan *types.TokenUpdate, 100)
		trades := make(chan *types.Trade, 100)

		// Keep connection alive with periodic pings
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case <-pingTicker.C:
					if err := pumpProvider.Ping(); err != nil {
						logger.Error("WebSocket ping failed", zap.Error(err))
						if err := pumpProvider.Reconnect(ctx); err != nil {
							logger.Error("WebSocket reconnection failed", zap.Error(err))
						}
					}
				}
			}
		}()

		// Process token updates
		go func() {
			for update := range pumpProvider.GetTokenUpdates() {
				select {
				case updates <- update:
				default:
					logger.Warn("Update channel full, dropping update")
				}
			}
		}()

		// Monitor token updates and trading activity
		go func() {
			for update := range updates {
				monitorService.OnTokenUpdate(update)

			marketCap := decimal.NewFromFloat(update.MarketCap)
			if marketCap.LessThan(decimal.NewFromFloat(30000)) {
				logger.Info("New low cap token detected",
					zap.String("symbol", update.Symbol),
					zap.Float64("market_cap", update.MarketCap))
				metrics.NewTokensTotal.Inc()
			}

			volume := decimal.NewFromFloat(update.Volume)
			if volume.GreaterThan(decimal.NewFromFloat(1000)) {
				logger.Info("High volume token detected",
					zap.String("symbol", update.Symbol),
					zap.Float64("volume", update.Volume))
				metrics.TradingVolume.Add(update.Volume)
			}

			// Monitor significant price changes
			if update.PriceChange24h > 20.0 || update.PriceChange24h < -20.0 {
				logger.Info("Significant price change detected",
					zap.String("symbol", update.Symbol),
					zap.Float64("price_change_24h", update.PriceChange24h))
				metrics.SignificantPriceChanges.Inc()
			}

			// Update token metrics
			metrics.TokenPrice.WithLabelValues("pump_fun", update.Symbol).Set(update.Price)
			metrics.TokenVolume.WithLabelValues("pump_fun", update.Symbol).Set(update.Volume)
			metrics.TokenMarketCap.WithLabelValues("pump_fun", update.Symbol).Set(update.MarketCap)
			metrics.TokenPriceChangeDay.WithLabelValues("pump_fun", update.Symbol).Set(update.PriceChange24h)
			metrics.LastUpdateTimestamp.Set(float64(time.Now().Unix()))

				if update.PriceChange.Hour > 20.0 {
					logger.Info("Significant price increase detected",
						zap.String("symbol", update.Symbol),
						zap.Float64("hour_change", update.PriceChange.Hour))
					metrics.SignificantPriceChanges.Inc()
				}
			}
		}()

		// Monitor trades
		go func() {
			for trade := range trades {
				monitorService.OnTrade(trade)
				logger.Info("Trade executed",
					zap.String("symbol", trade.Symbol),
					zap.Float64("size", trade.Size.InexactFloat64()),
					zap.Float64("price", trade.Price.InexactFloat64()))
				
				metrics.TradeExecutions.Inc()
				metrics.TradingVolume.Add(trade.Size.InexactFloat64() * trade.Price.InexactFloat64())
			}
		}()

		select {
		case <-ctx.Done():
			return
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	logger.Info("Starting monitoring verification",
		zap.Bool("websocket_connected", true),
		zap.String("provider", "pump.fun"))

	metrics.MonitoringServiceStatus.Set(1)

	statusTicker := time.NewTicker(time.Second * 5)
	defer statusTicker.Stop()

	logger.Info("Starting monitoring verification",
		zap.Bool("websocket_connected", true),
		zap.String("provider", "pump.fun"))

	for {
		select {
		case <-sigChan:
			logger.Info("Shutting down monitoring verification")
			cancel()
			wg.Wait()
			return
		case <-statusTicker.C:
			tokens := monitorService.GetTokens()
			positions := monitorService.GetPositions()

			logger.Info("Monitoring status",
				zap.Int("active_tokens", len(tokens)),
				zap.Int("active_positions", len(positions)))

			for symbol, pos := range positions {
				logger.Info("Position status",
					zap.String("symbol", symbol),
					zap.Float64("size", pos.Size.InexactFloat64()),
					zap.Float64("pnl", pos.UnrealizedPnL.InexactFloat64()))
				
				// Update position metrics
				metrics.PositionSize.WithLabelValues(symbol).Set(pos.Size.InexactFloat64())
				metrics.UnrealizedPnL.WithLabelValues(symbol).Set(pos.UnrealizedPnL.InexactFloat64())
				metrics.RiskExposure.WithLabelValues(symbol).Set(pos.Size.Mul(decimal.NewFromFloat(update.Price)).InexactFloat64())
			}

			// Verify strategy independence
			metrics.ActiveTokens.Set(float64(len(tokens)))
			metrics.ActivePositions.Set(float64(len(positions)))
			metrics.LastUpdateTimestamp.Set(float64(time.Now().Unix()))

			// Monitor WebSocket connection health
			if err := pumpProvider.Ping(); err != nil {
				logger.Error("WebSocket connection health check failed", zap.Error(err))
				metrics.WebsocketConnections.Set(0)
				if err := pumpProvider.Reconnect(ctx); err != nil {
					logger.Error("WebSocket reconnection failed", zap.Error(err))
				} else {
					metrics.WebsocketConnections.Set(1)
				}
			} else {
				metrics.WebsocketConnections.Set(1)
			}

			// Monitor strategy isolation
			for _, pos := range positions {
				if pos.Strategy == "pump_fun" {
					logger.Info("Pump.fun strategy position",
						zap.String("symbol", pos.Symbol),
						zap.Float64("size", pos.Size.InexactFloat64()),
						zap.Float64("pnl", pos.UnrealizedPnL.InexactFloat64()))
					metrics.StrategyPnL.WithLabelValues("pump_fun").Set(pos.UnrealizedPnL.InexactFloat64())
				}
			}

			// Verify core strategy is unaffected
			for _, pos := range positions {
				if pos.Strategy != "pump_fun" {
					logger.Info("Core strategy position",
						zap.String("symbol", pos.Symbol),
						zap.String("strategy", pos.Strategy),
						zap.Float64("size", pos.Size.InexactFloat64()),
						zap.Float64("pnl", pos.UnrealizedPnL.InexactFloat64()))
					metrics.StrategyPnL.WithLabelValues(pos.Strategy).Set(pos.UnrealizedPnL.InexactFloat64())
				}
			}
			metrics.LastUpdateTimestamp.SetToCurrentTime()
		}
	}
}
