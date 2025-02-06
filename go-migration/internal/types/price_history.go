package types

import (
	"sync"
	"time"
)

type PriceLevel struct {
	Symbol    string
	Price     float64
	Volume    float64
	Timestamp time.Time
}

type PriceHistory struct {
	symbol    string
	capacity  int
	levels    []*PriceLevel
	position  int
	mu        sync.RWMutex
}

func NewPriceHistory(capacity int) *PriceHistory {
	return &PriceHistory{
		capacity: capacity,
		levels:   make([]*PriceLevel, 0, capacity),
	}
}

func (h *PriceHistory) Add(level *PriceLevel) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.levels) < h.capacity {
		h.levels = append(h.levels, level)
	} else {
		h.levels[h.position] = level
		h.position = (h.position + 1) % h.capacity
	}
}

func (h *PriceHistory) Length() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.levels)
}

func (h *PriceHistory) Get(index int) *PriceLevel {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if index < 0 || index >= len(h.levels) {
		return nil
	}
	return h.levels[index]
}

func (h *PriceHistory) Last() *PriceLevel {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.levels) == 0 {
		return nil
	}
	return h.levels[len(h.levels)-1]
}
