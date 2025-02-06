package metrics

import (
	_ "github.com/prometheus/client_golang/prometheus"
)

// Using metrics from metrics.go

// Using PumpMetrics from metrics.go
func NewPumpMetrics() *PumpMetrics {
	return GetPumpMetrics()
}
