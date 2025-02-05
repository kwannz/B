package strategy

import (
	"fmt"
	"sync"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

type PumpRiskManager struct {
	logger     *zap.Logger
	config     *types.RiskConfig
	positions  map[string]*types.Position
	stopLosses map[string]float64
	mu         sync.RWMutex
}

func NewPumpRiskManager(logger *zap.Logger, config *types.RiskConfig) *PumpRiskManager {
	if len(config.ProfitTaking) == 0 {
		config.ProfitTaking = []types.ProfitLevel{
			{Level: 2.0, Percentage: 0.20},
			{Level: 3.0, Percentage: 0.25},
			{Level: 5.0, Percentage: 0.20},
		}
	}

	metrics.PumpRiskLimits.WithLabelValues("max_position_size").Set(config.MaxPositionSize)
	metrics.PumpRiskLimits.WithLabelValues("min_position_size").Set(config.MinPositionSize)
	metrics.PumpRiskLimits.WithLabelValues("initial_stop_loss").Set(config.StopLoss.Initial)
	metrics.PumpRiskLimits.WithLabelValues("trailing_stop_loss").Set(config.StopLoss.Trailing)

	for _, level := range config.ProfitTaking {
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("take_profit_%0.1fx", level.Level)).Set(level.Percentage)
	}

	return &PumpRiskManager{
		logger:     logger,
		config:     config,
		positions:  make(map[string]*types.Position),
		stopLosses: make(map[string]float64),
	}
}

func (r *PumpRiskManager) ValidatePosition(symbol string, size float64) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if size < r.config.MinPositionSize {
		return fmt.Errorf("position size too small: %f < %f", size, r.config.MinPositionSize)
	}

	if size > r.config.MaxPositionSize {
		return fmt.Errorf("position size too large: %f > %f", size, r.config.MaxPositionSize)
	}

	return nil
}

func (r *PumpRiskManager) CalculatePositionSize(symbol string, price float64) (float64, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	position := r.positions[symbol]
	if position != nil {
		return 0, fmt.Errorf("position already exists for %s", symbol)
	}

	size := r.config.MinPositionSize
	if price > 0 {
		maxValue := r.config.MaxPositionSize * price
		if maxValue < size {
			size = maxValue
		}
	}

	return size, nil
}

func (r *PumpRiskManager) UpdateStopLoss(symbol string, price float64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	position := r.positions[symbol]
	if position == nil {
		return NewPumpStrategyError(OpUpdateStopLoss, symbol, "no position found", nil)
	}

	currentStopLoss := r.stopLosses[symbol]
	if currentStopLoss == 0 {
		// Initial stop loss
		stopLoss := price * (1 - r.config.StopLoss.Initial)
		r.stopLosses[symbol] = stopLoss
		metrics.PumpPositionSize.WithLabelValues(symbol).Set(position.Size)
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", symbol)).Set(stopLoss)
		r.logger.Info("initial stop loss set",
			zap.String("symbol", symbol),
			zap.Float64("price", price),
			zap.Float64("stop_loss", stopLoss),
			zap.Float64("percentage", r.config.StopLoss.Initial*100))
		return nil
	}

	// Update trailing stop loss if price has moved up
	trailingStopLoss := price * (1 - r.config.StopLoss.Trailing)
	if trailingStopLoss > currentStopLoss {
		r.stopLosses[symbol] = trailingStopLoss
		metrics.PumpPositionSize.WithLabelValues(symbol).Set(position.Size)
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", symbol)).Set(trailingStopLoss)
		r.logger.Info("trailing stop loss updated",
			zap.String("symbol", symbol),
			zap.Float64("price", price),
			zap.Float64("new_stop_loss", trailingStopLoss),
			zap.Float64("old_stop_loss", currentStopLoss),
			zap.Float64("percentage", r.config.StopLoss.Trailing*100))
	}

	return nil
}

func (r *PumpRiskManager) CheckTakeProfit(symbol string, price float64) (bool, float64) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	position := r.positions[symbol]
	if position == nil {
		return false, 0
	}

	// Check stop loss first
	stopLoss := r.stopLosses[symbol]
	if price <= stopLoss {
		metrics.PumpStopLossTriggers.Inc()
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", symbol)).Set(0)
		r.logger.Info("stop loss triggered",
			zap.String("symbol", symbol),
			zap.Float64("price", price),
			zap.Float64("stop_loss", stopLoss))
		return true, 1.0
	}

	// Check take profit levels
	for _, level := range r.config.ProfitTaking {
		targetPrice := position.EntryPrice * level.Level
		if price >= targetPrice && !position.HasTakenProfitAt(level.Level) {
			metrics.PumpTakeProfitTriggers.WithLabelValues(fmt.Sprintf("%.1fx", level.Level)).Inc()
			metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_take_profit_%0.1fx", symbol, level.Level)).Set(level.Percentage)
			r.logger.Info("take profit triggered",
				zap.String("symbol", symbol),
				zap.Float64("price", price),
				zap.Float64("target", targetPrice),
				zap.Float64("level", level.Level),
				zap.Float64("percentage", level.Percentage))
			position.MarkTakenProfitAt(level.Level)
			return true, level.Percentage
		}
	}

	return false, 0
}

func (r *PumpRiskManager) UpdatePosition(symbol string, position *types.Position) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if position.Size <= 0 {
		delete(r.positions, symbol)
		delete(r.stopLosses, symbol)
		metrics.PumpPositionSize.DeleteLabelValues(symbol)
		metrics.PumpRiskLimits.DeleteLabelValues(fmt.Sprintf("%s_stop_loss", symbol))
		for _, level := range r.config.ProfitTaking {
			metrics.PumpRiskLimits.DeleteLabelValues(fmt.Sprintf("%s_take_profit_%0.1fx", symbol, level.Level))
		}
		return
	}

	r.positions[symbol] = position
	metrics.PumpPositionSize.WithLabelValues(symbol).Set(position.Size)
	metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_stop_loss", symbol)).Set(r.stopLosses[symbol])
	
	// Track PnL metrics
	if position.EntryPrice > 0 {
		unrealizedPnL := (position.CurrentPrice - position.EntryPrice) * position.Size
		metrics.PumpUnrealizedPnL.WithLabelValues(symbol).Set(unrealizedPnL)
	}
}
