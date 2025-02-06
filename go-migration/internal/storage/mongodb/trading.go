package mongodb

import (
	"context"

	"go.mongodb.org/mongo-driver/mongo"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/trading"
)

// TradingStorage implements trading.Storage interface
type TradingStorage struct {
	client *mongo.Client
	db     string
	logger *zap.Logger
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
func (s *TradingStorage) GetOrder(orderID string) (*trading.Order, error) {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	var order trading.Order
	err := collection.FindOne(ctx, bson.M{"_id": orderID}).Decode(&order)
	if err != nil {
		return nil, err
	}
	return &order, nil
}

// GetOrders implements trading.Storage interface
func (s *TradingStorage) GetOrders(userID string) ([]*trading.Order, error) {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	cursor, err := collection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var orders []*trading.Order
	if err := cursor.All(ctx, &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

// SaveOrder implements trading.Storage interface
func (s *TradingStorage) SaveOrder(order *trading.Order) error {
	collection := s.client.Database(s.db).Collection("orders")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, order)
	return err
}

// SaveTrade implements trading.Storage interface
func (s *TradingStorage) SaveTrade(trade *trading.Trade) error {
	collection := s.client.Database(s.db).Collection("trades")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, trade)
	return err
}

// SavePosition implements trading.Storage interface
func (s *TradingStorage) SavePosition(position *trading.Position) error {
	collection := s.client.Database(s.db).Collection("positions")
	ctx := context.Background()
	_, err := collection.InsertOne(ctx, position)
	return err
}
