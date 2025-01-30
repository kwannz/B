package server

import (
    "context"
    "sync"
    "time"
    "errors"
)

type Order struct {
    Symbol     string
    Side       string
    Amount     float64
    Price      float64
    OrderType  string
    Parameters map[string]string
}

type OrderResult struct {
    OrderID        string
    Status         string
    ExecutedPrice  float64
    ExecutedAmount float64
    Fee           float64
    Metadata      map[string]string
}

type OrderBookLevel struct {
    Price  float64
    Amount float64
}

type OrderBook struct {
    Bids []OrderBookLevel
    Asks []OrderBookLevel
}

type MarketData struct {
    Symbol    string
    Price     float64
    Volume    float64
    Bid       float64
    Ask       float64
    Timestamp int64
}

type OrderManager struct{}

func NewOrderManager() *OrderManager {
    return &OrderManager{}
}

func (m *OrderManager) ExecuteOrder(ctx context.Context, order *Order) (*OrderResult, error) {
    // Simplified implementation for testing
    return &OrderResult{
        OrderID:        "test_order_id",
        Status:         "filled",
        ExecutedPrice:  order.Price,
        ExecutedAmount: order.Amount,
        Fee:           0.001 * order.Price * order.Amount,
        Metadata:      map[string]string{"source": "test"},
    }, nil
}

type MarketDataManager struct{}

func NewMarketDataManager() *MarketDataManager {
    return &MarketDataManager{}
}

func (m *MarketDataManager) StreamData(symbol, dataType string, depth int32, dataChan chan<- *MarketData, errChan chan<- error) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            dataChan <- &MarketData{
                Symbol:    symbol,
                Price:    100.0,
                Volume:   1000.0,
                Bid:      99.9,
                Ask:      100.1,
                Timestamp: time.Now().Unix(),
            }
        }
    }
}

type RateLimiter struct {
    lastRequest time.Time
    interval    time.Duration
    mu          sync.Mutex
}

func NewRateLimiter() *RateLimiter {
    return &RateLimiter{
        interval: time.Millisecond * 100,
    }
}

func (r *RateLimiter) Allow() error {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    now := time.Now()
    if now.Sub(r.lastRequest) < r.interval {
        return errors.New("rate limit exceeded")
    }
    r.lastRequest = now
    return nil
}

func (r *RateLimiter) ResetBatch() {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.lastRequest = time.Time{} // Reset to zero time
}

func NewOrderBook() *OrderBook {
    return &OrderBook{
        Bids: make([]OrderBookLevel, 0),
        Asks: make([]OrderBookLevel, 0),
    }
}
