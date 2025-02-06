package strategy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/config"
	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/risk"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type PumpFunStrategy struct {
	*BaseStrategy
	engine    types.TradingEngine
	riskMgr   *risk.Manager
	provider  *pump.Provider
	secretKey string
	logger    *zap.Logger
	mu        sync.RWMutex
}

func NewPumpFunStrategy(engine types.TradingEngine, riskMgr *risk.Manager, provider *pump.Provider, logger *zap.Logger) (*PumpFunStrategy, error) {
	secrets, err := config.LoadSecrets()
	if err != nil {
		return nil, fmt.Errorf("failed to load secrets: %w", err)
	}

	return &PumpFunStrategy{
		BaseStrategy: NewBaseStrategy("pump_fun"),
		engine:      engine,
		riskMgr:     riskMgr,
		provider:    provider,
		secretKey:   secrets.PumpFunKey,
		logger:      logger,
	}, nil
}

func (s *PumpFunStrategy) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.validateSignal(signal); err != nil {
		return fmt.Errorf("invalid signal: %w", err)
	}

	switch signal.Type {
	case types.SignalTypeBuy:
		return s.executeBuy(ctx, signal)
	case types.SignalTypeSell:
		return s.executeSell(ctx, signal)
	default:
		return fmt.Errorf("unknown signal type: %s", signal.Type)
	}
}

func (s *PumpFunStrategy) validateSignal(signal *types.Signal) error {
	// Market cap and volume validation is handled by the provider
	return nil
}

func (s *PumpFunStrategy) executeBuy(ctx context.Context, signal *types.Signal) error {
	position, err := s.engine.GetPosition(ctx, signal.Symbol)
	if err != nil {
		return fmt.Errorf("failed to get position: %w", err)
	}

	if !position.Size.IsZero() {
		return fmt.Errorf("position already exists for %s", signal.Symbol)
	}

	size := s.calculatePositionSize(signal)
	if err := s.riskMgr.ValidateNewPosition(ctx, signal.Symbol, size, signal.Price); err != nil {
		return fmt.Errorf("position validation failed: %w", err)
	}

	params := &types.TradeParams{
		Symbol:    signal.Symbol,
		Side:      types.OrderSideBuy,
		Price:     signal.Price,
		Size:      size,
		APIKey:    s.secretKey,
		Timestamp: time.Now(),
	}

	if err := s.engine.ExecuteTrade(ctx, params); err != nil {
		return fmt.Errorf("failed to execute buy trade: %w", err)
	}

	s.setupProfitTakingOrders(ctx, signal.Symbol, signal.Price, size)
	return nil
}

func (s *PumpFunStrategy) executeSell(ctx context.Context, signal *types.Signal) error {
	position, err := s.engine.GetPosition(ctx, signal.Symbol)
	if err != nil {
		return fmt.Errorf("failed to get position: %w", err)
	}

	if position.Size.IsZero() {
		return fmt.Errorf("no position exists for %s", signal.Symbol)
	}

	params := &types.TradeParams{
		Symbol:    signal.Symbol,
		Side:      types.OrderSideSell,
		Price:     signal.Price,
		Size:      position.Size,
		APIKey:    s.secretKey,
		Timestamp: time.Now(),
	}

	if err := s.engine.ExecuteTrade(ctx, params); err != nil {
		return fmt.Errorf("failed to execute sell trade: %w", err)
	}

	return nil
}

func (s *PumpFunStrategy) calculatePositionSize(signal *types.Signal) decimal.Decimal {
	maxSize := s.config.RiskLimits.MaxPositionSize
	suggestedSize := signal.Price.Mul(decimal.NewFromInt(1000))
	
	if suggestedSize.GreaterThan(maxSize) {
		return maxSize
	}
	return suggestedSize
}

func (s *PumpFunStrategy) setupProfitTakingOrders(ctx context.Context, symbol string, entryPrice, size decimal.Decimal) {
	for _, level := range s.config.ProfitTaking.Levels {
		takeProfit := entryPrice.Mul(level.Multiplier)
		partialSize := size.Mul(level.Percentage)

		params := &types.TradeParams{
			Symbol:    symbol,
			Side:      types.OrderSideSell,
			Price:     takeProfit,
			Size:      partialSize,
			APIKey:    s.secretKey,
			Timestamp: time.Now(),
		}

		if err := s.engine.ExecuteTrade(ctx, params); err != nil {
			s.logger.Error("failed to execute take-profit trade",
				zap.String("symbol", symbol),
				zap.String("price", takeProfit.String()),
				zap.String("size", partialSize.String()),
				zap.Error(err))
		}
	}
}
