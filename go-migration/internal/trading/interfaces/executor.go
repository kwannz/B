package interfaces

import (
	"context"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/shopspring/decimal"
)

type Executor interface {
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
	GetRiskManager() RiskManager
}

type RiskManager interface {
	ValidatePosition(symbol string, size decimal.Decimal) error
	CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error)
	UpdateStopLoss(symbol string, price decimal.Decimal) error
	CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal)
}
