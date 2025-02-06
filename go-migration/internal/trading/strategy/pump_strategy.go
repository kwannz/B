package strategy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type PumpStrategy struct {
	logger      *zap.Logger
	config      *types.PumpTradingConfig
	executor    types.PumpExecutor
	positions   map[string]*types.Position
	mu          sync.RWMutex
	isRunning   bool
	updateChan  chan *types.TokenUpdate
}

func NewPumpStrategy(config *types.PumpTradingConfig, executor types.PumpExecutor, logger *zap.Logger) *PumpStrategy {
	return &PumpStrategy{
		logger:     logger,
		config:     config,
		executor:   executor,
		positions:  make(map[string]*types.Position),
		updateChan: make(chan *types.TokenUpdate, 1000),
	}
}

func (s *PumpStrategy) Evaluate(ctx context.Context, token *types.TokenMarketInfo) (bool, error) {
	if token.MarketCap.GreaterThan(s.config.MaxMarketCap) {
		return false, nil
	}
	if token.Volume.LessThan(s.config.MinVolume) {
		return false, nil
	}
	return true, nil
}

func (s *PumpStrategy) CalculatePositionSize(price decimal.Decimal) (decimal.Decimal, error) {
	maxSize := s.config.Risk.MaxPositionSize
	minSize := s.config.Risk.MinPositionSize
	size := maxSize.Div(price)
	if size.LessThan(minSize) {
		return minSize, nil
	}
	return size, nil
}

func (s *PumpStrategy) ValidatePosition(size decimal.Decimal) error {
	if size.LessThan(s.config.Risk.MinPositionSize) {
		return fmt.Errorf("position size %s below minimum %s", size, s.config.Risk.MinPositionSize)
	}
	if size.GreaterThan(s.config.Risk.MaxPositionSize) {
		return fmt.Errorf("position size %s above maximum %s", size, s.config.Risk.MaxPositionSize)
	}
	return nil
}

func (s *PumpStrategy) GetLogger() *zap.Logger {
	return s.logger
}

func (s *PumpStrategy) Init(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return NewPumpStrategyError(OpInitStrategy, "", "strategy already running", nil)
	}

	s.isRunning = true
	return nil
}

func (s *PumpStrategy) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case update := <-s.updateChan:
			if err := s.ProcessUpdate(update); err != nil {
				if IsStrategyError(err) {
					s.logger.Error("pump strategy error",
						zap.Error(err),
						zap.String("symbol", update.Symbol))
				} else {
					s.logger.Error("failed to process update",
						zap.Error(err),
						zap.String("symbol", update.Symbol))
				}
			}
		}
	}
}

func (s *PumpStrategy) ProcessUpdate(update *types.TokenUpdate) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	metrics.TokenPrice.WithLabelValues("pump.fun", update.Symbol).Set(decimal.NewFromFloat(update.Price).InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", update.Symbol).Set(decimal.NewFromFloat(update.Volume).InexactFloat64())
	metrics.TokenVolume.WithLabelValues("pump.fun", update.Symbol+"_market_cap").Set(decimal.NewFromFloat(update.MarketCap).InexactFloat64())

	marketCap := decimal.NewFromFloat(update.MarketCap)
	if marketCap.GreaterThan(s.config.MaxMarketCap) {
		metrics.APIErrors.WithLabelValues("pump_market_cap_exceeded").Inc()
		return nil
	}

	volume := decimal.NewFromFloat(update.Volume)
	if volume.LessThan(s.config.MinVolume) {
		metrics.APIErrors.WithLabelValues("pump_insufficient_volume").Inc()
		return nil
	}

	position := s.positions[update.Symbol]
	price := decimal.NewFromFloat(update.Price)
	
	if position != nil {
		if err := s.executor.GetRiskManager().UpdateStopLoss(update.Symbol, price); err != nil {
			metrics.APIErrors.WithLabelValues("pump_update_stop_loss").Inc()
			return NewPumpStrategyError(OpUpdateStopLoss, update.Symbol, "failed to update stop loss", err)
		}

		shouldTakeProfit, percentage := s.executor.GetRiskManager().CheckTakeProfit(update.Symbol, price)
		if shouldTakeProfit {
			sellAmount := position.Size.Mul(percentage)
			signal := &types.Signal{
				Symbol:    update.Symbol,
				Type:      types.SignalTypeSell,
				Amount:    sellAmount,
				Price:     price,
				Provider:  "pump.fun",
				Timestamp: time.Now(),
			}
			if err := s.ExecuteTrade(context.Background(), signal); err != nil {
				metrics.APIErrors.WithLabelValues("pump_execute_trade").Inc()
				return NewPumpStrategyError(OpExecuteTrade, update.Symbol, "failed to execute take profit", err)
			}
		}
		return nil
	}

	size, err := s.executor.GetRiskManager().CalculatePositionSize(update.Symbol, price)
	if err != nil {
		return NewPumpStrategyError(OpCalculatePosition, update.Symbol, "failed to calculate position size", err)
	}

	signal := &types.Signal{
		Symbol:    update.Symbol,
		Type:      types.SignalTypeBuy,
		Amount:    size,
		Price:     price,
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	return s.ExecuteTrade(context.Background(), signal)
}

func (s *PumpStrategy) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	return s.executor.ExecuteTrade(ctx, signal)

	s.mu.Lock()
	defer s.mu.Unlock()

	position := s.positions[signal.Symbol]
	if position == nil {
		position = &types.Position{
			Symbol:     signal.Symbol,
			EntryPrice: signal.Price,
			Size:      decimal.Zero,
			Value:     decimal.Zero,
		}
		s.positions[signal.Symbol] = position
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol)).Set(signal.Price.InexactFloat64())
	}

	oldSize := position.Size
	if signal.Type == types.SignalTypeBuy {
		position.Size = position.Size.Add(signal.Amount)
		position.Value = position.Size.Mul(signal.Price)
		position.EntryPrice = oldSize.Mul(position.EntryPrice).Add(signal.Price.Mul(signal.Amount)).Div(position.Size)
	} else {
		position.Size = position.Size.Sub(signal.Amount)
		position.Value = position.Size.Mul(signal.Price)
		if position.Size.LessThanOrEqual(decimal.Zero) {
			delete(s.positions, signal.Symbol)
			metrics.PumpRiskLimits.DeleteLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol))
		}
	}

	metrics.PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size.InexactFloat64())
	metrics.GetPumpMetrics().TradeExecutions.WithLabelValues("success").Inc()
	
	if signal.Price.GreaterThan(decimal.Zero) {
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol)).Set(signal.Price.InexactFloat64())
	}
	return nil
}

func (s *PumpStrategy) Name() string {
	return "pump_fun"
}

func (s *PumpStrategy) GetConfig() *types.PumpTradingConfig {
	return s.config
}

// GetRiskManager is removed since it's no longer part of the PumpStrategy interface
