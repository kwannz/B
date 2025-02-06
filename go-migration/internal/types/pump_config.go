package types

import (
	"github.com/shopspring/decimal"
)

type PumpConfig struct {
	RiskConfig           *RiskConfig      `yaml:"risk_config"`
	MinMarketCap        decimal.Decimal  `yaml:"min_market_cap"`
	MaxMarketCap        decimal.Decimal  `yaml:"max_market_cap"`
	MinVolume           decimal.Decimal  `yaml:"min_volume"`
	PriceChangeThreshold decimal.Decimal  `yaml:"price_change_threshold"`
}
