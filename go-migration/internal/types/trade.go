package types

import (
	"time"
	"github.com/shopspring/decimal"
)

type Trade struct {
	ID         string            `json:"id" bson:"_id"`
	OrderID    string            `json:"order_id" bson:"order_id"`
	UserID     string            `json:"user_id" bson:"user_id"`
	Symbol     string            `json:"symbol" bson:"symbol"`
	Side       OrderSide         `json:"side" bson:"side"`
	Price      decimal.Decimal   `json:"price" bson:"price"`
	Size       decimal.Decimal   `json:"size" bson:"size"`
	Fee        decimal.Decimal   `json:"fee" bson:"fee"`
	Provider   string            `json:"provider" bson:"provider"`
	Status     OrderStatus       `json:"status" bson:"status"`
	Timestamp  time.Time         `json:"timestamp" bson:"timestamp"`
	StopLoss   decimal.Decimal   `json:"stop_loss,omitempty" bson:"stop_loss,omitempty"`
	TakeProfit []decimal.Decimal `json:"take_profit,omitempty" bson:"take_profit,omitempty"`
}
