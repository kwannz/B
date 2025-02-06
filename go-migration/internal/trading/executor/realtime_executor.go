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
	"github.com/kwanRoshi/B/go-migration/internal/risk"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type RealtimeExecutor struct {
	logger    *zap.Logger
	provider  *pump.Provider
	riskMgr   *risk.Manager
	apiKey    string
	positions sync.Map
	trades    chan *types.Trade
	stop      chan struct{}
}

func NewRealtimeExecutor(logger *zap.Logger, provider *pump.Provider, riskMgr *risk.Manager, apiKey string) *RealtimeExecutor {
	return &RealtimeExecutor{
		logger:    logger,
		provider:  provider,
		riskMgr:   riskMgr,
		apiKey:    apiKey,
		trades:    make(chan *types.Trade, 100),
		stop:      make(chan struct{}),
	}
}

func (e *RealtimeExecutor) Start(ctx context.Context) error {
	updates, err := e.provider.SubscribePrices(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to subscribe to prices: %w", err)
	}

	go func() {
		for {
			select {
			case update := <-updates:
				e.handlePriceUpdate(ctx, update)
			case trade := <-e.trades:
				e.ExecuteTrade(ctx, trade)
			case <-e.stop:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	return nil
}

func (e *RealtimeExecutor) Stop() {
	close(e.stop)
}

func (e *RealtimeExecutor) ExecuteTrade(ctx context.Context, trade *types.Trade) error {
	// Validate trade parameters
	if trade.Size.IsZero() {
		return fmt.Errorf("trade size cannot be zero")
	}

	// Apply risk management rules
	if err := e.riskMgr.ValidatePositionSize(trade.Symbol, trade.Size.InexactFloat64()); err != nil {
		metrics.APIKeyUsage.WithLabelValues("pump.fun", "risk_failure").Inc()
		return fmt.Errorf("risk validation failed: %w", err)
	}

	var signalType types.SignalType
	if trade.Side == types.OrderSideBuy {
		signalType = types.SignalTypeBuy
	} else {
		signalType = types.SignalTypeSell
	}

	// Execute trade with stop loss and take profit levels
	if err := e.provider.ExecuteOrder(ctx, trade.Symbol, signalType, trade.Size, trade.Price, &trade.StopLoss, trade.TakeProfit); err != nil {
		metrics.APIKeyUsage.WithLabelValues("pump.fun", "failure").Inc()
		metrics.PumpTradeExecutions.WithLabelValues("failure").Inc()
		return fmt.Errorf("trade execution failed: %w", err)
	}

	metrics.APIKeyUsage.WithLabelValues("pump.fun", "success").Inc()
	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()

	e.updatePosition(trade)
	return nil
}

func (e *RealtimeExecutor) handlePriceUpdate(ctx context.Context, update *types.PriceUpdate) {
	e.positions.Range(func(key, value interface{}) bool {
		symbol := key.(string)
		position := value.(*types.Position)

	if symbol == update.Symbol {
			e.updatePositionPrice(ctx, position, update.Price)
			e.checkTakeProfitAndStopLoss(ctx, position, update.Price)
		}
		return true
	})
}

func (e *RealtimeExecutor) updatePositionPrice(ctx context.Context, position *types.Position, price decimal.Decimal) {
	if position.Size.IsZero() {
		return
	}

	entryValue := position.Size.Mul(position.EntryPrice)
	currentValue := position.Size.Mul(price)
	unrealizedPnL := currentValue.Sub(entryValue)
	pnlPercentage := unrealizedPnL.Div(entryValue).Mul(decimal.NewFromInt(100))

	metrics.PumpUnrealizedPnL.WithLabelValues(position.Symbol).Set(unrealizedPnL.InexactFloat64())
	metrics.PumpUnrealizedPnL.WithLabelValues(position.Symbol).Set(pnlPercentage.InexactFloat64())

	e.logger.Info("Position update",
		zap.String("symbol", position.Symbol),
		zap.String("size", position.Size.String()),
		zap.String("entry_price", position.EntryPrice.String()),
		zap.String("current_price", price.String()),
		zap.String("unrealized_pnl", unrealizedPnL.String()),
		zap.String("pnl_percentage", pnlPercentage.String()))
}

func (e *RealtimeExecutor) checkTakeProfitAndStopLoss(ctx context.Context, position *types.Position, price decimal.Decimal) {
	// Stop Loss check (10% below entry)
	stopLossPrice := position.EntryPrice.Mul(decimal.NewFromFloat(0.9))
	if price.LessThanOrEqual(stopLossPrice) {
		if err := e.closePosition(ctx, position, price); err != nil {
			e.logger.Error("Failed to execute stop loss",
				zap.String("symbol", position.Symbol),
				zap.Error(err))
		}
		return
	}

	// Take Profit levels (20% at 2x, 25% at 3x, 20% at 5x)
	profitLevels := []struct {
		multiplier decimal.Decimal
		percentage decimal.Decimal
	}{
		{decimal.NewFromInt(2), decimal.NewFromFloat(0.2)},
		{decimal.NewFromInt(3), decimal.NewFromFloat(0.25)},
		{decimal.NewFromInt(5), decimal.NewFromFloat(0.2)},
	}

	for _, level := range profitLevels {
		targetPrice := position.EntryPrice.Mul(level.multiplier)
		if price.GreaterThanOrEqual(targetPrice) {
			takeSize := position.Size.Mul(level.percentage)
			if err := e.takeProfits(ctx, position, price, takeSize); err != nil {
				e.logger.Error("Failed to take profits",
					zap.String("symbol", position.Symbol),
					zap.String("target_price", targetPrice.String()),
					zap.Error(err))
			}
		}
	}
}

func (e *RealtimeExecutor) closePosition(ctx context.Context, position *types.Position, price decimal.Decimal) error {
	trade := &types.Trade{
		Symbol:    position.Symbol,
		Side:      types.OrderSideSell,
		Size:      position.Size,
		Price:     price,
		Timestamp: time.Now(),
	}

	if err := e.ExecuteTrade(ctx, trade); err != nil {
		return fmt.Errorf("failed to execute close position trade: %w", err)
	}

	e.positions.Delete(position.Symbol)
	metrics.PumpPositionSize.WithLabelValues(position.Symbol).Set(0)
	
	e.logger.Info("Position closed",
		zap.String("symbol", position.Symbol),
		zap.String("size", position.Size.String()),
		zap.String("price", price.String()))

	return nil
}

func (e *RealtimeExecutor) takeProfits(ctx context.Context, position *types.Position, price, size decimal.Decimal) error {
	if size.GreaterThan(position.Size) {
		size = position.Size
	}

	trade := &types.Trade{
		Symbol:    position.Symbol,
		Side:      types.OrderSideSell,
		Size:      size,
		Price:     price,
		Timestamp: time.Now(),
	}

	if err := e.ExecuteTrade(ctx, trade); err != nil {
		return fmt.Errorf("failed to execute take profit trade: %w", err)
	}

	value, _ := e.positions.Load(position.Symbol)
	pos := value.(*types.Position)
	pos.Size = pos.Size.Sub(size)
	
	if pos.Size.IsZero() {
		e.positions.Delete(position.Symbol)
		metrics.PumpPositionSize.WithLabelValues(position.Symbol).Set(0)
	} else {
		metrics.PumpPositionSize.WithLabelValues(position.Symbol).Set(pos.Size.InexactFloat64())
	}

	e.logger.Info("Take profit executed",
		zap.String("symbol", position.Symbol),
		zap.String("size", size.String()),
		zap.String("remaining_size", pos.Size.String()),
		zap.String("price", price.String()))

	return nil
}

func (e *RealtimeExecutor) updatePosition(trade *types.Trade) {
	value, ok := e.positions.Load(trade.Symbol)
	if !ok {
		position := &types.Position{
			Symbol:     trade.Symbol,
			Size:       trade.Size,
			EntryPrice: trade.Price,
			UpdatedAt: time.Now(),
		}
		e.positions.Store(trade.Symbol, position)
		metrics.PumpPositionSize.WithLabelValues(trade.Symbol).Set(trade.Size.InexactFloat64())
		return
	}

	position := value.(*types.Position)
	if trade.Side == types.OrderSideSell {
		position.Size = position.Size.Sub(trade.Size)
	} else {
		oldValue := position.Size.Mul(position.EntryPrice)
		newValue := trade.Size.Mul(trade.Price)
		totalSize := position.Size.Add(trade.Size)
		
		if !totalSize.IsZero() {
			position.EntryPrice = oldValue.Add(newValue).Div(totalSize)
		}
		position.Size = totalSize
	}

	position.UpdatedAt = time.Now()

	if position.Size.IsZero() {
		e.positions.Delete(trade.Symbol)
		metrics.PumpPositionSize.WithLabelValues(trade.Symbol).Set(0)
	} else {
		metrics.PumpPositionSize.WithLabelValues(trade.Symbol).Set(position.Size.InexactFloat64())
	}
}
