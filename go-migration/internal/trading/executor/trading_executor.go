package executor

import (
	"context"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradingExecutor interface {
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
	GetPosition(symbol string) *types.Position
	GetPositions() map[string]*types.Position
	Start() error
	Stop() error
}
