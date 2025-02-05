package executor

import (
	"context"
	"fmt"
	"sync"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
)

var (
	TokenVolume = metrics.TokenVolume
	PumpPositionSize = metrics.PumpPositionSize
	PumpRiskLimits = metrics.PumpRiskLimits
	PumpTradeExecutions = metrics.PumpTradeExecutions
)

type PumpExecutor struct {
	logger     *zap.Logger
	provider   *pump.Provider
	riskMgr    types.RiskManager
	config     *types.PumpTradingConfig
	mu         sync.RWMutex
	positions  map[string]*types.Position
	apiKey     string
	isRunning  bool
}

func NewPumpExecutor(logger *zap.Logger, provider *pump.Provider, riskMgr types.RiskManager, config *types.PumpTradingConfig, apiKey string) *PumpExecutor {
	return &PumpExecutor{
		logger:    logger,
		provider:  provider,
		riskMgr:   riskMgr,
		positions: make(map[string]*types.Position),
		apiKey:    apiKey,
		config:    config,
	}
}

func (e *PumpExecutor) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("executor not running")
	}

	// Verify API key
	if e.apiKey == "" {
		metrics.APIErrors.WithLabelValues("api_key_missing").Inc()
		return fmt.Errorf("API key not configured")
	}

	// Validate position against risk limits
	if err := e.riskMgr.ValidatePosition(signal.Symbol, signal.Amount); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("risk_rejected").Inc()
		metrics.APIErrors.WithLabelValues("risk_validation").Inc()
		e.logger.Error("risk validation failed",
			zap.Error(err),
			zap.String("symbol", signal.Symbol),
			zap.String("size", signal.Amount.String()))
		return fmt.Errorf("risk validation failed: %w", err)
	}
	
	// Record risk metrics
	metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_position_size", signal.Symbol)).Set(signal.Amount.InexactFloat64())
	metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_price", signal.Symbol)).Set(signal.Price.InexactFloat64())

	// Execute trade through provider
	// Configure trading parameters
	stopLossPrice := signal.Price.Mul(decimal.NewFromFloat(0.85))
	e.riskMgr.UpdateStopLoss(signal.Symbol, stopLossPrice)

	// Calculate stop loss and take profit levels
	stopLoss := signal.Price.Mul(decimal.NewFromFloat(0.85))  // 15% stop loss
	takeProfits := []decimal.Decimal{
		signal.Price.Mul(decimal.NewFromFloat(2.0)),  // 2x take profit
		signal.Price.Mul(decimal.NewFromFloat(3.0)),  // 3x take profit
		signal.Price.Mul(decimal.NewFromFloat(5.0)),  // 5x take profit
	}

	if err := e.provider.ExecuteOrder(ctx, signal.Symbol, signal.Type, signal.Amount, signal.Price, &stopLoss, takeProfits); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("failed").Inc()
		metrics.APIErrors.WithLabelValues("trade_execution").Inc()
		e.logger.Error("trade execution failed",
			zap.Error(err),
			zap.String("symbol", signal.Symbol),
			zap.String("size", signal.Amount.String()),
			zap.String("price", signal.Price.String()))
		return fmt.Errorf("trade execution failed: %w", err)
	}
	
	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	// Get or create position
	position, exists := e.positions[signal.Symbol]
	if !exists {
		position = types.NewPosition(signal.Symbol, decimal.Zero, signal.Price)
		e.positions[signal.Symbol] = position
	}

	TokenVolume.WithLabelValues("pump.fun", signal.Symbol).Add(signal.Amount.InexactFloat64())
	PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size.InexactFloat64())
	
	e.logger.Info("trade executed successfully",
		zap.String("symbol", signal.Symbol),
		zap.String("size", signal.Amount.String()),
		zap.String("price", signal.Price.String()),
		zap.String("position_size", position.Size.String()),
		zap.String("unrealized_pnl", position.CurrentPrice.Sub(position.EntryPrice).Mul(position.Size).String()))

	// Position already created/updated above

	// Update position based on signal type
	if signal.Type == types.SignalTypeBuy {
		oldSize := position.Size
		position.Size = position.Size.Add(signal.Amount)
		position.EntryPrice = position.EntryPrice.Mul(oldSize).Add(signal.Price.Mul(signal.Amount)).Div(position.Size)
	} else {
		position.Size = position.Size.Sub(signal.Amount)
		if position.Size.LessThanOrEqual(decimal.Zero) {
			delete(e.positions, signal.Symbol)
		}
	}

	// Record position metrics
	metrics.PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size.InexactFloat64())
	metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol)).Set(position.EntryPrice.InexactFloat64())
	
	// Calculate and record PnL
	unrealizedPnL := signal.Price.Sub(position.EntryPrice).Mul(position.Size)
	metrics.PumpUnrealizedPnL.WithLabelValues(signal.Symbol).Set(unrealizedPnL.InexactFloat64())
	
	// Record trade metrics
	PumpTradeExecutions.WithLabelValues(string(signal.Type)).Inc()
	TokenVolume.WithLabelValues("pump.fun", signal.Symbol).Add(signal.Amount.Mul(signal.Price).InexactFloat64())
	
	// Record risk metrics
	if signal.Type == types.SignalTypeBuy {
		PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", signal.Symbol)).Set(signal.Price.Mul(decimal.NewFromFloat(0.85)).InexactFloat64())
		PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_take_profit_2x", signal.Symbol)).Set(signal.Price.Mul(decimal.NewFromInt(2)).InexactFloat64())
		PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_take_profit_3x", signal.Symbol)).Set(signal.Price.Mul(decimal.NewFromInt(3)).InexactFloat64())
		PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_take_profit_5x", signal.Symbol)).Set(signal.Price.Mul(decimal.NewFromInt(5)).InexactFloat64())
		
		// Log entry for monitoring
		e.logger.Info("new position opened",
			zap.String("symbol", signal.Symbol),
			zap.String("entry_price", signal.Price.String()),
			zap.String("size", signal.Amount.String()),
			zap.String("api_key_status", "verified"),
			zap.String("stop_loss", signal.Price.Mul(decimal.NewFromFloat(0.85)).String()),
			zap.String("take_profit_2x", signal.Price.Mul(decimal.NewFromInt(2)).String()),
			zap.String("take_profit_3x", signal.Price.Mul(decimal.NewFromInt(3)).String()),
			zap.String("take_profit_5x", signal.Price.Mul(decimal.NewFromInt(5)).String()),
			zap.String("strategy", "pump_fun"),
			zap.String("timeframe", "30m"),
			zap.Float64("max_slippage", 0.03))
		
		// Verify API key and trading status
		if err := e.verifyAPIKey(); err != nil {
			metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
			return fmt.Errorf("API key verification failed: %w", err)
		}
		
		// Record successful trade execution
		metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	}

	PumpTradeExecutions.WithLabelValues("success").Inc()
	TokenVolume.WithLabelValues("pump.fun", signal.Symbol).Add(signal.Amount.InexactFloat64())
	PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size.InexactFloat64())

	return nil
}

func (e *PumpExecutor) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.isRunning {
		return fmt.Errorf("executor already running")
	}

	// Verify API key on startup
	if e.apiKey == "" {
		metrics.APIErrors.WithLabelValues("api_key_missing").Inc()
		return fmt.Errorf("API key not configured")
	}

	e.isRunning = true
	e.logger.Info("pump.fun executor started",
		zap.Bool("api_key_configured", true),
		zap.String("provider", "pump.fun"))
	return nil
}

func (e *PumpExecutor) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("executor not running")
	}

	e.isRunning = false
	return nil
}

func (e *PumpExecutor) GetPosition(symbol string) *types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.positions[symbol]
}

func (e *PumpExecutor) GetPositions() map[string]*types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	positions := make(map[string]*types.Position)
	for k, v := range e.positions {
		positions[k] = v
	}
	return positions
}

func (e *PumpExecutor) verifyAPIKey() error {
	if e.apiKey == "" {
		return fmt.Errorf("API key not configured")
	}
	
	if e.apiKey != "2zYNtr7JxRkppBS4mWkCUAok8cmyMZqSsLt92kvyAUFseij2ubShVqzkhy8mWcG8J2rSjMNiGcFrtAXAr7Mp3QZ1" {
		return fmt.Errorf("invalid API key")
	}
	
	metrics.APIKeyUsage.WithLabelValues("pump.fun", "verification").Inc()
	return nil
}
