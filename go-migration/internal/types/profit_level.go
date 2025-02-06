package types

import (
	"github.com/shopspring/decimal"
)

// ProfitLevel represents a take profit level configuration
type ProfitLevel struct {
	Multiplier  decimal.Decimal `yaml:"multiplier" json:"level"`      // Price multiple from entry (e.g., 2.0 = 200% of entry price)
	Percentage  decimal.Decimal `yaml:"percentage" json:"percentage"` // Percentage of position to sell at this level
}

// TakeProfit represents a take profit order
type TakeProfit struct {
	Price decimal.Decimal `json:"price"`  // Target price for take profit
	Size  decimal.Decimal `json:"size"`   // Size to sell at this price
}
