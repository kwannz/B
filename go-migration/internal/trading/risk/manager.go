package risk

import (
	"fmt"
	"sync"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Manager struct {
	logger *zap.Logger
	config *types.RiskConfig
	mu     sync.RWMutex
}

func NewRiskManager(config *types.RiskConfig, logger *zap.Logger) *Manager {
	return &Manager{
		logger: logger,
		config: config,
	}
}

func (m *Manager) ValidatePosition(symbol string, size decimal.Decimal) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if size.LessThan(m.config.MinPositionSize) {
		metrics.PumpRiskLimits.WithLabelValues("min_size_violation").Set(size.InexactFloat64())
		return fmt.Errorf("position size %s below minimum %s", size, m.config.MinPositionSize)
	}

	if size.GreaterThan(m.config.MaxPositionSize) {
		metrics.PumpRiskLimits.WithLabelValues("max_size_violation").Set(size.InexactFloat64())
		return fmt.Errorf("position size %s above maximum %s", size, m.config.MaxPositionSize)
	}

	return nil
}

func (m *Manager) CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	maxSize := m.config.MaxPositionSize
	minSize := m.config.MinPositionSize
	size := maxSize.Div(price)

	if size.LessThan(minSize) {
		return minSize, nil
	}

	return size, nil
}

func (m *Manager) UpdateStopLoss(symbol string, price decimal.Decimal) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	stopLoss := price.Mul(decimal.NewFromFloat(1).Sub(m.config.StopLoss.Initial))
	metrics.PumpRiskLimits.WithLabelValues("stop_loss").Set(stopLoss.InexactFloat64())
	return nil
}

func (m *Manager) CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, level := range m.config.TakeProfitLevels {
		targetPrice := price.Mul(level.Multiplier)
		if price.GreaterThanOrEqual(targetPrice) {
			return true, level.Percentage
		}
	}

	return false, decimal.Zero
}
