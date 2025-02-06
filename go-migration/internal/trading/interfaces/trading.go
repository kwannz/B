package interfaces

import (
	"context"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Strategy interface {
	Name() string
	Init(ctx context.Context) error
	ProcessUpdate(update *types.TokenUpdate) error
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
	GetConfig() *types.PumpTradingConfig
}

// Using Executor and RiskManager interfaces from executor.go
