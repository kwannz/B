package executor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

type PumpExecutor struct {
	logger     *zap.Logger
	provider   types.MarketDataProvider
	riskMgr    types.RiskManager
	mu         sync.RWMutex
	positions  map[string]*types.Position
	apiKey     string
	isRunning  bool
}

func NewPumpExecutor(logger *zap.Logger, provider types.MarketDataProvider, riskMgr types.RiskManager, apiKey string) *PumpExecutor {
	return &PumpExecutor{
		logger:    logger,
		provider:  provider,
		riskMgr:   riskMgr,
		positions: make(map[string]*types.Position),
		apiKey:    apiKey,
	}
}

func (e *PumpExecutor) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("executor not running")
	}

	// Validate position against risk limits
	if err := e.riskMgr.ValidatePosition(signal.Symbol, signal.Size); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("risk_rejected").Inc()
		return fmt.Errorf("risk validation failed: %w", err)
	}

	// Execute trade through provider
	params := map[string]interface{}{
		"symbol": signal.Symbol,
		"side":   signal.Side,
		"size":   signal.Size,
		"price":  signal.Price,
	}

	if err := e.provider.ExecuteTrade(ctx, params); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("failed").Inc()
		return fmt.Errorf("trade execution failed: %w", err)
	}

	// Update position tracking
	position, exists := e.positions[signal.Symbol]
	if !exists {
		position = types.NewPosition(signal.Symbol)
		e.positions[signal.Symbol] = position
	}

	if err := position.UpdatePosition(signal); err != nil {
		e.logger.Error("failed to update position",
			zap.Error(err),
			zap.String("symbol", signal.Symbol))
	}

	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	metrics.PumpTradeVolume.WithLabelValues(signal.Symbol).Add(signal.Size)
	metrics.PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size)

	return nil
}

func (e *PumpExecutor) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.isRunning {
		return fmt.Errorf("executor already running")
	}

	e.isRunning = true
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
