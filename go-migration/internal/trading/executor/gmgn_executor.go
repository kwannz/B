package executor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/gmgn"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type GMGNExecutor struct {
	logger     *zap.Logger
	provider   *gmgn.Provider
	riskMgr    types.RiskManager
	config     *types.PumpTradingConfig
	mu         sync.RWMutex
	positions  map[string]*types.Position
	isRunning  bool
}

func NewGMGNExecutor(logger *zap.Logger, provider *gmgn.Provider, riskMgr types.RiskManager, config *types.PumpTradingConfig) *GMGNExecutor {
	return &GMGNExecutor{
		logger:    logger,
		provider:  provider,
		riskMgr:   riskMgr,
		positions: make(map[string]*types.Position),
		config:    config,
	}
}

func (e *GMGNExecutor) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.isRunning {
		return fmt.Errorf("executor already running")
	}

	e.isRunning = true
	e.logger.Info("GMGN executor started")
	return nil
}

func (e *GMGNExecutor) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("executor not running")
	}

	e.isRunning = false
	return nil
}

func (e *GMGNExecutor) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("executor not running")
	}

	size, err := e.riskMgr.CalculatePositionSize(signal.Symbol, signal.Price)
	if err != nil {
		metrics.GMGNTradeExecutions.WithLabelValues("size_calculation_failed").Inc()
		return fmt.Errorf("position size calculation failed: %w", err)
	}

	if err := e.riskMgr.ValidatePosition(signal.Symbol, size); err != nil {
		metrics.GMGNTradeExecutions.WithLabelValues("risk_rejected").Inc()
		return fmt.Errorf("risk validation failed: %w", err)
	}

	quote, err := e.provider.GetQuote(ctx, signal.TokenIn, signal.TokenOut, signal.Amount)
	if err != nil {
		metrics.GMGNTradeExecutions.WithLabelValues("quote_failed").Inc()
		return fmt.Errorf("failed to get quote: %w", err)
	}

	tx, err := e.provider.SubmitTransaction(ctx, quote.RawTx)
	if err != nil {
		metrics.GMGNTradeExecutions.WithLabelValues("submit_failed").Inc()
		return fmt.Errorf("failed to submit transaction: %w", err)
	}

	// Monitor transaction status
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			status, err := e.provider.GetTransactionStatus(ctx, tx.Hash, quote.BlockHeight)
			if err != nil {
				metrics.GMGNTradeExecutions.WithLabelValues("status_check_failed").Inc()
				return fmt.Errorf("failed to check transaction status: %w", err)
			}

			if status.Success {
				metrics.GMGNTradeExecutions.WithLabelValues("success").Inc()
				e.updatePosition(signal, size)
				return nil
			}

			if status.Expired {
				metrics.GMGNTradeExecutions.WithLabelValues("expired").Inc()
				return fmt.Errorf("transaction expired")
			}

			time.Sleep(time.Second)
		}
	}
}

func (e *GMGNExecutor) updatePosition(signal *types.Signal, size decimal.Decimal) {
	position, exists := e.positions[signal.Symbol]
	if !exists {
		position = types.NewPosition(signal.Symbol, decimal.Zero, signal.Price)
		e.positions[signal.Symbol] = position
	}

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

	metrics.GMGNRiskLimits.WithLabelValues("position_size").Set(position.Size.InexactFloat64())
	metrics.GMGNRiskLimits.WithLabelValues("entry_price").Set(position.EntryPrice.InexactFloat64())
}

func (e *GMGNExecutor) GetPosition(symbol string) *types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.positions[symbol]
}

func (e *GMGNExecutor) GetPositions() map[string]*types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()
	
	positions := make(map[string]*types.Position)
	for k, v := range e.positions {
		positions[k] = v
	}
	return positions
}

func (e *GMGNExecutor) GetRiskManager() types.RiskManager {
	return e.riskMgr
}
