package mongodb

import (
	"context"
	"fmt"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// TradingStorage implements trading.Storage interface
type TradingStorage struct {
	client *mongo.Client
	db     string
	logger *zap.Logger
}

// Initialize initializes the storage collections
func (s *TradingStorage) Initialize() error {
	ctx := context.Background()
	collections := []string{"orders", "trades", "positions"}
	for _, col := range collections {
		err := s.client.Database(s.db).CreateCollection(ctx, col)
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("failed to create collection %s: %w", col, err)
		}
	}
	return nil
}

// NewTradingStorage creates a new trading storage
func NewTradingStorage(client *mongo.Client, db string, logger *zap.Logger) *TradingStorage {
	return &TradingStorage{
		client: client,
		db:     db,
		logger: logger,
	}
}

// GetOrder implements trading.Storage interface
func (s *TradingStorage) GetOrder(orderID string) (*types.Order, error) {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	var order types.Order
	err := collection.FindOne(ctx, bson.M{"_id": orderID}).Decode(&order)
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// GetOrders implements trading.Storage interface
func (s *TradingStorage) GetOrders(userID string) ([]*types.Order, error) {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	cursor, err := collection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var orders []*types.Order
	if err := cursor.All(ctx, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

// SaveOrder implements trading.Storage interface
func (s *TradingStorage) SaveOrder(order *types.Order) error {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, order)
	return err
}

// SaveTrade implements trading.Storage interface
func (s *TradingStorage) SaveTrade(trade *types.Trade) error {
	collection := s.client.Database(s.db).Collection("trades")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, trade)
	return err
}

// SavePosition implements trading.Storage interface
func (s *TradingStorage) SavePosition(position *types.Position) error {
	collection := s.client.Database(s.db).Collection("positions")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, position)
	return err
}

// GetPosition implements trading.Storage interface
func (s *TradingStorage) GetPosition(symbol string) (*types.Position, error) {
	collection := s.client.Database(s.db).Collection("positions")
	ctx := context.Background()
	var position types.Position
	err := collection.FindOne(ctx, bson.M{"symbol": symbol}).Decode(&position)
	if err != nil {
		return nil, err
	}
	return &position, nil
}

// GetPositions implements trading.Storage interface
func (s *TradingStorage) GetPositions(userID string) ([]*types.Position, error) {
	collection := s.client.Database(s.db).Collection("positions")
	ctx := context.Background()
	cursor, err := collection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var positions []*types.Position
	if err := cursor.All(ctx, &positions); err != nil {
		return nil, err
	}
	return positions, nil
}
