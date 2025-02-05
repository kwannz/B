package types

import (
	"time"
	"github.com/shopspring/decimal"
)

type Order struct {
	ID        string          `json:"id" bson:"_id"`
	UserID    string          `json:"user_id" bson:"user_id"`
	Symbol    string          `json:"symbol" bson:"symbol"`
	Side      OrderSide       `json:"side" bson:"side"`
	Type      OrderType       `json:"type" bson:"type"`
	Price     decimal.Decimal `json:"price" bson:"price"`
	Size      decimal.Decimal `json:"size" bson:"size"`
	FilledSize decimal.Decimal `json:"filled_size" bson:"filled_size"`
	Status    OrderStatus     `json:"status" bson:"status"`
	Provider  string          `json:"provider" bson:"provider"`
	CreatedAt time.Time       `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time       `json:"updated_at" bson:"updated_at"`
}
