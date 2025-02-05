package strategy

import (
	"fmt"
	"sync"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type PumpRiskManager struct {
	logger     *zap.Logger
	config     *types.RiskConfig
	positions  map[string]*types.Position
	stopLosses map[string]decimal.Decimal
	mu         sync.RWMutex
}

func NewPumpRiskManager(logger *zap.Logger, config *types.RiskConfig) *PumpRiskManager {
	defaultLevels := []types.ProfitLevel{
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
	}

	metrics.TokenVolume.WithLabelValues("pump.fun", "max_position_size").Set(config.MaxPositionSize.InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", "min_position_size").Set(config.MinPositionSize.InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", "initial_stop_loss").Set(config.StopLoss.Initial.InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", "trailing_stop_loss").Set(config.StopLoss.Trailing.InexactFloat64())

	for _, level := range defaultLevels {
		metrics.TokenVolume.WithLabelValues("pump.fun", fmt.Sprintf("take_profit_%sx", level.Multiplier.String())).Set(level.Percentage.InexactFloat64())
	}

	return &PumpRiskManager{
		logger:     logger,
		config:     config,
		positions:  make(map[string]*types.Position),
		stopLosses: make(map[string]decimal.Decimal),
	}
}

func (r *PumpRiskManager) ValidatePosition(symbol string, size decimal.Decimal) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if size.LessThan(r.config.MinPositionSize) {
		return fmt.Errorf("position size too small: %s < %s", size.String(), r.config.MinPositionSize.String())
	}

	if size.GreaterThan(r.config.MaxPositionSize) {
		return fmt.Errorf("position size too large: %s > %s", size.String(), r.config.MaxPositionSize.String())
	}

	return nil
}

func (r *PumpRiskManager) CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	position := r.positions[symbol]
	if position != nil {
		return decimal.Zero, fmt.Errorf("position already exists for %s", symbol)
	}

	size := r.config.MinPositionSize
	if price.GreaterThan(decimal.Zero) {
		maxValue := r.config.MaxPositionSize.Mul(price)
		if maxValue.LessThan(size) {
			size = maxValue
		}
	}

	return size, nil
}

func (r *PumpRiskManager) UpdateStopLoss(symbol string, price decimal.Decimal) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	position := r.positions[symbol]
	if position == nil {
		return NewPumpStrategyError(OpUpdateStopLoss, symbol, "no position found", nil)
	}

	currentStopLoss := r.stopLosses[symbol]
	if currentStopLoss.IsZero() {
		// Initial stop loss
		one := decimal.NewFromInt(1)
		stopLoss := price.Mul(one.Sub(r.config.StopLoss.Initial))
		r.stopLosses[symbol] = stopLoss
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_position").Set(position.Size.InexactFloat64())
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_stop_loss").Set(stopLoss.InexactFloat64())
		r.logger.Info("initial stop loss set",
			zap.String("symbol", symbol),
			zap.String("price", price.String()),
			zap.String("stop_loss", stopLoss.String()),
			zap.String("percentage", r.config.StopLoss.Initial.Mul(decimal.NewFromInt(100)).String()))
		return nil
	}

	// Update trailing stop loss if price has moved up
	one := decimal.NewFromInt(1)
	trailingStopLoss := price.Mul(one.Sub(r.config.StopLoss.Trailing))
	if trailingStopLoss.GreaterThan(currentStopLoss) {
		r.stopLosses[symbol] = trailingStopLoss
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_position").Set(position.Size.InexactFloat64())
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_stop_loss").Set(trailingStopLoss.InexactFloat64())
		r.logger.Info("trailing stop loss updated",
			zap.String("symbol", symbol),
			zap.String("price", price.String()),
			zap.String("new_stop_loss", trailingStopLoss.String()),
			zap.String("old_stop_loss", currentStopLoss.String()),
			zap.String("percentage", r.config.StopLoss.Trailing.Mul(decimal.NewFromInt(100)).String()))
	}

	return nil
}

func (r *PumpRiskManager) CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	position := r.positions[symbol]
	if position == nil {
		return false, decimal.Zero
	}

	// Check stop loss first
	stopLoss := r.stopLosses[symbol]
	if price.LessThanOrEqual(stopLoss) {
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_stop_loss_trigger").Set(1)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_stop_loss").Set(0)
		r.logger.Info("stop loss triggered",
			zap.String("symbol", symbol),
			zap.String("price", price.String()),
			zap.String("stop_loss", stopLoss.String()))
		return true, decimal.NewFromInt(1)
	}

	// Check take profit levels
	for _, level := range r.config.TakeProfitLevels {
		targetPrice := position.EntryPrice.Mul(level.Multiplier)
		if price.GreaterThanOrEqual(targetPrice) && !position.HasTakenProfitAt(level.Multiplier) {
			metrics.TokenVolume.WithLabelValues("pump.fun", fmt.Sprintf("%s_take_profit_trigger_%sx", symbol, level.Multiplier.String())).Set(1)
			metrics.TokenVolume.WithLabelValues("pump.fun", fmt.Sprintf("%s_take_profit_%sx", symbol, level.Multiplier.String())).Set(level.Percentage.InexactFloat64())
			r.logger.Info("take profit triggered",
				zap.String("symbol", symbol),
				zap.String("price", price.String()),
				zap.String("target", targetPrice.String()),
				zap.String("level", level.Multiplier.String()),
				zap.String("percentage", level.Percentage.String()))
			position.MarkTakenProfitAt(level.Multiplier)
			return true, level.Percentage
		}
	}

	return false, decimal.Zero
}

func (r *PumpRiskManager) UpdatePosition(symbol string, position *types.Position) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if position.Size.LessThanOrEqual(decimal.Zero) {
		delete(r.positions, symbol)
		delete(r.stopLosses, symbol)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_position").Set(0)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_stop_loss").Set(0)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_unrealized_pnl").Set(0)
		return
	}

	r.positions[symbol] = position
	metrics.PumpPositionSize.WithLabelValues(symbol).Set(position.Size.InexactFloat64())
	metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", symbol)).Set(r.stopLosses[symbol].InexactFloat64())
	
	// Track PnL metrics
	if position.EntryPrice.GreaterThan(decimal.Zero) {
		unrealizedPnL := position.CurrentPrice.Sub(position.EntryPrice).Mul(position.Size)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol+"_unrealized_pnl").Set(unrealizedPnL.InexactFloat64())
	}
}
