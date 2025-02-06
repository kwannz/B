package types

import (
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/mock"
)

type MockRiskManager struct {
	mock.Mock
}

func (m *MockRiskManager) ValidatePosition(symbol string, size decimal.Decimal) error {
	args := m.Called(symbol, size)
	return args.Error(0)
}

func (m *MockRiskManager) CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error) {
	args := m.Called(symbol, price)
	return args.Get(0).(decimal.Decimal), args.Error(1)
}

func (m *MockRiskManager) UpdateStopLoss(symbol string, price decimal.Decimal) error {
	args := m.Called(symbol, price)
	return args.Error(0)
}

func (m *MockRiskManager) CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal) {
	args := m.Called(symbol, price)
	return args.Bool(0), args.Get(1).(decimal.Decimal)
}
