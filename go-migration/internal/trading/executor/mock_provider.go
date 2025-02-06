package executor

import (
	"context"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/mock"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type MockProvider struct {
	mock.Mock
}

func (m *MockProvider) GetTokenPrice(ctx context.Context, symbol string) (decimal.Decimal, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockProvider) GetTokenVolume(ctx context.Context, symbol string) (decimal.Decimal, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockProvider) GetBondingCurve(ctx context.Context, symbol string) (*types.BondingCurve, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(*types.BondingCurve), args.Error(1)
}

func (m *MockProvider) SubscribeNewTokens(ctx context.Context) (<-chan *types.TokenInfo, error) {
	args := m.Called(ctx)
	return args.Get(0).(<-chan *types.TokenInfo), args.Error(1)
}

func (m *MockProvider) GetTokenUpdates() <-chan *types.TokenUpdate {
	args := m.Called()
	return args.Get(0).(<-chan *types.TokenUpdate)
}
