package strategy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

type PumpStrategy struct {
	logger      *zap.Logger
	config      *types.PumpTradingConfig
	riskMgr     types.PumpRiskManager
	marketData  types.PumpMarketData
	trader      types.PumpTrader
	positions   map[string]*types.Position
	mu          sync.RWMutex
	isRunning   bool
	updateChan  chan *types.TokenUpdate
}

func NewPumpStrategy(
	logger *zap.Logger,
	config *types.PumpTradingConfig,
	riskMgr types.PumpRiskManager,
	marketData types.PumpMarketData,
	trader types.PumpTrader,
) *PumpStrategy {
	return &PumpStrategy{
		logger:     logger,
		config:     config,
		riskMgr:    riskMgr,
		marketData: marketData,
		trader:     trader,
		positions:  make(map[string]*types.Position),
		updateChan: make(chan *types.TokenUpdate, 1000),
	}
}

func (s *PumpStrategy) Name() string {
	return "pump_fun"
}

func (s *PumpStrategy) Init(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return NewPumpStrategyError(OpInitStrategy, "", "strategy already running", nil)
	}

	updates := s.marketData.GetTokenUpdates()
	go func() {
		for update := range updates {
			select {
			case s.updateChan <- update:
			case <-ctx.Done():
				return
			}
		}
	}()

	s.isRunning = true
	go s.run(ctx)
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

	metrics.PumpTokenPrice.WithLabelValues(update.Symbol).Set(update.Price)
	metrics.PumpTokenVolume.WithLabelValues(update.Symbol).Set(update.Volume)
	metrics.PumpTokenMarketCap.WithLabelValues(update.Symbol).Set(update.MarketCap)

	if update.MarketCap > s.config.MaxMarketCap {
		metrics.PumpStrategyErrors.WithLabelValues("market_cap_exceeded").Inc()
		return nil
	}

	if update.Volume < s.config.MinVolume {
		metrics.PumpStrategyErrors.WithLabelValues("insufficient_volume").Inc()
		return nil
	}

	position := s.positions[update.Symbol]
	if position != nil {
		if err := s.riskMgr.UpdateStopLoss(update.Symbol, update.Price); err != nil {
			metrics.PumpStrategyErrors.WithLabelValues(OpUpdateStopLoss).Inc()
			return NewPumpStrategyError(OpUpdateStopLoss, update.Symbol, "failed to update stop loss", err)
		}

		shouldTakeProfit, percentage := s.riskMgr.CheckTakeProfit(update.Symbol, update.Price)
		if shouldTakeProfit {
			signal := &types.Signal{
				Symbol:    update.Symbol,
				Side:      types.OrderSideSell,
				Size:      position.Size * percentage,
				Price:     update.Price,
				Source:    "pump_fun",
				Timestamp: time.Now(),
			}
			if err := s.ExecuteTrade(context.Background(), signal); err != nil {
				metrics.PumpStrategyErrors.WithLabelValues(OpExecuteTrade).Inc()
				return NewPumpStrategyError(OpExecuteTrade, update.Symbol, "failed to execute take profit", err)
			}
		}
		return nil
	}

	size, err := s.riskMgr.CalculatePositionSize(update.Symbol, update.Price)
	if err != nil {
		return NewPumpStrategyError(OpCalculatePosition, update.Symbol, "failed to calculate position size", err)
	}

	signal := &types.Signal{
		Symbol:    update.Symbol,
		Side:      types.OrderSideBuy,
		Size:      size,
		Price:     update.Price,
		Source:    "pump_fun",
		Timestamp: time.Now(),
	}

	return s.ExecuteTrade(context.Background(), signal)
}

func (s *PumpStrategy) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	if err := s.trader.ExecuteTrade(ctx, signal); err != nil {
		metrics.PumpStrategyErrors.WithLabelValues(OpExecuteTrade).Inc()
		return NewPumpStrategyError(OpExecuteTrade, signal.Symbol, "failed to execute trade", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	position := s.positions[signal.Symbol]
	if position == nil {
		position = &types.Position{
			Symbol:     signal.Symbol,
			EntryPrice: signal.Price,
		}
		s.positions[signal.Symbol] = position
		metrics.PumpRiskLimits.WithLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol)).Set(signal.Price)
	}

	oldSize := position.Size
	if signal.Side == types.OrderSideBuy {
		position.Size += signal.Size
		position.Value = position.Size * signal.Price
		position.EntryPrice = (position.EntryPrice*oldSize + signal.Price*signal.Size) / position.Size
	} else {
		position.Size -= signal.Size
		position.Value = position.Size * signal.Price
		if position.Size <= 0 {
			delete(s.positions, signal.Symbol)
			metrics.PumpRiskLimits.DeleteLabelValues(fmt.Sprintf("%s_entry_price", signal.Symbol))
		}
	}

	metrics.PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size)
	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	return nil
}

func (s *PumpStrategy) GetConfig() *types.PumpTradingConfig {
	return s.config
}

func (s *PumpStrategy) GetRiskManager() types.PumpRiskManager {
	return s.riskMgr
}
