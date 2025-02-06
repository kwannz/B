package monitor

import (
	"context"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradingMonitor struct {
	logger     *zap.Logger
	metrics    *metrics.PumpMetrics
	positions  map[string]*types.Position
	trades     map[string][]*types.Trade
	mu         sync.RWMutex
	lastUpdate time.Time
}

func NewTradingMonitor(logger *zap.Logger, metrics *metrics.PumpMetrics) *TradingMonitor {
	return &TradingMonitor{
		logger:    logger,
		metrics:   metrics,
		positions: make(map[string]*types.Position),
		trades:    make(map[string][]*types.Trade),
	}
}

func (m *TradingMonitor) Start(ctx context.Context) error {
	m.logger.Info("Starting trading monitor")
	go m.monitorPositions(ctx)
	go m.monitorTrades(ctx)
	return nil
}

func (m *TradingMonitor) monitorPositions(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 5)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.updateMetrics()
		}
	}
}

func (m *TradingMonitor) monitorTrades(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 1)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.checkTradeStatus()
		}
	}
}

func (m *TradingMonitor) UpdatePosition(symbol string, position *types.Position) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.positions[symbol] = position
	m.lastUpdate = time.Now()

	m.metrics.PositionSize.WithLabelValues(symbol).Set(position.Size.InexactFloat64())
	m.metrics.PositionValue.WithLabelValues(symbol).Set(position.Value().InexactFloat64())
}

func (m *TradingMonitor) AddTrade(trade *types.Trade) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.trades[trade.Symbol] = append(m.trades[trade.Symbol], trade)
	m.metrics.TradeCount.WithLabelValues(trade.Symbol).Inc()
	m.metrics.TradeVolume.WithLabelValues(trade.Symbol).Add(trade.Size.InexactFloat64())
}

func (m *TradingMonitor) updateMetrics() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	totalValue := decimal.Zero
	for symbol, pos := range m.positions {
		value := pos.Value()
		totalValue = totalValue.Add(value)
		
		m.metrics.PositionPnL.WithLabelValues(symbol).Set(pos.UnrealizedPnL().InexactFloat64())
	}

	m.metrics.TotalValue.Set(totalValue.InexactFloat64())
	m.metrics.LastUpdate.Set(float64(m.lastUpdate.Unix()))
}

func (m *TradingMonitor) checkTradeStatus() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for symbol, trades := range m.trades {
		for _, trade := range trades {
			if trade.Status == types.TradeStatusPending {
				m.metrics.PendingTrades.WithLabelValues(symbol).Inc()
			}
		}
	}
}
