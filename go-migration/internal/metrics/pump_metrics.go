package metrics

import (
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

type PumpMetrics struct {
	logger *zap.Logger
}

func NewPumpMetrics() *PumpMetrics {
	return &PumpMetrics{
		logger: zap.L(),
	}
}

func (m *PumpMetrics) RecordNewToken(token *types.TokenInfo) {
	m.logger.Info("New token metrics",
		zap.String("symbol", token.Symbol),
		zap.String("name", token.Name),
		zap.Float64("market_cap", token.MarketCap),
		zap.Int64("supply", token.Supply))
}

func (m *PumpMetrics) RecordBondingCurve(curve *types.BondingCurve) {
	m.logger.Info("Bonding curve metrics",
		zap.String("symbol", curve.Symbol),
		zap.Float64("current_price", curve.CurrentPrice),
		zap.Float64("base_price", curve.BasePrice),
		zap.Int64("supply", curve.Supply))
}
