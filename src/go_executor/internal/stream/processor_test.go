package stream

import (
	"context"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockHandler struct {
	messages []*Message
}

func (h *mockHandler) Handle(_ context.Context, msg *Message) error {
	h.messages = append(h.messages, msg)
	return nil
}

func TestProcessor(t *testing.T) {
	// Start NATS server
	ns, err := nats.Connect(nats.DefaultURL)
	require.NoError(t, err)
	defer ns.Close()

	// Create test config
	config := &StreamConfig{
		NatsURL:            nats.DefaultURL,
		InputSubject:       "test.market.data",
		OutputSubject:      "test.market.processed",
		BatchSize:          10,
		ProcessingInterval: 100 * time.Millisecond,
		MaxRetries:         3,
		RetryDelay:         time.Millisecond * 100,
	}

	// Create processor
	processor, err := NewProcessor(config)
	require.NoError(t, err)
	defer processor.Stop()

	// Create mock handler
	handler := &mockHandler{messages: make([]*Message, 0)}
	processor.RegisterHandler("BTC-USD", handler)

	// Start processor
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		err := processor.Start(ctx)
		require.NoError(t, err)
	}()

	// Wait for processor to start
	time.Sleep(time.Second)

	// Test message processing
	testCases := []struct {
		name     string
		message  *Message
		expected bool
	}{
		{
			name: "Valid message",
			message: &Message{
				Symbol:    "BTC-USD",
				Price:     50000.0,
				Volume:    1.5,
				Timestamp: time.Now(),
				Source:    "test",
			},
			expected: true,
		},
		{
			name: "Unregistered symbol",
			message: &Message{
				Symbol:    "ETH-USD",
				Price:     3000.0,
				Volume:    10.0,
				Timestamp: time.Now(),
				Source:    "test",
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Publish test message
			err := processor.Publish(tc.message)
			require.NoError(t, err)

			// Wait for message processing
			time.Sleep(200 * time.Millisecond)

			// Verify message handling
			if tc.expected {
				assert.Contains(t, handler.messages, tc.message)
			} else {
				assert.NotContains(t, handler.messages, tc.message)
			}
		})
	}
}

func TestProcessorBatchProcessing(t *testing.T) {
	// Start NATS server
	ns, err := nats.Connect(nats.DefaultURL)
	require.NoError(t, err)
	defer ns.Close()

	// Create test config with small batch size
	config := &StreamConfig{
		NatsURL:            nats.DefaultURL,
		InputSubject:       "test.market.batch",
		OutputSubject:      "test.batch.processed",
		BatchSize:          5,
		ProcessingInterval: 50 * time.Millisecond,
		MaxRetries:         3,
		RetryDelay:         time.Millisecond * 50,
	}

	// Create processor
	processor, err := NewProcessor(config)
	require.NoError(t, err)
	defer processor.Stop()

	// Create mock handler
	handler := &mockHandler{messages: make([]*Message, 0)}
	processor.RegisterHandler("BTC-USD", handler)

	// Start processor
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		err := processor.Start(ctx)
		require.NoError(t, err)
	}()

	// Wait for processor to start
	time.Sleep(time.Second)

	// Send batch of messages
	messages := make([]*Message, 10)
	for i := 0; i < 10; i++ {
		messages[i] = &Message{
			Symbol:    "BTC-USD",
			Price:     50000.0 + float64(i),
			Volume:    1.5,
			Timestamp: time.Now(),
			Source:    "test",
		}
		err := processor.Publish(messages[i])
		require.NoError(t, err)
	}

	// Wait for batch processing
	time.Sleep(300 * time.Millisecond)

	// Verify all messages were processed
	assert.Equal(t, len(messages), len(handler.messages))
	for _, msg := range messages {
		assert.Contains(t, handler.messages, msg)
	}
}

func TestProcessorErrorHandling(t *testing.T) {
	// Start NATS server
	ns, err := nats.Connect(nats.DefaultURL)
	require.NoError(t, err)
	defer ns.Close()

	// Create test config
	config := &StreamConfig{
		NatsURL:            nats.DefaultURL,
		InputSubject:       "test.market.errors",
		OutputSubject:      "test.errors.processed",
		BatchSize:          10,
		ProcessingInterval: 100 * time.Millisecond,
		MaxRetries:         3,
		RetryDelay:         time.Millisecond * 100,
	}

	// Create processor
	processor, err := NewProcessor(config)
	require.NoError(t, err)
	defer processor.Stop()

	// Test invalid message
	err = processor.Publish(&Message{Symbol: ""})
	assert.Error(t, err)

	// Test connection error handling
	processor.Stop()
	err = processor.Publish(&Message{Symbol: "BTC-USD"})
	assert.Error(t, err)
}
