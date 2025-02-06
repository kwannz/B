package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/viper"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market"
	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/market/solana"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/monitoring"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/kwanRoshi/B/go-migration/internal/pricing"
	"github.com/kwanRoshi/B/go-migration/internal/storage/mongodb"
	"github.com/kwanRoshi/B/go-migration/internal/trading"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/trading/grpc"
	"github.com/kwanRoshi/B/go-migration/internal/trading/risk"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/kwanRoshi/B/go-migration/internal/ws"
)

func main() {
	// Parse command line flags
	configFile := flag.String("config", "configs/config.yaml", "path to config file")
	mode := flag.String("mode", "test", "trading mode (test/live)")
	strategy := flag.String("strategy", "pump", "trading strategy to use")
	flag.Parse()

	// Validate trading mode
	if *mode != "test" && *mode != "live" {
		log.Fatalf("Invalid trading mode: %s. Must be 'test' or 'live'", *mode)
	}

	// Load configuration
	viper.SetConfigFile(*configFile)
	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Error reading config file: %s", err)
	}

	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to create logger: %s", err)
	}
	defer logger.Sync()

	// Create root context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to MongoDB
	mongoCtx, mongoCancel := context.WithTimeout(ctx, 10*time.Second)
	defer mongoCancel()

	mongoURI := viper.GetString("database.mongodb.uri")
	mongoClient, err := mongo.Connect(mongoCtx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		logger.Fatal("Failed to connect to MongoDB", zap.Error(err))
	}
	defer mongoClient.Disconnect(ctx)

	// Initialize storage and providers
	database := viper.GetString("database.mongodb.database")
	var tradingStorage trading.Storage
	tradingStorage = mongodb.NewTradingStorage(mongoClient, database, logger)
	if err := tradingStorage.(*mongodb.TradingStorage).Initialize(); err != nil {
		logger.Fatal("Failed to initialize storage", zap.Error(err))
	}

	// Initialize Solana provider
	solanaConfig := solana.Config{
		BaseURL:      viper.GetString("market.providers.solana.base_url"),
		WebSocketURL: viper.GetString("market.providers.solana.ws_url"),
		DexSources:   viper.GetStringSlice("market.providers.solana.dex_sources"),
		TimeoutSec:   int(viper.GetDuration("market.providers.solana.timeout").Seconds()),
	}
	solanaProvider := solana.NewProvider(solanaConfig, logger)

	// Initialize pump.fun provider
	pumpConfig := pump.Config{
		BaseURL:      viper.GetString("market.providers.pump.base_url"),
		WebSocketURL: viper.GetString("market.providers.pump.ws_url"),
		TimeoutSec:   int(viper.GetDuration("market.providers.pump.timeout").Seconds()),
	}
	pumpProvider := pump.NewProvider(pumpConfig, logger)

	// Initialize market data handler with both providers
	marketHandler := market.NewHandler([]types.MarketDataProvider{solanaProvider, pumpProvider}, logger)

	// Initialize pricing engine
	pricingConfig := pricing.Config{
		UpdateInterval: viper.GetDuration("pricing.engine.update_interval"),
		HistorySize:   viper.GetInt("pricing.engine.history_size"),
		Indicators:    viper.GetStringSlice("pricing.engine.indicators"),
		SignalParams: pricing.SignalParams{
			MinConfidence:  viper.GetFloat64("pricing.engine.min_confidence"),
			MaxVolatility:  viper.GetFloat64("pricing.engine.max_volatility"),
		},
	}
	pricingEngine := pricing.NewEngine(pricingConfig, logger)

	// Subscribe to symbols
	symbols := []string{"SOL/USDC", "BONK/SOL"} // Solana symbols
	pumpSymbols := []string{"PUMP/SOL"} // pump.fun symbols
	symbols = append(symbols, pumpSymbols...)
	for _, symbol := range symbols {
		ctx := context.Background()
		updates, err := marketHandler.SubscribePrices(ctx, []string{symbol})
		if err != nil {
			logger.Error("Failed to subscribe to symbol",
				zap.String("symbol", symbol),
				zap.Error(err))
			continue
		}
		go handleUpdates(ctx, logger, updates)
	}

	// Start signal processing
	go handleSignals(ctx, logger, pricingEngine)

	// Initialize real-time trading executor with API key
	apiKey := os.Getenv("PUMP_API_KEY")
	if apiKey == "" {
		logger.Fatal("PUMP_API_KEY environment variable not set")
	}

	// Configure trading mode
	_ = *mode == "live" // Mode validation done above
	logger.Info("Starting trading bot",
		zap.String("mode", *mode),
		zap.String("strategy", *strategy))
	
	limits := types.RiskConfig{
		MaxPositionSize:     decimal.NewFromFloat(1000.0),
		MaxDrawdown:         decimal.NewFromFloat(0.1),
		MaxDailyLoss:        decimal.NewFromFloat(100.0),
		MaxLeverage:         decimal.NewFromFloat(1.0),
		MinMarginLevel:      decimal.NewFromFloat(1.5),
		MaxConcentration:    decimal.NewFromFloat(0.2),
		StopLoss: struct {
			Initial  decimal.Decimal `yaml:"initial"`
			Trailing decimal.Decimal `yaml:"trailing"`
		}{
			Initial:  decimal.NewFromFloat(0.02),
			Trailing: decimal.NewFromFloat(0.01),
		},
		TakeProfitLevels: []types.ProfitLevel{
			{Multiplier: decimal.NewFromFloat(1.015), Percentage: decimal.NewFromFloat(0.5)},
			{Multiplier: decimal.NewFromFloat(1.03), Percentage: decimal.NewFromFloat(0.5)},
		},
	}
	riskManager := risk.NewRiskManager(&limits, logger)
	
	pumpConfig := pump.Config{
		BaseURL:      viper.GetString("market.providers.pump.base_url"),
		WebSocketURL: viper.GetString("market.providers.pump.ws_url"),
		TimeoutSec:   int(viper.GetDuration("market.providers.pump.timeout").Seconds()),
		APIKey:       apiKey,
	}
	
	tradingConfig := &types.PumpTradingConfig{
		MaxMarketCap: decimal.NewFromFloat(30000),
		MinVolume:    decimal.NewFromFloat(1000),
		WebSocket: types.WSConfig{
			ReconnectTimeout: 10 * time.Second,
			PingInterval:    15 * time.Second,
			WriteTimeout:    10 * time.Second,
			ReadTimeout:     60 * time.Second,
			PongWait:       60 * time.Second,
			MaxRetries:     5,
			APIKey:         apiKey,
			DialTimeout:    10 * time.Second,
		},
		Risk: struct {
			MaxPositionSize   decimal.Decimal   `yaml:"max_position_size"`
			MinPositionSize   decimal.Decimal   `yaml:"min_position_size"`
			StopLossPercent   decimal.Decimal   `yaml:"stop_loss_percent"`
			TakeProfitLevels  []decimal.Decimal `yaml:"take_profit_levels"`
			BatchSizes        []decimal.Decimal `yaml:"batch_sizes"`
		}{
			MaxPositionSize:   decimal.NewFromFloat(1000),
			MinPositionSize:   decimal.NewFromFloat(10),
			StopLossPercent:   decimal.NewFromFloat(0.02),
			TakeProfitLevels:  []decimal.Decimal{decimal.NewFromFloat(1.015), decimal.NewFromFloat(1.03)},
			BatchSizes:        []decimal.Decimal{decimal.NewFromFloat(0.5), decimal.NewFromFloat(0.5)},
		},
	}
	pumpExecutor := executor.NewPumpExecutor(logger, pumpProvider, riskManager, tradingConfig, apiKey)
	if err := pumpExecutor.Start(); err != nil {
		logger.Fatal("Failed to start pump.fun executor", zap.Error(err))
	}
	defer pumpExecutor.Stop()
	
	// Initialize trading engine
	engineConfig := trading.Config{
		Commission:     viper.GetFloat64("trading.order.commission"),
		Slippage:      viper.GetFloat64("trading.order.slippage"),
		MaxOrderSize:   viper.GetFloat64("trading.risk.max_order_size"),
		MinOrderSize:   viper.GetFloat64("trading.risk.min_order_size"),
		MaxPositions:   viper.GetInt("trading.risk.max_positions"),
		UpdateInterval: viper.GetDuration("trading.engine.update_interval"),
	}
	tradingEngine := trading.NewEngine(engineConfig, logger, tradingStorage)

	// Register pump.fun executor with trading engine
	if err := tradingEngine.RegisterExecutor("pump.fun", pumpExecutor); err != nil {
		logger.Fatal("Failed to register pump.fun executor", zap.Error(err))
	}

	// Create trading service and servers
	tradingService := trading.NewService(tradingEngine, logger)
	grpcServer := grpc.NewServer(tradingService, logger)
	wsServer := ws.NewServer(wsConfig, logger, tradingService, marketHandler)

	// Initialize monitoring service
	monitoringService := monitoring.NewService(pumpProvider, metrics.NewPumpMetrics(), logger)
	if err := monitoringService.Start(ctx); err != nil {
		logger.Fatal("Failed to start monitoring service", zap.Error(err))
	}

	// Start trading engine
	if err := tradingEngine.Start(ctx); err != nil {
		logger.Fatal("Failed to start trading engine", zap.Error(err))
	}
	defer tradingEngine.Stop()

	// Start servers
	go wsServer.Start()
	if err := grpcServer.Start(viper.GetInt("server.grpc.port")); err != nil {
		logger.Fatal("Failed to start gRPC server", zap.Error(err))
	}

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	// Graceful shutdown
	logger.Info("Shutting down...")
	cancel() // Cancel root context

	// Wait for cleanup
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Add cleanup code here
	if err := mongoClient.Disconnect(shutdownCtx); err != nil {
		logger.Error("Failed to disconnect from MongoDB", zap.Error(err))
	}
}

// handleSignals processes trading signals from the pricing engine
func handleSignals(ctx context.Context, logger *zap.Logger, engine *pricing.Engine) {
	signals := engine.GetSignals()
	for {
		select {
		case <-ctx.Done():
			return
		case signal := <-signals:
			logger.Info("Received trading signal",
				zap.String("symbol", signal.Symbol),
				zap.String("type", string(signal.Type)),
				zap.String("direction", signal.Direction),
				zap.String("price", signal.Price.String()),
				zap.Float64("confidence", signal.Confidence))
		}
	}
}

// handleUpdates processes price updates from market data providers
func handleUpdates(ctx context.Context, logger *zap.Logger, updates <-chan *types.PriceUpdate) {
	for {
		select {
		case <-ctx.Done():
			return
		case update := <-updates:
			logger.Debug("Received price update",
				zap.String("symbol", update.Symbol),
				zap.String("price", update.Price.String()),
				zap.String("volume", update.Volume.String()),
				zap.Time("timestamp", update.Timestamp))
		}
	}
}
