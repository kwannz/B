package trading

import (
	"time"
	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// Trade represents an executed trade
type Trade struct {
	Provider  string          `json:"provider"`
	Symbol    string          `json:"symbol"`
	Side      string          `json:"side"`
	Size      decimal.Decimal `json:"size"`
	Price     decimal.Decimal `json:"price"`
	Timestamp time.Time       `json:"timestamp"`
}
