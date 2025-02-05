package types

import (
	"time"
	"github.com/shopspring/decimal"
)

type SignalType string

const (
	SignalTypeBuy  SignalType = "buy"
	SignalTypeSell SignalType = "sell"
)

type Signal struct {
	Symbol     string          `json:"symbol"`
	Type       SignalType      `json:"type"`
	Amount     decimal.Decimal `json:"amount"`
	Price      decimal.Decimal `json:"price"`
	Provider   string         `json:"provider"`
	Timestamp  time.Time      `json:"timestamp"`
}
