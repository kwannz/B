package trading

import (
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/stretchr/testify/mock"
)

type MockStorage struct {
	mock.Mock
}

func (m *MockStorage) SaveOrder(order *types.Order) error {
	args := m.Called(order)
	return args.Error(0)
}

func (m *MockStorage) GetOrder(orderID string) (*types.Order, error) {
	args := m.Called(orderID)
	return args.Get(0).(*types.Order), args.Error(1)
}

func (m *MockStorage) GetOrders(userID string) ([]*types.Order, error) {
	args := m.Called(userID)
	return args.Get(0).([]*types.Order), args.Error(1)
}

func (m *MockStorage) SavePosition(position *types.Position) error {
	args := m.Called(position)
	return args.Error(0)
}

func (m *MockStorage) GetPosition(symbol string) (*types.Position, error) {
	args := m.Called(symbol)
	return args.Get(0).(*types.Position), args.Error(1)
}

func (m *MockStorage) GetPositions(userID string) ([]*types.Position, error) {
	args := m.Called(userID)
	return args.Get(0).([]*types.Position), args.Error(1)
}
