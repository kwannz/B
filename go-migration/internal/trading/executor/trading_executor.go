package executor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"


	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/trading/strategy"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradingExecutor struct {
	provider          *pump.Provider
	earlyEntry        *strategy.EarlyEntryStrategy
	batchTrading      *strategy.BatchTradingStrategy
	riskManagement    *strategy.RiskManagementStrategy
	logger            *zap.Logger
	positions         map[string]*types.Position
	mu               sync.RWMutex
	apiKey           string
}

func NewTradingExecutor(
	config *strategy.TradingConfig,
	provider *pump.Provider,
	metrics *metrics.PumpMetrics,
	logger *zap.Logger,
) *TradingExecutor {
	logger = logger.With(
		zap.String("provider", "pump.fun"),
		zap.String("strategy", "early_entry_batch"),
		zap.String("version", "isolated"),
	)

	executor := &TradingExecutor{
		provider:       provider,
		earlyEntry: strategy.NewEarlyEntryStrategy(&strategy.EarlyEntryConfig{
			MaxMarketCap:    decimal.NewFromInt(30000),
			VolumeThreshold: decimal.NewFromInt(1000),
			MinLiquidity:    decimal.NewFromInt(5000),
		}, provider, logger),
		batchTrading: strategy.NewBatchTradingStrategy(&strategy.BatchTradingConfig{
			Stages: []struct {
				TargetMultiple decimal.Decimal `yaml:"target_multiple"`
				Percentage     decimal.Decimal `yaml:"percentage"`
			}{
				{TargetMultiple: decimal.NewFromInt(2), Percentage: decimal.NewFromFloat(0.20)},
				{TargetMultiple: decimal.NewFromInt(3), Percentage: decimal.NewFromFloat(0.25)},
				{TargetMultiple: decimal.NewFromInt(5), Percentage: decimal.NewFromFloat(0.20)},
			},
		}, logger),
		riskManagement: strategy.NewRiskManagementStrategy(&strategy.RiskManagementConfig{
			PositionSizing: strategy.PositionSizingConfig{
				MaxPositionSize: decimal.NewFromFloat(0.02),
				MinPositionSize: decimal.NewFromFloat(0.01),
			},
			StopLoss: strategy.StopLossConfig{
				Initial:  decimal.NewFromFloat(0.05),
				Trailing: decimal.NewFromFloat(0.03),
			},
			TakeProfitLevels: []decimal.Decimal{
				decimal.NewFromInt(2),
				decimal.NewFromInt(3),
				decimal.NewFromInt(5),
			},
		}, logger),
		logger:        logger,
		positions:     make(map[string]*types.Position),
		apiKey:        "2zYNtr7JxRkppBS4mWkCUAok8cmyMZqSsLt92kvyAUFseij2ubShVqzkhy8mWcG8J2rSjMNiGcFrtAXAr7Mp3QZ1",
	}
	return executor
}

func (e *TradingExecutor) verifyAPIKey() error {
	if e.apiKey == "" {
		metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
		return fmt.Errorf("invalid API key")
	}

	metrics.TokenVolume.WithLabelValues("pump.fun", "api_key_verified").Set(1)
	return nil
}

func (e *TradingExecutor) Start(ctx context.Context) error {
	if err := e.verifyAPIKey(); err != nil {
		return fmt.Errorf("failed to verify API key: %w", err)
	}

	// Initialize provider-specific metrics
	metrics.TokenVolume.WithLabelValues("pump.fun", "max_position_size").Set(0.02)
	metrics.TokenVolume.WithLabelValues("pump.fun", "min_position_size").Set(0.01)
	metrics.TokenVolume.WithLabelValues("pump.fun", "initial_stop_loss").Set(0.05)
	metrics.TokenVolume.WithLabelValues("pump.fun", "trailing_stop_loss").Set(0.03)

	e.logger.Info("Starting trading executor with API key",
		zap.Int("key_length", len(e.apiKey)),
		zap.String("provider", "pump.fun"),
		zap.String("strategy", "early_entry_batch"),
		zap.String("version", "isolated"),
		zap.Bool("api_key_verified", true))

	// Subscribe to new token updates
	tokenUpdates, err := e.provider.SubscribeNewTokens(ctx)
	if err != nil {
		return fmt.Errorf("failed to subscribe to new tokens: %w", err)
	}

	e.logger.Info("Successfully subscribed to new token updates",
		zap.String("websocket_url", "wss://pumpportal.fun/api/data"))

	// Start monitoring and trading routines
	go e.monitorNewTokens(ctx, tokenUpdates)
	go e.updatePositions(ctx)
	go e.monitorMetrics(ctx)

	e.logger.Info("Trading system started successfully",
		zap.String("mode", "automated"),
		zap.String("strategy", "early_entry_batch"))

	return nil
}

func (e *TradingExecutor) monitorNewTokens(ctx context.Context, updates <-chan *types.TokenInfo) {
	for {
		select {
		case <-ctx.Done():
			return
		case token := <-updates:
			qualify, err := e.earlyEntry.Evaluate(ctx, token)
			if err != nil {
				e.logger.Error("Failed to evaluate token",
					zap.String("symbol", token.Symbol),
					zap.Error(err))
				continue
			}

			if qualify {
				if err := e.enterPosition(ctx, token); err != nil {
					e.logger.Error("Failed to enter position",
						zap.String("symbol", token.Symbol),
						zap.Error(err))
				}
			}
		}
	}
}

func (e *TradingExecutor) enterPosition(ctx context.Context, token *types.TokenInfo) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Verify API key before entering position
	if err := e.verifyAPIKey(); err != nil {
		metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
		return fmt.Errorf("API key verification failed: %w", err)
	}

	// Check if we already have a position
	if _, exists := e.positions[token.Symbol]; exists {
		return fmt.Errorf("position already exists for %s", token.Symbol)
	}

	// Evaluate token using early entry strategy
	qualify, err := e.earlyEntry.Evaluate(ctx, token)
	if err != nil {
		return fmt.Errorf("failed to evaluate token: %w", err)
	}

	if !qualify {
		e.logger.Info("Token does not qualify for early entry",
			zap.String("symbol", token.Symbol),
			zap.String("market_cap", token.MarketCap.String()),
			zap.String("volume", token.Volume.String()))
		return nil
	}

	// Get bonding curve information
	curve, err := e.provider.GetBondingCurve(ctx, token.Symbol)
	if err != nil {
		return fmt.Errorf("failed to get bonding curve: %w", err)
	}

	// Calculate position size based on risk management
	portfolioValue := decimal.NewFromInt(1000000) // Fixed portfolio value for testing
	maxRiskPerTrade := decimal.NewFromFloat(0.02) // 2% max risk per trade
	size := e.riskManagement.CalculatePositionSize(portfolioValue.Mul(maxRiskPerTrade), curve.CurrentPrice)

	// Validate position size against bonding curve liquidity
	if size.GreaterThan(curve.MaxBuySize) {
		size = curve.MaxBuySize.Mul(decimal.NewFromFloat(0.95)) // 95% of max buy size to account for slippage
	}

	position := &types.Position{
		Symbol:       token.Symbol,
		EntryPrice:   curve.CurrentPrice,
		CurrentPrice: curve.CurrentPrice,
		Size:         size,
		UpdatedAt:    time.Now(),
	}

	// Execute trade with slippage protection
	// Execute trade with stop loss and take profit levels
	stopLoss := curve.CurrentPrice.Mul(decimal.NewFromFloat(0.85))  // 15% stop loss
	takeProfits := []decimal.Decimal{
		curve.CurrentPrice.Mul(decimal.NewFromFloat(2.0)),  // 2x take profit
		curve.CurrentPrice.Mul(decimal.NewFromFloat(3.0)),  // 3x take profit
		curve.CurrentPrice.Mul(decimal.NewFromFloat(5.0)),  // 5x take profit
	}

	if err := e.provider.ExecuteOrder(ctx, token.Symbol, types.SignalTypeBuy, size, curve.CurrentPrice, &stopLoss, takeProfits); err != nil {
		metrics.APIErrors.WithLabelValues("trade_execution").Inc()
		return fmt.Errorf("failed to execute trade: %w", err)
	}

	e.positions[token.Symbol] = position
	e.logger.Info("Entered new position",
		zap.String("symbol", token.Symbol),
		zap.String("price", curve.CurrentPrice.String()),
		zap.String("size", size.String()),
		zap.String("market_cap", token.MarketCap.String()),
		zap.String("max_buy_size", curve.MaxBuySize.String()),
		zap.String("provider", "pump.fun"))

	// Record metrics with provider label
	metrics.TokenPrice.WithLabelValues("pump.fun", token.Symbol).Set(curve.CurrentPrice.InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", token.Symbol).Set(size.InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", token.Symbol+"_position").Set(1)

	return nil
}

func (e *TradingExecutor) updatePositions(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.mu.RLock()
			positions := make([]*types.Position, 0, len(e.positions))
			for _, pos := range e.positions {
				positions = append(positions, pos)
			}
			e.mu.RUnlock()

			for _, pos := range positions {
				if err := e.updatePosition(ctx, pos); err != nil {
					e.logger.Error("Failed to update position",
						zap.String("symbol", pos.Symbol),
						zap.Error(err))
				}
			}
		}
	}
}

func (e *TradingExecutor) updatePosition(ctx context.Context, position *types.Position) error {
	curve, err := e.provider.GetBondingCurve(ctx, position.Symbol)
	if err != nil {
		return fmt.Errorf("failed to get bonding curve: %w", err)
	}

	position.CurrentPrice = curve.CurrentPrice
	position.UpdatedAt = time.Now()

	// Calculate current profit multiple
	profitMultiple := position.CurrentPrice.Div(position.EntryPrice)

	// Check stop loss
	shouldExit, err := e.riskManagement.CheckStopLoss(ctx, position)
	if err != nil {
		return fmt.Errorf("failed to check stop loss: %w", err)
	}

	if shouldExit {
		if err := e.exitPosition(ctx, position, "stop_loss"); err != nil {
			return fmt.Errorf("failed to exit position: %w", err)
		}
		return nil
	}

	// Check profit targets for batch selling
	if profitMultiple.GreaterThanOrEqual(decimal.NewFromInt(5)) && position.Size.GreaterThan(decimal.Zero) {
		sellSize := position.Size.Mul(decimal.NewFromFloat(0.20)) // Sell 20% at 5x
		if err := e.executeSell(ctx, position, sellSize, "take_profit_5x"); err != nil {
			return fmt.Errorf("failed to execute 5x profit take: %w", err)
		}
	} else if profitMultiple.GreaterThanOrEqual(decimal.NewFromInt(3)) && position.Size.GreaterThan(decimal.Zero) {
		sellSize := position.Size.Mul(decimal.NewFromFloat(0.25)) // Sell 25% at 3x
		if err := e.executeSell(ctx, position, sellSize, "take_profit_3x"); err != nil {
			return fmt.Errorf("failed to execute 3x profit take: %w", err)
		}
	} else if profitMultiple.GreaterThanOrEqual(decimal.NewFromInt(2)) && position.Size.GreaterThan(decimal.Zero) {
		sellSize := position.Size.Mul(decimal.NewFromFloat(0.20)) // Sell 20% at 2x
		if err := e.executeSell(ctx, position, sellSize, "take_profit_2x"); err != nil {
			return fmt.Errorf("failed to execute 2x profit take: %w", err)
		}
	}

	// Update metrics
	metrics.TokenPrice.WithLabelValues("pump.fun", position.Symbol).Set(position.CurrentPrice.InexactFloat64())
	unrealizedPnL := position.CurrentPrice.Sub(position.EntryPrice).Mul(position.Size)
	metrics.TokenVolume.WithLabelValues("pump.fun", position.Symbol+"_pnl").Set(unrealizedPnL.InexactFloat64())

	return nil
}

func (e *TradingExecutor) executeSell(ctx context.Context, position *types.Position, size decimal.Decimal, reason string) error {
	if err := e.provider.ExecuteOrder(ctx, position.Symbol, types.SignalTypeSell, size, position.CurrentPrice, &position.StopLoss, position.TakeProfit); err != nil {
		return fmt.Errorf("failed to execute sell trade: %w", err)
	}

	position.Size = position.Size.Sub(size)
	realizedPnL := position.CurrentPrice.Sub(position.EntryPrice).Mul(size)

	e.logger.Info("Executed partial sell",
		zap.String("symbol", position.Symbol),
		zap.String("reason", reason),
		zap.String("size", size.String()),
		zap.String("price", position.CurrentPrice.String()),
		zap.String("realized_pnl", realizedPnL.String()))

	// Record metrics
	metrics.TokenPrice.WithLabelValues(position.Symbol).Set(position.CurrentPrice.InexactFloat64())
	metrics.TokenVolume.WithLabelValues(position.Symbol).Set(size.InexactFloat64())
	metrics.TokenVolume.WithLabelValues(position.Symbol + "_pnl").Set(realizedPnL.InexactFloat64())

	return nil
}

func (e *TradingExecutor) exitPosition(ctx context.Context, position *types.Position, reason string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Verify API key before exiting position
	if err := e.verifyAPIKey(); err != nil {
		metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
		return fmt.Errorf("API key verification failed: %w", err)
	}

	// Execute sell trade with slippage protection
	// Execute sell with existing stop loss and take profit levels
	if err := e.provider.ExecuteOrder(ctx, position.Symbol, types.SignalTypeSell, position.Size, position.CurrentPrice, &position.StopLoss, position.TakeProfit); err != nil {
		metrics.APIErrors.WithLabelValues("trade_execution").Inc()
		return fmt.Errorf("failed to execute exit trade: %w", err)
	}

	pnl := position.CurrentPrice.Sub(position.EntryPrice).Mul(position.Size)
	delete(e.positions, position.Symbol)

	e.logger.Info("Exited position",
		zap.String("symbol", position.Symbol),
		zap.String("reason", reason),
		zap.String("entry_price", position.EntryPrice.String()),
		zap.String("exit_price", position.CurrentPrice.String()),
		zap.String("size", position.Size.String()),
		zap.String("pnl", pnl.String()),
		zap.String("provider", "pump.fun"))

	// Record metrics with provider label
	metrics.TokenPrice.WithLabelValues("pump.fun", position.Symbol).Set(0)
	metrics.TokenVolume.WithLabelValues("pump.fun", position.Symbol).Set(0)
	metrics.TokenVolume.WithLabelValues("pump.fun", position.Symbol+"_position").Set(0)
	metrics.TokenVolume.WithLabelValues("pump.fun", position.Symbol+"_pnl").Set(pnl.InexactFloat64())

	return nil
}

func (e *TradingExecutor) monitorMetrics(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Verify API key periodically
			if err := e.verifyAPIKey(); err != nil {
				metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
				e.logger.Error("API key verification failed during metrics update",
					zap.Error(err))
				continue
			}

			e.mu.RLock()
			positions := make([]*types.Position, 0, len(e.positions))
			for _, pos := range e.positions {
				positions = append(positions, pos)
			}
			e.mu.RUnlock()

			totalPnL := decimal.Zero
			totalPositionValue := decimal.Zero

			for _, pos := range positions {
				// Update position metrics with provider label
				metrics.TokenPrice.WithLabelValues("pump.fun", pos.Symbol).Set(pos.CurrentPrice.InexactFloat64())
				metrics.TokenVolume.WithLabelValues("pump.fun", pos.Symbol).Set(pos.Size.InexactFloat64())
				
				// Calculate and record unrealized PnL
				unrealizedPnL := pos.CurrentPrice.Sub(pos.EntryPrice).Mul(pos.Size)
				metrics.TokenVolume.WithLabelValues("pump.fun", pos.Symbol+"_pnl").Set(unrealizedPnL.InexactFloat64())

				totalPnL = totalPnL.Add(unrealizedPnL)
				totalPositionValue = totalPositionValue.Add(pos.Size.Mul(pos.CurrentPrice))
			}

			// Record aggregated metrics
			metrics.TokenVolume.WithLabelValues("pump.fun", "total_position_value").Set(totalPositionValue.InexactFloat64())
			metrics.TokenVolume.WithLabelValues("pump.fun", "total_unrealized_pnl").Set(totalPnL.InexactFloat64())

			e.logger.Info("Trading metrics update",
				zap.Int("active_positions", len(positions)),
				zap.String("total_position_value", totalPositionValue.String()),
				zap.String("total_unrealized_pnl", totalPnL.String()),
				zap.String("provider", "pump.fun"))
		}
	}
}
