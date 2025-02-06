package mongodb

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TradingStorage struct {
	client   *mongo.Client
	database string
	logger   *zap.Logger
}

func NewTradingStorage(client *mongo.Client, database string, logger *zap.Logger) *TradingStorage {
	return &TradingStorage{
		client:   client,
		database: database,
		logger:   logger,
	}
}

func (s *TradingStorage) Initialize() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collections := []string{"orders", "positions", "trades"}
	for _, col := range collections {
		err := s.client.Database(s.database).CreateCollection(ctx, col)
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("failed to create collection %s: %w", col, err)
		}
	}
	return nil
}

func (s *TradingStorage) GetOrder(orderID string) (*types.Order, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var order types.Order
	err := s.client.Database(s.database).Collection("orders").FindOne(ctx, bson.M{"_id": orderID}).Decode(&order)
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *TradingStorage) SaveOrder(order *types.Order) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.client.Database(s.database).Collection("orders").UpdateOne(
		ctx,
		bson.M{"_id": order.ID},
		bson.M{"$set": order},
		options.Update().SetUpsert(true),
	)
	return err
}

func (s *TradingStorage) GetOrders(userID string) ([]*types.Order, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.client.Database(s.database).Collection("orders").Find(ctx, bson.M{"user_id": userID})
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

func (s *TradingStorage) SavePosition(position *types.Position) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.client.Database(s.database).Collection("positions").UpdateOne(
		ctx,
		bson.M{"symbol": position.Symbol, "user_id": position.UserID},
		bson.M{"$set": position},
		options.Update().SetUpsert(true),
	)
	return err
}

func (s *TradingStorage) GetPosition(symbol string) (*types.Position, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var position types.Position
	err := s.client.Database(s.database).Collection("positions").FindOne(ctx, bson.M{"symbol": symbol}).Decode(&position)
	if err != nil {
		return nil, err
	}
	return &position, nil
}

func (s *TradingStorage) GetPositions(userID string) ([]*types.Position, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.client.Database(s.database).Collection("positions").Find(ctx, bson.M{"user_id": userID})
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
