package monitoring

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// AlertLevel represents the severity of an alert
type AlertLevel string

const (
	InfoLevel     AlertLevel = "info"
	WarningLevel  AlertLevel = "warning"
	ErrorLevel    AlertLevel = "error"
	CriticalLevel AlertLevel = "critical"
)

// Alert represents a system alert
type Alert struct {
	ID        string                 `json:"id"`
	Level     AlertLevel             `json:"level"`
	Source    string                 `json:"source"`
	Message   string                 `json:"message"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Status    string                 `json:"status"` // active, acknowledged, resolved
}

// Metric represents a system metric
type Metric struct {
	Name      string            `json:"name"`
	Value     float64           `json:"value"`
	Labels    map[string]string `json:"labels"`
	Timestamp time.Time         `json:"timestamp"`
}

// Config holds configuration for monitoring system
type Config struct {
	CollectInterval time.Duration
	RetentionPeriod time.Duration
	AlertRules      map[string]AlertRule
}

// AlertRule defines when to trigger alerts
type AlertRule struct {
	Metric    string
	Condition string // gt, lt, eq
	Threshold float64
	Level     AlertLevel
	Message   string
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		CollectInterval: time.Second * 10,
		RetentionPeriod: time.Hour * 24,
		AlertRules: map[string]AlertRule{
			"high_error_rate": {
				Metric:    "error_rate",
				Condition: "gt",
				Threshold: 0.01,
				Level:     ErrorLevel,
				Message:   "Error rate exceeds 1%",
			},
			"high_latency": {
				Metric:    "latency_p99",
				Condition: "gt",
				Threshold: 100,
				Level:     WarningLevel,
				Message:   "P99 latency exceeds 100ms",
			},
		},
	}
}

// Monitor represents the monitoring system
type Monitor struct {
	mu       sync.RWMutex
	config   *Config
	metrics  map[string][]Metric
	alerts   map[string]*Alert
	handlers map[AlertLevel][]AlertHandler
	done     chan struct{}
}

// AlertHandler defines the interface for alert handlers
type AlertHandler interface {
	HandleAlert(alert *Alert) error
}

// NewMonitor creates a new monitoring system
func NewMonitor(config *Config) (*Monitor, error) {
	if config == nil {
		config = DefaultConfig()
	}

	return &Monitor{
		config:   config,
		metrics:  make(map[string][]Metric),
		alerts:   make(map[string]*Alert),
		handlers: make(map[AlertLevel][]AlertHandler),
		done:     make(chan struct{}),
	}, nil
}

// Start starts the monitoring system
func (m *Monitor) Start(ctx context.Context) error {
	go m.collectMetrics(ctx)
	go m.cleanupOldData(ctx)
	return nil
}

// Stop stops the monitoring system
func (m *Monitor) Stop() error {
	close(m.done)
	return nil
}

// RegisterAlertHandler registers a handler for alerts
func (m *Monitor) RegisterAlertHandler(level AlertLevel, handler AlertHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[level] = append(m.handlers[level], handler)
}

// RecordMetric records a new metric
func (m *Monitor) RecordMetric(metric *Metric) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store metric in memory
	m.metrics[metric.Name] = append(m.metrics[metric.Name], *metric)

	// Check alert rules
	m.checkAlertRules(metric)

	return nil
}

// GetMetrics returns metrics for a given name and time range
func (m *Monitor) GetMetrics(name string, start, end time.Time) ([]Metric, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics := make([]Metric, 0)
	for _, metric := range m.metrics[name] {
		if metric.Timestamp.After(start) && metric.Timestamp.Before(end) {
			metrics = append(metrics, metric)
		}
	}

	return metrics, nil
}

// GetActiveAlerts returns all active alerts
func (m *Monitor) GetActiveAlerts() []*Alert {
	m.mu.RLock()
	defer m.mu.RUnlock()

	alerts := make([]*Alert, 0)
	for _, alert := range m.alerts {
		if alert.Status == "active" {
			alerts = append(alerts, alert)
		}
	}

	return alerts
}

// AcknowledgeAlert acknowledges an alert
func (m *Monitor) AcknowledgeAlert(alertID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	alert, exists := m.alerts[alertID]
	if !exists {
		return fmt.Errorf("alert not found: %s", alertID)
	}

	alert.Status = "acknowledged"
	return nil
}

// ResolveAlert resolves an alert
func (m *Monitor) ResolveAlert(alertID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	alert, exists := m.alerts[alertID]
	if !exists {
		return fmt.Errorf("alert not found: %s", alertID)
	}

	alert.Status = "resolved"
	return nil
}

// checkAlertRules checks if any alert rules are triggered
func (m *Monitor) checkAlertRules(metric *Metric) {
	for _, rule := range m.config.AlertRules {
		if rule.Metric == metric.Name {
			triggered := false

			switch rule.Condition {
			case "gt":
				triggered = metric.Value > rule.Threshold
			case "lt":
				triggered = metric.Value < rule.Threshold
			case "eq":
				triggered = metric.Value == rule.Threshold
			}

			if triggered {
				alert := &Alert{
					ID:        fmt.Sprintf("%s-%d", rule.Metric, time.Now().Unix()),
					Level:     rule.Level,
					Source:    metric.Name,
					Message:   rule.Message,
					Timestamp: time.Now(),
					Metadata: map[string]interface{}{
						"value":     metric.Value,
						"threshold": rule.Threshold,
						"labels":    metric.Labels,
					},
					Status: "active",
				}

				m.alerts[alert.ID] = alert

				// Notify handlers
				for _, handler := range m.handlers[rule.Level] {
					go handler.HandleAlert(alert)
				}
			}
		}
	}
}

// collectMetrics periodically collects system metrics
func (m *Monitor) collectMetrics(ctx context.Context) {
	ticker := time.NewTicker(m.config.CollectInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-m.done:
			return
		case <-ticker.C:
			// Collect system metrics
			// This would integrate with your system metrics collection
		}
	}
}

// cleanupOldData periodically cleans up old metrics and alerts
func (m *Monitor) cleanupOldData(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-m.done:
			return
		case <-ticker.C:
			m.mu.Lock()
			cutoff := time.Now().Add(-m.config.RetentionPeriod)

			// Cleanup metrics
			for name, metrics := range m.metrics {
				filtered := make([]Metric, 0)
				for _, metric := range metrics {
					if metric.Timestamp.After(cutoff) {
						filtered = append(filtered, metric)
					}
				}
				m.metrics[name] = filtered
			}

			// Cleanup alerts
			for id, alert := range m.alerts {
				if alert.Timestamp.Before(cutoff) && alert.Status == "resolved" {
					delete(m.alerts, id)
				}
			}
			m.mu.Unlock()
		}
	}
}
