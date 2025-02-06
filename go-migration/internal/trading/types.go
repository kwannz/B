package trading

import (
	"time"
	"github.com/shopspring/decimal"
)

// OrderBookLevel represents a price level in the order book
type OrderBookLevel struct {
	Price    decimal.Decimal `json:"price"`
	Amount   decimal.Decimal `json:"amount"`
}

// OrderBook represents the current market state
type OrderBook struct {
	Symbol     string           `json:"symbol"`
	Bids       []OrderBookLevel `json:"bids"`
	Asks       []OrderBookLevel `json:"asks"`
	UpdateTime time.Time        `json:"update_time"`
}

// Trade represents an executed trade
type Trade struct {
	Provider  string          `json:"provider"`
	Symbol    string          `json:"symbol"`
	Side      string          `json:"side"`
	Size      decimal.Decimal `json:"size"`
	Price     decimal.Decimal `json:"price"`
	Timestamp time.Time       `json:"timestamp"`
}
