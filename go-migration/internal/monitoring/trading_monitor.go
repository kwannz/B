package monitoring

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradingMonitor struct {
	logger     *zap.Logger
	metrics    *metrics.PumpMetrics
	positions  map[string]*types.Position
	mu         sync.RWMutex
	lastUpdate time.Time
}

func NewTradingMonitor(logger *zap.Logger, metrics *metrics.PumpMetrics) *TradingMonitor {
	return &TradingMonitor{
		logger:    logger,
		metrics:   metrics,
		positions: make(map[string]*types.Position),
	}
}

func (m *TradingMonitor) Start(ctx context.Context) error {
	m.logger.Info("Starting trading monitor")
	go m.monitorPositions(ctx)
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

func (m *TradingMonitor) UpdatePosition(symbol string, position *types.Position) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.positions[symbol] = position
	m.lastUpdate = time.Now()

	// Update position metrics
	if !position.Size.IsZero() {
		m.metrics.PositionSize.WithLabelValues(symbol).Set(position.Size.InexactFloat64())
	}
	if !position.UnrealizedPnL.IsZero() {
		m.metrics.UnrealizedPnL.WithLabelValues(symbol).Set(position.UnrealizedPnL.InexactFloat64())
	}
}

func (m *TradingMonitor) updateMetrics() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for symbol, pos := range m.positions {
		if !pos.Size.IsZero() {
			m.metrics.PositionSize.WithLabelValues(symbol).Set(pos.Size.InexactFloat64())
		}
		if !pos.UnrealizedPnL.IsZero() {
			m.metrics.UnrealizedPnL.WithLabelValues(symbol).Set(pos.UnrealizedPnL.InexactFloat64())
		}
	}
	m.metrics.LastUpdate.Set(float64(m.lastUpdate.Unix()))
}
