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
		metrics.GMGNRiskLimits.WithLabelValues("min_size_violation").Set(size.InexactFloat64())
		return fmt.Errorf("position size %s below minimum %s", size, m.config.MinPositionSize)
	}

	if size.GreaterThan(m.config.MaxPositionSize) {
		metrics.GMGNRiskLimits.WithLabelValues("max_size_violation").Set(size.InexactFloat64())
		return fmt.Errorf("position size %s above maximum %s", size, m.config.MaxPositionSize)
	}

	if m.config.MinFee != nil && m.config.MinFee.LessThan(decimal.NewFromFloat(0.002)) {
		metrics.GMGNRiskLimits.WithLabelValues("min_fee_violation").Set(m.config.MinFee.InexactFloat64())
		return fmt.Errorf("fee %s below minimum required for anti-MEV protection (0.002)", m.config.MinFee)
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
		metrics.GMGNRiskLimits.WithLabelValues("min_size_adjusted").Set(minSize.InexactFloat64())
		return minSize, nil
	}

	// Check concentration limit
	if !m.config.MaxConcentration.IsZero() {
		if size.GreaterThan(maxSize.Mul(m.config.MaxConcentration)) {
			size = maxSize.Mul(m.config.MaxConcentration)
			metrics.GMGNRiskLimits.WithLabelValues("concentration_limit").Set(size.InexactFloat64())
		}
	}

	metrics.GMGNRiskLimits.WithLabelValues("position_size").Set(size.InexactFloat64())
	return size, nil
}

func (m *Manager) UpdateStopLoss(symbol string, price decimal.Decimal) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	stopLoss := price.Mul(decimal.NewFromFloat(1).Sub(m.config.StopLoss.Initial))
	metrics.GMGNRiskLimits.WithLabelValues("stop_loss").Set(stopLoss.InexactFloat64())

	// Update trailing stop loss if enabled
	if !m.config.StopLoss.Trailing.IsZero() {
		trailingStop := price.Mul(decimal.NewFromFloat(1).Sub(m.config.StopLoss.Trailing))
		metrics.GMGNRiskLimits.WithLabelValues("trailing_stop").Set(trailingStop.InexactFloat64())
	}

	return nil
}

func (m *Manager) CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, level := range m.config.TakeProfitLevels {
		targetPrice := price.Mul(level.Multiplier)
		if price.GreaterThanOrEqual(targetPrice) {
			metrics.GMGNRiskLimits.WithLabelValues("take_profit_hit").Set(price.InexactFloat64())
			return true, level.Percentage
		}
	}

	metrics.GMGNRiskLimits.WithLabelValues("current_price").Set(price.InexactFloat64())
	return false, decimal.Zero
}
