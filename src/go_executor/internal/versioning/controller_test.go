package versioning

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestController(t *testing.T) {
	// Create test config
	config := &Config{
		MetricsInterval:    100 * time.Millisecond,
		ValidationInterval: 200 * time.Millisecond,
		ErrorThreshold:     0.01,
		LatencyThreshold:   100,
		SwitchoverDelay:    time.Second,
	}

	// Create controller
	controller, err := NewController(config)
	require.NoError(t, err)
	defer controller.Stop()

	// Start controller
	ctx := context.Background()
	err = controller.Start(ctx)
	require.NoError(t, err)

	t.Run("Version Registration", func(t *testing.T) {
		// Register active version
		activeVersion := &Version{
			ID:        "v1.0.0",
			Name:      "Version 1.0.0",
			Status:    "active",
			StartTime: time.Now(),
			Metrics: Metrics{
				TotalRequests:    1000,
				SuccessRequests:  990,
				FailedRequests:   10,
				TotalLatency:     50000,
				MaxLatency:       80,
				ProcessedOrders:  800,
				RejectedOrders:   20,
				AverageOrderSize: 1.5,
			},
		}

		err := controller.RegisterVersion(ctx, activeVersion)
		require.NoError(t, err)

		// Register shadow version
		shadowVersion := &Version{
			ID:        "v1.1.0",
			Name:      "Version 1.1.0",
			Status:    "shadow",
			StartTime: time.Now().Add(-2 * time.Second),
			Metrics: Metrics{
				TotalRequests:    500,
				SuccessRequests:  495,
				FailedRequests:   5,
				TotalLatency:     20000,
				MaxLatency:       60,
				ProcessedOrders:  400,
				RejectedOrders:   10,
				AverageOrderSize: 1.6,
			},
		}

		err = controller.RegisterVersion(ctx, shadowVersion)
		require.NoError(t, err)

		// Verify active version
		active := controller.GetActiveVersion()
		require.NotNil(t, active)
		assert.Equal(t, "v1.0.0", active.ID)
		assert.Equal(t, "active", active.Status)

		// Verify shadow version
		shadow := controller.GetShadowVersion()
		require.NotNil(t, shadow)
		assert.Equal(t, "v1.1.0", shadow.ID)
		assert.Equal(t, "shadow", shadow.Status)
	})

	t.Run("Version Switching", func(t *testing.T) {
		// Update shadow version metrics
		shadowMetrics := &Metrics{
			TotalRequests:    1000,
			SuccessRequests:  995,
			FailedRequests:   5,
			TotalLatency:     40000,
			MaxLatency:       70,
			ProcessedOrders:  900,
			RejectedOrders:   15,
			AverageOrderSize: 1.7,
		}

		shadow := controller.GetShadowVersion()
		require.NotNil(t, shadow)
		err := controller.UpdateMetrics(shadow.ID, shadowMetrics)
		require.NoError(t, err)

		// Attempt version switch
		err = controller.SwitchVersion(ctx)
		require.NoError(t, err)

		// Verify version status changes
		active := controller.GetActiveVersion()
		require.NotNil(t, active)
		assert.Equal(t, "v1.1.0", active.ID)
		assert.Equal(t, "active", active.Status)

		deprecated := controller.GetShadowVersion()
		require.Nil(t, deprecated)
	})

	t.Run("Invalid Operations", func(t *testing.T) {
		// Try to register version without ID
		invalidVersion := &Version{
			Name:   "Invalid Version",
			Status: "active",
		}
		err := controller.RegisterVersion(ctx, invalidVersion)
		assert.Error(t, err)

		// Try to update metrics for non-existent version
		err = controller.UpdateMetrics("non-existent", &Metrics{})
		assert.Error(t, err)

		// Try to switch versions without shadow version
		err = controller.SwitchVersion(ctx)
		assert.Error(t, err)
	})

	t.Run("Performance Validation", func(t *testing.T) {
		// Register new shadow version with poor performance
		poorVersion := &Version{
			ID:        "v1.2.0",
			Name:      "Version 1.2.0",
			Status:    "shadow",
			StartTime: time.Now().Add(-2 * time.Second),
			Metrics: Metrics{
				TotalRequests:    1000,
				SuccessRequests:  950,
				FailedRequests:   50, // 5% error rate
				TotalLatency:     150000,
				MaxLatency:       200, // High latency
				ProcessedOrders:  800,
				RejectedOrders:   30,
				AverageOrderSize: 1.5,
			},
		}

		err := controller.RegisterVersion(ctx, poorVersion)
		require.NoError(t, err)

		// Attempt version switch should fail
		err = controller.SwitchVersion(ctx)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "error rate too high")

		// Verify active version remains unchanged
		active := controller.GetActiveVersion()
		require.NotNil(t, active)
		assert.Equal(t, "v1.1.0", active.ID)
	})
}

func TestControllerConfigValidation(t *testing.T) {
	testCases := []struct {
		name        string
		config      *Config
		shouldError bool
	}{
		{
			name:        "Nil config",
			config:      nil,
			shouldError: false, // Should use default config
		},
		{
			name: "Valid config",
			config: &Config{
				MetricsInterval:    time.Second,
				ValidationInterval: time.Minute,
			},
			shouldError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewController(tc.config)
			if tc.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
