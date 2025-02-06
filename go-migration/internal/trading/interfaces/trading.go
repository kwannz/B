package interfaces

import (
	"context"

	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Strategy interface {
	Name() string
	Init(ctx context.Context) error
	ProcessUpdate(update *types.TokenUpdate) error
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
	GetConfig() *types.PumpTradingConfig
}

type Executor interface {
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
	GetRiskManager() RiskManager
}

type RiskManager interface {
	UpdateStopLoss(symbol string, price decimal.Decimal) error
	CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal)
	CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error)
}
