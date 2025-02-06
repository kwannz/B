package types

import (
	"sync"
	"time"
	"github.com/shopspring/decimal"
)

type Position struct {
	UserID        string            `json:"user_id" bson:"user_id"`
	Symbol        string            `json:"symbol" bson:"symbol"`
	Size          decimal.Decimal   `json:"size" bson:"size"`
	Value         decimal.Decimal   `json:"value" bson:"value"`
	EntryPrice    decimal.Decimal   `json:"entry_price" bson:"entry_price"`
	CurrentPrice  decimal.Decimal   `json:"current_price" bson:"current_price"`
	UnrealizedPnL decimal.Decimal   `json:"unrealized_pnl" bson:"unrealized_pnl"`
	RealizedPnL   decimal.Decimal   `json:"realized_pnl" bson:"realized_pnl"`
	CreatedAt     time.Time         `json:"created_at" bson:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" bson:"updated_at"`
	StopLoss      decimal.Decimal   `json:"stop_loss" bson:"stop_loss"`
	TakeProfit    []decimal.Decimal `json:"take_profit" bson:"take_profit"`

	// Track which profit levels have been taken
	takenProfits map[string]bool
	mu           sync.RWMutex
}

func NewPosition(symbol string, size decimal.Decimal, entryPrice decimal.Decimal) *Position {
	now := time.Now()
	stopLoss := entryPrice.Mul(decimal.NewFromFloat(0.85))  // 15% stop loss
	takeProfits := []decimal.Decimal{
		entryPrice.Mul(decimal.NewFromFloat(2.0)),  // 2x take profit
		entryPrice.Mul(decimal.NewFromFloat(3.0)),  // 3x take profit
		entryPrice.Mul(decimal.NewFromFloat(5.0)),  // 5x take profit
	}
	return &Position{
		Symbol:       symbol,
		Size:         size,
		Value:        size.Mul(entryPrice),
		EntryPrice:   entryPrice,
		CurrentPrice: entryPrice,
		CreatedAt:    now,
		UpdatedAt:    now,
		StopLoss:     stopLoss,
		TakeProfit:   takeProfits,
		takenProfits: make(map[string]bool),
	}
}

func (p *Position) HasTakenProfitAt(level decimal.Decimal) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.takenProfits[level.String()]
}

func (p *Position) MarkTakenProfitAt(level decimal.Decimal) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.takenProfits[level.String()] = true
}

func (p *Position) GetTakenProfits() []decimal.Decimal {
	p.mu.RLock()
	defer p.mu.RUnlock()
	
	var levels []decimal.Decimal
	for levelStr, taken := range p.takenProfits {
		if taken {
			level, _ := decimal.NewFromString(levelStr)
			levels = append(levels, level)
		}
	}
	return levels
}

func (p *Position) UpdatePrice(price decimal.Decimal) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.CurrentPrice = price
	p.Value = p.Size.Mul(price)
	p.UpdatedAt = time.Now()
}
