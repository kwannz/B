package pump

import (
	"context"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type MarketData interface {
	GetTokenUpdates() <-chan *types.TokenUpdate
	GetBondingCurve(ctx context.Context, symbol string) (*types.BondingCurve, error)
	SubscribeNewTokens(ctx context.Context) (<-chan *types.TokenInfo, error)
}
