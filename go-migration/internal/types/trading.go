package types

import (
	"time"
	"github.com/shopspring/decimal"
)

// RiskMetrics represents account risk metrics
type RiskMetrics struct {
	UserID          string          `json:"user_id"`
	TotalEquity     decimal.Decimal `json:"total_equity"`
	UsedMargin      decimal.Decimal `json:"used_margin"`
	AvailableMargin decimal.Decimal `json:"available_margin"`
	MarginLevel     decimal.Decimal `json:"margin_level"`
	DailyPnL        decimal.Decimal `json:"daily_pnl"`
	UpdateTime      time.Time       `json:"update_time"`
}
