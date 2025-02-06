package monitoring

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradeMonitor struct {
	logger     *zap.Logger
	metrics    *metrics.PumpMetrics
	positions  map[string]*types.Position
	trades     map[string][]*types.Trade
	mu         sync.RWMutex
	lastUpdate time.Time
}

func NewTradeMonitor(logger *zap.Logger, metrics *metrics.PumpMetrics) *TradeMonitor {
	return &TradeMonitor{
		logger:    logger,
		metrics:   metrics,
		positions: make(map[string]*types.Position),
		trades:    make(map[string][]*types.Trade),
	}
}

func (m *TradeMonitor) Start(ctx context.Context) error {
	m.logger.Info("Starting trade monitor")
	go m.monitorPositions(ctx)
	go m.monitorTrades(ctx)
	return nil
}

func (m *TradeMonitor) monitorPositions(ctx context.Context) {
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

func (m *TradeMonitor) monitorTrades(ctx context.Context) {
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

func (m *TradeMonitor) UpdatePosition(symbol string, position *types.Position) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.positions[symbol] = position
	m.lastUpdate = time.Now()

	if !position.Size.IsZero() {
		m.metrics.PositionSize.WithLabelValues(symbol).Set(position.Size.InexactFloat64())
	}
	if !position.UnrealizedPnL.IsZero() {
		m.metrics.UnrealizedPnL.WithLabelValues(symbol).Set(position.UnrealizedPnL.InexactFloat64())
	}
}

func (m *TradeMonitor) AddTrade(trade *types.Trade) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.trades[trade.Symbol] = append(m.trades[trade.Symbol], trade)
	m.metrics.TradeExecutions.WithLabelValues("success").Inc()
	m.metrics.TokenVolume.WithLabelValues("pump_fun", trade.Symbol).Add(trade.Size.InexactFloat64())

	if trade.Side == "buy" {
		m.metrics.TradeExecutions.WithLabelValues("buy").Inc()
	} else {
		m.metrics.TradeExecutions.WithLabelValues("sell").Inc()
	}
}

func (m *TradeMonitor) updateMetrics() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for symbol, pos := range m.positions {
		if !pos.UnrealizedPnL.IsZero() {
			m.metrics.UnrealizedPnL.WithLabelValues(symbol).Set(pos.UnrealizedPnL.InexactFloat64())
		}
	}
	m.metrics.LastUpdate.Set(float64(m.lastUpdate.Unix()))
}

func (m *TradeMonitor) checkTradeStatus() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, trades := range m.trades {
		var pendingCount int
		var executedCount int
		var failedCount int

		for _, trade := range trades {
			switch trade.Status {
			case "pending":
				pendingCount++
				m.metrics.TradeExecutions.WithLabelValues("pending").Inc()
			case "executed":
				executedCount++
				m.metrics.TradeExecutions.WithLabelValues("executed").Inc()
			case "failed":
				failedCount++
				m.metrics.TradeExecutions.WithLabelValues("failed").Inc()
			}
		}
	}
}

func (m *TradeMonitor) GetPositions() map[string]*types.Position {
	m.mu.RLock()
	defer m.mu.RUnlock()

	positions := make(map[string]*types.Position)
	for k, v := range m.positions {
		positions[k] = v
	}
	return positions
}

func (m *TradeMonitor) GetTrades(symbol string) []*types.Trade {
	m.mu.RLock()
	defer m.mu.RUnlock()

	trades := make([]*types.Trade, len(m.trades[symbol]))
	copy(trades, m.trades[symbol])
	return trades
}
