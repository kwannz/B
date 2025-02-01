package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

// StreamConfig holds configuration for stream processing
type StreamConfig struct {
	NatsURL            string
	InputSubject       string
	OutputSubject      string
	BatchSize          int
	ProcessingInterval time.Duration
	MaxRetries         int
	RetryDelay         time.Duration
}

// DefaultConfig returns default configuration
func DefaultConfig() *StreamConfig {
	return &StreamConfig{
		NatsURL:            "nats://localhost:4222",
		BatchSize:          1000,
		ProcessingInterval: 100 * time.Millisecond,
		MaxRetries:         3,
		RetryDelay:         time.Second,
	}
}

// Message represents a market data message
type Message struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Volume    float64   `json:"volume"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"`
}

// Processor handles real-time data processing
type Processor struct {
	mu       sync.RWMutex
	config   *StreamConfig
	nc       *nats.Conn
	js       nats.JetStreamContext
	batch    []*Message
	handlers map[string]MessageHandler
	done     chan struct{}
}

// MessageHandler defines the interface for message handlers
type MessageHandler interface {
	Handle(ctx context.Context, msg *Message) error
}

// NewProcessor creates a new stream processor instance
func NewProcessor(config *StreamConfig) (*Processor, error) {
	if config == nil {
		config = DefaultConfig()
	}

	// Connect to NATS
	nc, err := nats.Connect(config.NatsURL,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %v", err)
	}

	// Create JetStream context
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to create JetStream context: %v", err)
	}

	return &Processor{
		config:   config,
		nc:       nc,
		js:       js,
		batch:    make([]*Message, 0, config.BatchSize),
		handlers: make(map[string]MessageHandler),
		done:     make(chan struct{}),
	}, nil
}

// RegisterHandler registers a message handler for a specific symbol
func (p *Processor) RegisterHandler(symbol string, handler MessageHandler) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.handlers[symbol] = handler
}

// Start starts the stream processor
func (p *Processor) Start(ctx context.Context) error {
	// Create durable consumer
	_, err := p.js.AddConsumer(p.config.InputSubject, &nats.ConsumerConfig{
		Durable:       "market-data-processor",
		AckPolicy:     nats.AckExplicitPolicy,
		MaxDeliver:    p.config.MaxRetries,
		FilterSubject: p.config.InputSubject,
	})
	if err != nil {
		return fmt.Errorf("failed to create consumer: %v", err)
	}

	// Subscribe to input subject
	sub, err := p.js.QueueSubscribe(
		p.config.InputSubject,
		"market-data-processors",
		p.handleMessage,
		nats.ManualAck(),
		nats.AckWait(30*time.Second),
	)
	if err != nil {
		return fmt.Errorf("failed to subscribe: %v", err)
	}

	// Start batch processor
	go p.processBatch(ctx)

	// Wait for context cancellation
	<-ctx.Done()
	sub.Unsubscribe()
	close(p.done)
	return nil
}

// handleMessage processes incoming messages
func (p *Processor) handleMessage(msg *nats.Msg) {
	var message Message
	if err := json.Unmarshal(msg.Data, &message); err != nil {
		msg.Nak()
		return
	}

	p.mu.Lock()
	p.batch = append(p.batch, &message)
	shouldProcess := len(p.batch) >= p.config.BatchSize
	p.mu.Unlock()

	if shouldProcess {
		p.processBatchNow()
	}

	msg.Ack()
}

// processBatch processes batches of messages periodically
func (p *Processor) processBatch(ctx context.Context) {
	ticker := time.NewTicker(p.config.ProcessingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-p.done:
			return
		case <-ticker.C:
			p.processBatchNow()
		}
	}
}

// processBatchNow processes the current batch of messages
func (p *Processor) processBatchNow() {
	p.mu.Lock()
	if len(p.batch) == 0 {
		p.mu.Unlock()
		return
	}

	currentBatch := p.batch
	p.batch = make([]*Message, 0, p.config.BatchSize)
	p.mu.Unlock()

	// Process messages in parallel
	var wg sync.WaitGroup
	for _, msg := range currentBatch {
		p.mu.RLock()
		handler, exists := p.handlers[msg.Symbol]
		p.mu.RUnlock()

		if !exists {
			continue
		}

		wg.Add(1)
		go func(m *Message, h MessageHandler) {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			for i := 0; i < p.config.MaxRetries; i++ {
				if err := h.Handle(ctx, m); err == nil {
					break
				}
				time.Sleep(p.config.RetryDelay)
			}
		}(msg, handler)
	}
	wg.Wait()
}

// Stop stops the stream processor
func (p *Processor) Stop() {
	if p.nc != nil {
		p.nc.Close()
	}
}

// Publish publishes a message to the output subject
func (p *Processor) Publish(msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %v", err)
	}

	_, err = p.js.Publish(p.config.OutputSubject, data)
	if err != nil {
		return fmt.Errorf("failed to publish message: %v", err)
	}

	return nil
}
