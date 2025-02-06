package pump

import (
	"context"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Trader interface {
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
}
