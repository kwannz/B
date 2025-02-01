package dex

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockExchange struct {
	name      string
	price     float64
	liquidity float64
	orderBook *OrderBook
}

func (e *mockExchange) GetName() string {
	return e.name
}

func (e *mockExchange) GetLiquidity(ctx context.Context, pair string) (float64, error) {
	return e.liquidity, nil
}

func (e *mockExchange) GetPrice(ctx context.Context, pair string) (float64, error) {
	return e.price, nil
}

func (e *mockExchange) GetOrderBook(ctx context.Context, pair string) (*OrderBook, error) {
	return e.orderBook, nil
}

func TestAggregator(t *testing.T) {
	// Create test config
	config := &Config{
		CacheTTL:           time.Second,
		ParallelQueries:    2,
		RetryAttempts:      2,
		RetryDelay:         time.Millisecond * 50,
		MinLiquidity:       100.0,
		PriceSlippageLimit: 0.01,
		RedisURL:           "redis://localhost:6379/1",
	}

	// Create aggregator
	aggregator, err := NewAggregator(config)
	require.NoError(t, err)
	defer aggregator.Close()

	// Register mock exchanges
	exchanges := []*mockExchange{
		{
			name:      "Exchange1",
			price:     50000.0,
			liquidity: 1000.0,
			orderBook: &OrderBook{
				Bids: []Order{{Price: 50000.0, Amount: 1.0}, {Price: 49900.0, Amount: 2.0}},
				Asks: []Order{{Price: 50100.0, Amount: 1.0}, {Price: 50200.0, Amount: 2.0}},
			},
		},
		{
			name:      "Exchange2",
			price:     50100.0,
			liquidity: 2000.0,
			orderBook: &OrderBook{
				Bids: []Order{{Price: 50050.0, Amount: 1.5}, {Price: 49950.0, Amount: 2.5}},
				Asks: []Order{{Price: 50150.0, Amount: 1.5}, {Price: 50250.0, Amount: 2.5}},
			},
		},
	}

	for _, ex := range exchanges {
		aggregator.RegisterExchange(ex)
	}

	t.Run("GetBestPrice", func(t *testing.T) {
		testCases := []struct {
			name          string
			pair          string
			isBuy         bool
			expectedPrice float64
			expectedEx    string
		}{
			{
				name:          "Best buy price",
				pair:          "BTC-USD",
				isBuy:         true,
				expectedPrice: 50000.0,
				expectedEx:    "Exchange1",
			},
			{
				name:          "Best sell price",
				pair:          "BTC-USD",
				isBuy:         false,
				expectedPrice: 50100.0,
				expectedEx:    "Exchange2",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				price, ex, err := aggregator.GetBestPrice(context.Background(), tc.pair, tc.isBuy)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedPrice, price)
				assert.Equal(t, tc.expectedEx, ex)
			})
		}
	})

	t.Run("GetAggregatedOrderBook", func(t *testing.T) {
		ob, err := aggregator.GetAggregatedOrderBook(context.Background(), "BTC-USD")
		require.NoError(t, err)

		// Verify bids are sorted in descending order
		for i := 1; i < len(ob.Bids); i++ {
			assert.True(t, ob.Bids[i-1].Price > ob.Bids[i].Price)
		}

		// Verify asks are sorted in ascending order
		for i := 1; i < len(ob.Asks); i++ {
			assert.True(t, ob.Asks[i-1].Price < ob.Asks[i].Price)
		}

		// Verify merged price levels
		assert.Equal(t, 4, len(ob.Bids))
		assert.Equal(t, 4, len(ob.Asks))
	})

	t.Run("GetLiquidityScore", func(t *testing.T) {
		score, err := aggregator.GetLiquidityScore(context.Background(), "BTC-USD")
		require.NoError(t, err)
		assert.Equal(t, 3000.0, score)
	})

	t.Run("Cache functionality", func(t *testing.T) {
		// Get price first time
		price1, _, err := aggregator.GetBestPrice(context.Background(), "BTC-USD", true)
		require.NoError(t, err)

		// Change exchange price
		exchanges[0].price = 49900.0

		// Get price again within cache TTL
		price2, ex2, err := aggregator.GetBestPrice(context.Background(), "BTC-USD", true)
		require.NoError(t, err)

		// Should get cached price
		assert.Equal(t, price1, price2)
		assert.Equal(t, "cache", ex2)

		// Wait for cache to expire
		time.Sleep(config.CacheTTL + time.Millisecond*100)

		// Get price again after cache expiry
		price3, ex3, err := aggregator.GetBestPrice(context.Background(), "BTC-USD", true)
		require.NoError(t, err)

		// Should get new price
		assert.Equal(t, 49900.0, price3)
		assert.Equal(t, "Exchange1", ex3)
	})
}

func TestMergeSamePriceLevels(t *testing.T) {
	testCases := []struct {
		name     string
		orders   []Order
		expected []Order
	}{
		{
			name: "Merge same prices",
			orders: []Order{
				{Price: 100.0, Amount: 1.0},
				{Price: 100.0, Amount: 2.0},
				{Price: 200.0, Amount: 3.0},
				{Price: 200.0, Amount: 4.0},
			},
			expected: []Order{
				{Price: 100.0, Amount: 3.0},
				{Price: 200.0, Amount: 7.0},
			},
		},
		{
			name: "No merge needed",
			orders: []Order{
				{Price: 100.0, Amount: 1.0},
				{Price: 200.0, Amount: 2.0},
				{Price: 300.0, Amount: 3.0},
			},
			expected: []Order{
				{Price: 100.0, Amount: 1.0},
				{Price: 200.0, Amount: 2.0},
				{Price: 300.0, Amount: 3.0},
			},
		},
		{
			name:     "Empty orders",
			orders:   []Order{},
			expected: []Order{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := mergeSamePriceLevels(tc.orders)
			assert.Equal(t, tc.expected, result)
		})
	}
}
