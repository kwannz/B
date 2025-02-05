package executor

import (
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/trading/strategy"
)

type Config struct {
	Logger   *zap.Logger
	Provider *pump.Provider
	Strategy strategy.Strategy
	APIKey   string
}
