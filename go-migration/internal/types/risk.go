package types

import (
	"github.com/shopspring/decimal"
)

type ActiveStopLoss struct {
	StopPrice decimal.Decimal `yaml:"stop_price" json:"stop_price"`
	Position  *Position      `yaml:"position" json:"position"`
}

type RiskManager interface {
	ValidatePosition(symbol string, size decimal.Decimal) error
	CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error)
	UpdateStopLoss(symbol string, price decimal.Decimal) error
	CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal)
}

type RiskConfig struct {
	MaxPositionSize     decimal.Decimal `yaml:"max_position_size"`
	MinPositionSize     decimal.Decimal `yaml:"min_position_size"`
	MaxDrawdown         decimal.Decimal `yaml:"max_drawdown"`
	MaxDailyLoss       decimal.Decimal `yaml:"max_daily_loss"`
	MaxLeverage        decimal.Decimal `yaml:"max_leverage"`
	MinMarginLevel     decimal.Decimal `yaml:"min_margin_level"`
	MaxConcentration   decimal.Decimal `yaml:"max_concentration"`
	MinFee            *decimal.Decimal `yaml:"min_fee"`
	StopLoss           struct {
		Initial  decimal.Decimal `yaml:"initial"`
		Trailing decimal.Decimal `yaml:"trailing"`
	} `yaml:"stop_loss"`
	TakeProfitLevels   []ProfitLevel   `yaml:"take_profit_levels"`
}

// Using ProfitLevel from profit_level.go
