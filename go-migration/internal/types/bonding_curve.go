package types

import (
	"time"
	"github.com/shopspring/decimal"
)

type BondingCurve struct {
	Symbol       string          `json:"symbol"`
	CurrentPrice decimal.Decimal `json:"current_price"`
	BasePrice    decimal.Decimal `json:"base_price"`
	Slope        decimal.Decimal `json:"slope"`
	Supply       int64           `json:"supply"`
	MaxSupply    int64           `json:"max_supply"`
	UpdateTime   time.Time       `json:"update_time"`
	MaxBuySize   decimal.Decimal `json:"max_buy_size"`
	MinBuySize   decimal.Decimal `json:"min_buy_size"`
}
