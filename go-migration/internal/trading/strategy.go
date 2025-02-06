package trading

import (
	"context"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Strategy interface {
	Name() string
	ProcessUpdate(update *types.TokenUpdate) error
	Init(ctx context.Context) error
}
