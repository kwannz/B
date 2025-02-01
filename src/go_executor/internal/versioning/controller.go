package versioning

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Version represents a service version
type Version struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Status        string    `json:"status"` // active, shadow, deprecated
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time,omitempty"`
	Metrics       Metrics   `json:"metrics"`
	ErrorRate     float64   `json:"error_rate"`
	LatencyP99    float64   `json:"latency_p99"`
	ThroughputQPS float64   `json:"throughput_qps"`
}

// Metrics holds version performance metrics
type Metrics struct {
	TotalRequests    int64   `json:"total_requests"`
	SuccessRequests  int64   `json:"success_requests"`
	FailedRequests   int64   `json:"failed_requests"`
	TotalLatency     float64 `json:"total_latency"`
	MaxLatency       float64 `json:"max_latency"`
	ProcessedOrders  int64   `json:"processed_orders"`
	RejectedOrders   int64   `json:"rejected_orders"`
	AverageOrderSize float64 `json:"average_order_size"`
}

// Config holds configuration for version controller
type Config struct {
	MetricsInterval    time.Duration
	ValidationInterval time.Duration
	ErrorThreshold     float64
	LatencyThreshold   float64
	SwitchoverDelay    time.Duration
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		MetricsInterval:    time.Second * 10,
		ValidationInterval: time.Minute,
		ErrorThreshold:     0.01, // 1% error rate
		LatencyThreshold:   100,  // 100ms
		SwitchoverDelay:    time.Hour * 24,
	}
}

// Controller manages version control and validation
type Controller struct {
	mu       sync.RWMutex
	config   *Config
	versions map[string]*Version
	done     chan struct{}
}

// NewController creates a new version controller
func NewController(config *Config) (*Controller, error) {
	if config == nil {
		config = DefaultConfig()
	}

	return &Controller{
		config:   config,
		versions: make(map[string]*Version),
		done:     make(chan struct{}),
	}, nil
}

// Start starts the version controller
func (c *Controller) Start(ctx context.Context) error {
	go c.collectMetrics(ctx)
	go c.validateVersions(ctx)
	return nil
}

// Stop stops the version controller
func (c *Controller) Stop() error {
	close(c.done)
	return nil
}

// RegisterVersion registers a new version
func (c *Controller) RegisterVersion(ctx context.Context, version *Version) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if version.ID == "" {
		return fmt.Errorf("invalid version: missing ID")
	}

	c.versions[version.ID] = version
	return nil
}

// UpdateMetrics updates version metrics
func (c *Controller) UpdateMetrics(versionID string, metrics *Metrics) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	version, exists := c.versions[versionID]
	if !exists {
		return fmt.Errorf("version not found: %s", versionID)
	}

	version.Metrics = *metrics
	version.ErrorRate = float64(metrics.FailedRequests) / float64(metrics.TotalRequests)
	version.LatencyP99 = metrics.MaxLatency
	version.ThroughputQPS = float64(metrics.TotalRequests) / 60.0

	return nil
}

// GetActiveVersion returns the currently active version
func (c *Controller) GetActiveVersion() *Version {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, v := range c.versions {
		if v.Status == "active" {
			return v
		}
	}
	return nil
}

// GetShadowVersion returns the shadow version if any
func (c *Controller) GetShadowVersion() *Version {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, v := range c.versions {
		if v.Status == "shadow" {
			return v
		}
	}
	return nil
}

// SwitchVersion switches from active to shadow version
func (c *Controller) SwitchVersion(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	active := c.GetActiveVersion()
	shadow := c.GetShadowVersion()

	if active == nil || shadow == nil {
		return fmt.Errorf("no active or shadow version found")
	}

	// Validate shadow version metrics
	if shadow.ErrorRate > c.config.ErrorThreshold {
		return fmt.Errorf("shadow version error rate too high: %.2f", shadow.ErrorRate)
	}
	if shadow.LatencyP99 > c.config.LatencyThreshold {
		return fmt.Errorf("shadow version latency too high: %.2f", shadow.LatencyP99)
	}

	// Switch versions
	active.Status = "deprecated"
	active.EndTime = time.Now()
	shadow.Status = "active"

	return nil
}

// collectMetrics periodically collects version metrics
func (c *Controller) collectMetrics(ctx context.Context) {
	ticker := time.NewTicker(c.config.MetricsInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		case <-ticker.C:
			c.mu.RLock()
			for _, version := range c.versions {
				if version.Status != "deprecated" {
					// Collect metrics from monitoring system
					// This would integrate with your monitoring solution
					metrics := &Metrics{} // Get actual metrics
					c.UpdateMetrics(version.ID, metrics)
				}
			}
			c.mu.RUnlock()
		}
	}
}

// validateVersions periodically validates version performance
func (c *Controller) validateVersions(ctx context.Context) {
	ticker := time.NewTicker(c.config.ValidationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.done:
			return
		case <-ticker.C:
			shadow := c.GetShadowVersion()
			if shadow == nil {
				continue
			}

			// Check if shadow version has been running long enough
			if time.Since(shadow.StartTime) < c.config.SwitchoverDelay {
				continue
			}

			// Attempt version switch if metrics are good
			if err := c.SwitchVersion(ctx); err != nil {
				// Log error but continue
				fmt.Printf("Failed to switch versions: %v\n", err)
			}
		}
	}
}
