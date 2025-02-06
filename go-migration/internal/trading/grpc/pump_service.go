package grpc

import (
	"context"
	"fmt"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/trading"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	pb "github.com/kwanRoshi/B/go-migration/proto"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type PumpTradingService struct {
	pb.UnimplementedTradingServiceServer
	logger    *zap.Logger
	executor  *executor.PumpExecutor
	riskMgr   types.RiskManager
	service   *trading.Service
}

func NewPumpTradingService(logger *zap.Logger, executor *executor.PumpExecutor, riskMgr types.RiskManager, service *trading.Service) *PumpTradingService {
	return &PumpTradingService{
		logger:   logger,
		executor: executor,
		riskMgr:  riskMgr,
		service:  service,
	}
}

func (s *PumpTradingService) PlaceOrder(ctx context.Context, order *pb.Order) (*pb.OrderResponse, error) {
	return s.service.PlaceOrder(ctx, order)
}

func (s *PumpTradingService) CancelOrder(ctx context.Context, req *pb.CancelOrderRequest) (*pb.OrderResponse, error) {
	return s.service.CancelOrder(ctx, req)
}

func (s *PumpTradingService) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.Order, error) {
	return s.service.GetOrder(ctx, req)
}

func (s *PumpTradingService) GetOrders(ctx context.Context, req *pb.GetOrdersRequest) (*pb.OrderList, error) {
	return s.service.GetOrders(ctx, req)
}

func (s *PumpTradingService) ExecuteTrade(ctx context.Context, trade *pb.Trade) (*pb.TradeResponse, error) {
	signal := &types.Signal{
		Symbol:    trade.Symbol,
		Size:      trade.Size,
		Price:     trade.Price,
		Timestamp: time.Unix(trade.Timestamp, 0),
	}

	if err := s.executor.ExecuteTrade(ctx, signal); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("grpc_failed").Inc()
		return &pb.TradeResponse{
			Status:  "failed",
			Message: fmt.Sprintf("failed to execute trade: %v", err),
		}, nil
	}

	metrics.PumpTradeExecutions.WithLabelValues("grpc_success").Inc()
	return &pb.TradeResponse{
		TradeId: trade.Id,
		Status:  "success",
	}, nil
}

func (s *PumpTradingService) GetPosition(ctx context.Context, req *pb.GetPositionRequest) (*pb.Position, error) {
	position := s.executor.GetPosition(req.Symbol)
	if position == nil {
		return nil, status.Errorf(codes.NotFound, "position not found for symbol: %s", req.Symbol)
	}

	return &pb.Position{
		Symbol:        position.Symbol,
		Size:          position.Size.String(),
		EntryPrice:    position.EntryPrice.String(),
		CurrentPrice:  position.CurrentPrice.String(),
		UnrealizedPnl: position.UnrealizedPnL.String(),
	}, nil
}

func (s *PumpTradingService) GetPositions(ctx context.Context, req *pb.GetPositionsRequest) (*pb.PositionList, error) {
	positions := s.executor.GetPositions()
	pbPositions := make([]*pb.Position, 0, len(positions))

	for _, pos := range positions {
		pbPositions = append(pbPositions, &pb.Position{
			Symbol:        pos.Symbol,
			Size:          pos.Size.String(),
			EntryPrice:    pos.EntryPrice.String(),
			CurrentPrice:  pos.CurrentPrice.String(),
			UnrealizedPnl: pos.UnrealizedPnL.String(),
		})
	}

	return &pb.PositionList{
		Positions: pbPositions,
	}, nil
}

func (s *PumpTradingService) SubscribeOrderBook(req *pb.SubscribeOrderBookRequest, stream pb.TradingService_SubscribeOrderBookServer) error {
	return s.service.SubscribeOrderBook(req, stream)
}
