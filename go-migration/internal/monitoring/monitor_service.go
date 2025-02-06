package monitoring

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type MonitorService struct {
	logger         *zap.Logger
	metrics        *metrics.PumpMetrics
	tradeMonitor   *TradeMonitor
	tokenMonitor   *TokenMonitor
	solanaMonitor  *SolanaMonitor
	mu             sync.RWMutex
	updateChan     chan *types.TokenUpdate
	tradeChan      chan *types.Trade
	positionChan   chan *types.Position
}

func NewMonitorService(logger *zap.Logger, metrics *metrics.PumpMetrics) *MonitorService {
	return &MonitorService{
		logger:        logger,
		metrics:       metrics,
		tradeMonitor:  NewTradeMonitor(logger, metrics),
		tokenMonitor:  NewTokenMonitor(logger, metrics),
		solanaMonitor: NewSolanaMonitor(logger, metrics, "AJuZ3Es8cJBaVeRkfPWxZq8q1KPaZgtdacPWUH1F8XM5"),
		updateChan:    make(chan *types.TokenUpdate, 1000),
		tradeChan:     make(chan *types.Trade, 1000),
		positionChan:  make(chan *types.Position, 1000),
	}
}

func (s *MonitorService) Start(ctx context.Context) error {
	s.logger.Info("Starting monitor service")

	if err := s.tradeMonitor.Start(ctx); err != nil {
		return err
	}

	if err := s.tokenMonitor.Start(ctx); err != nil {
		return err
	}

	if err := s.solanaMonitor.Start(ctx); err != nil {
		return err
	}

	metrics.TradingStatus.WithLabelValues("monitor_service").Set(1)
	metrics.ActiveStrategies.WithLabelValues("pump_fun").Set(1)
	
	go s.processUpdates(ctx)
	go s.monitorStrategies(ctx)
	return nil
}

func (s *MonitorService) processUpdates(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case update := <-s.updateChan:
			s.tokenMonitor.UpdateToken(update.Symbol, update)
		case trade := <-s.tradeChan:
			s.tradeMonitor.AddTrade(trade)
		case position := <-s.positionChan:
			s.tradeMonitor.UpdatePosition(position.Symbol, position)
		}
	}
}

func (s *MonitorService) OnTokenUpdate(update *types.TokenUpdate) {
	select {
	case s.updateChan <- update:
	default:
		s.logger.Warn("Token update channel full, dropping update",
			zap.String("symbol", update.Symbol))
	}
}

func (s *MonitorService) OnTrade(trade *types.Trade) {
	select {
	case s.tradeChan <- trade:
	default:
		s.logger.Warn("Trade channel full, dropping trade",
			zap.String("symbol", trade.Symbol))
	}
}

func (s *MonitorService) OnPosition(position *types.Position) {
	select {
	case s.positionChan <- position:
	default:
		s.logger.Warn("Position channel full, dropping position",
			zap.String("symbol", position.Symbol))
	}
}

func (s *MonitorService) GetTokens() map[string]*types.TokenMarketInfo {
	return s.tokenMonitor.GetTokens()
}

func (s *MonitorService) GetPositions() map[string]*types.Position {
	return s.tradeMonitor.GetPositions()
}

func (s *MonitorService) GetTrades(symbol string) []*types.Trade {
	return s.tradeMonitor.GetTrades(symbol)
}

func (s *MonitorService) monitorStrategies(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 30)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			metrics.TradingStatus.WithLabelValues("monitor_service").Set(0)
			return
		case <-ticker.C:
			positions := s.tradeMonitor.GetPositions()
			var totalPnL float64
			for _, pos := range positions {
				if !pos.UnrealizedPnL.IsZero() {
					totalPnL += pos.UnrealizedPnL.InexactFloat64()
				}
			}
			metrics.StrategyPnL.WithLabelValues("pump_fun").Set(totalPnL)
		}
	}
}
