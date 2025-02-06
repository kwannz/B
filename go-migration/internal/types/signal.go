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
	Direction  string         `json:"direction"`
	Confidence float64        `json:"confidence"`
	Indicators []Indicator    `json:"indicators,omitempty"`
}

type MarketSignal struct {
	Symbol     string          `json:"symbol"`
	Type       string          `json:"type"`
	Direction  string          `json:"direction"`
	Price      decimal.Decimal `json:"price"`
	Confidence float64         `json:"confidence"`
	Timestamp  time.Time       `json:"timestamp"`
	Indicators []Indicator     `json:"indicators,omitempty"`
}
