package strategy

import (
	"context"
	"testing"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

type mockPumpTrader struct {
	mock.Mock
}

func (m *mockPumpTrader) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
	args := m.Called(ctx, signal)
	return args.Error(0)
}

func (m *mockPumpTrader) GetPosition(symbol string) *types.Position {
	args := m.Called(symbol)
	return args.Get(0).(*types.Position)
}

func (m *mockPumpTrader) GetPositions() map[string]*types.Position {
	args := m.Called()
	return args.Get(0).(map[string]*types.Position)
}

func (m *mockPumpTrader) Start() error {
	args := m.Called()
	return args.Error(0)
}

func (m *mockPumpTrader) Stop() error {
	args := m.Called()
	return args.Error(0)
}

type mockPumpMarketData struct {
	mock.Mock
}

func (m *mockPumpMarketData) GetTokenPrice(ctx context.Context, symbol string) (float64, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(float64), args.Error(1)
}

func (m *mockPumpMarketData) GetTokenVolume(ctx context.Context, symbol string) (float64, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(float64), args.Error(1)
}

func (m *mockPumpMarketData) GetBondingCurve(ctx context.Context, symbol string) (*types.TokenBondingCurve, error) {
	args := m.Called(ctx, symbol)
	return args.Get(0).(*types.TokenBondingCurve), args.Error(1)
}

func (m *mockPumpMarketData) SubscribeNewTokens(ctx context.Context) (<-chan *types.TokenInfo, error) {
	args := m.Called(ctx)
	return args.Get(0).(<-chan *types.TokenInfo), args.Error(1)
}

func (m *mockPumpMarketData) GetTokenUpdates() <-chan *types.TokenUpdate {
	args := m.Called()
	return args.Get(0).(<-chan *types.TokenUpdate)
}

type mockPumpRiskManager struct {
	mock.Mock
}

func (m *mockPumpRiskManager) ValidatePosition(symbol string, size float64) error {
	args := m.Called(symbol, size)
	return args.Error(0)
}

func (m *mockPumpRiskManager) CalculatePositionSize(symbol string, price float64) (float64, error) {
	args := m.Called(symbol, price)
	return args.Get(0).(float64), args.Error(1)
}

func (m *mockPumpRiskManager) UpdateStopLoss(symbol string, price float64) error {
	args := m.Called(symbol, price)
	return args.Error(0)
}

func (m *mockPumpRiskManager) CheckTakeProfit(symbol string, price float64) (bool, float64) {
	args := m.Called(symbol, price)
	return args.Bool(0), args.Get(1).(float64)
}

func TestPumpStrategy_ProcessUpdate(t *testing.T) {
	logger := zap.NewNop()
	config := &types.PumpTradingConfig{
		MaxMarketCap: 30000.0,
		MinVolume:    1000.0,
	}

	trader := new(mockPumpTrader)
	marketData := new(mockPumpMarketData)
	riskMgr := new(mockPumpRiskManager)

	strategy := NewPumpStrategy(logger, config, riskMgr, marketData, trader)

	t.Run("should process valid token update", func(t *testing.T) {
		update := &types.TokenUpdate{
			Symbol:    "TEST/SOL",
			Price:     100.0,
			MarketCap: 20000.0,
			Volume:    2000.0,
			Timestamp: time.Now(),
		}

		riskMgr.On("CalculatePositionSize", update.Symbol, update.Price).Return(1.0, nil)
		trader.On("ExecuteTrade", mock.Anything, mock.MatchedBy(func(signal *types.Signal) bool {
			return signal.Symbol == update.Symbol &&
				signal.Price == update.Price &&
				signal.Side == types.OrderSideBuy
		})).Return(nil)

		err := strategy.ProcessUpdate(update)
		assert.NoError(t, err)

		riskMgr.AssertExpectations(t)
		trader.AssertExpectations(t)
	})

	t.Run("should skip update with high market cap", func(t *testing.T) {
		update := &types.TokenUpdate{
			Symbol:    "TEST/SOL",
			Price:     100.0,
			MarketCap: 40000.0,
			Volume:    2000.0,
			Timestamp: time.Now(),
		}

		err := strategy.ProcessUpdate(update)
		assert.NoError(t, err)

		riskMgr.AssertNotCalled(t, "CalculatePositionSize")
		trader.AssertNotCalled(t, "ExecuteTrade")
	})

	t.Run("should skip update with low volume", func(t *testing.T) {
		update := &types.TokenUpdate{
			Symbol:    "TEST/SOL",
			Price:     100.0,
			MarketCap: 20000.0,
			Volume:    500.0,
			Timestamp: time.Now(),
		}

		err := strategy.ProcessUpdate(update)
		assert.NoError(t, err)

		riskMgr.AssertNotCalled(t, "CalculatePositionSize")
		trader.AssertNotCalled(t, "ExecuteTrade")
	})

	t.Run("should handle existing position", func(t *testing.T) {
		update := &types.TokenUpdate{
			Symbol:    "TEST/SOL",
			Price:     200.0,
			MarketCap: 20000.0,
			Volume:    2000.0,
			Timestamp: time.Now(),
		}

		position := &types.Position{
			Symbol: update.Symbol,
			Size:   1.0,
		}
		strategy.positions[update.Symbol] = position

		riskMgr.On("UpdateStopLoss", update.Symbol, update.Price).Return(nil)
		riskMgr.On("CheckTakeProfit", update.Symbol, update.Price).Return(true, 0.2)
		trader.On("ExecuteTrade", mock.Anything, mock.MatchedBy(func(signal *types.Signal) bool {
			return signal.Symbol == update.Symbol &&
				signal.Price == update.Price &&
				signal.Side == types.OrderSideSell &&
				signal.Size == position.Size*0.2
		})).Return(nil)

		err := strategy.ProcessUpdate(update)
		assert.NoError(t, err)

		riskMgr.AssertExpectations(t)
		trader.AssertExpectations(t)
	})
}
