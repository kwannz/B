package trading

import (
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// Storage interface for persisting trading data
type Storage interface {
	GetOrder(orderID string) (*types.Order, error)
	SaveOrder(order *types.Order) error
	GetOrders(userID string) ([]*types.Order, error)
	SavePosition(position *types.Position) error
	GetPosition(symbol string) (*types.Position, error)
	GetPositions(userID string) ([]*types.Position, error)
}
