package strategy

import (
	"context"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Strategy interface {
	Evaluate(ctx context.Context, token *types.TokenMarketInfo) (bool, error)
	CalculatePositionSize(price decimal.Decimal) (decimal.Decimal, error)
	ValidatePosition(size decimal.Decimal) error
	GetLogger() *zap.Logger
}
