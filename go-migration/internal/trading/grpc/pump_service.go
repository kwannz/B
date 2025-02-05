package grpc

import (
	"context"
	"fmt"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	pb "github.com/kwanRoshi/B/go-migration/proto"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type PumpTradingService struct {
	pb.UnimplementedPumpTradingServiceServer
	logger    *zap.Logger
	executor  *executor.PumpExecutor
	riskMgr   types.RiskManager
}

func NewPumpTradingService(logger *zap.Logger, executor *executor.PumpExecutor, riskMgr types.RiskManager) *PumpTradingService {
	return &PumpTradingService{
		logger:   logger,
		executor: executor,
		riskMgr:  riskMgr,
	}
}

func (s *PumpTradingService) ExecuteTrade(ctx context.Context, req *pb.TradeRequest) (*pb.TradeResponse, error) {
	signal := &types.Signal{
		Symbol:    req.Symbol,
		Side:      req.Side,
		Size:      req.Size,
		Price:     req.Price,
		Timestamp: req.Timestamp.AsTime(),
	}

	if err := s.executor.ExecuteTrade(ctx, signal); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("grpc_failed").Inc()
		return nil, status.Errorf(codes.Internal, "failed to execute trade: %v", err)
	}

	metrics.PumpTradeExecutions.WithLabelValues("grpc_success").Inc()
	return &pb.TradeResponse{
		Status: "success",
	}, nil
}

func (s *PumpTradingService) GetPosition(ctx context.Context, req *pb.PositionRequest) (*pb.PositionResponse, error) {
	position := s.executor.GetPosition(req.Symbol)
	if position == nil {
		return nil, status.Errorf(codes.NotFound, "position not found for symbol: %s", req.Symbol)
	}

	return &pb.PositionResponse{
		Symbol: position.Symbol,
		Size:   position.Size,
		Value:  position.Value,
	}, nil
}

func (s *PumpTradingService) GetPositions(ctx context.Context, req *pb.PositionsRequest) (*pb.PositionsResponse, error) {
	positions := s.executor.GetPositions()
	pbPositions := make([]*pb.Position, 0, len(positions))

	for _, pos := range positions {
		pbPositions = append(pbPositions, &pb.Position{
			Symbol: pos.Symbol,
			Size:   pos.Size,
			Value:  pos.Value,
		})
	}

	return &pb.PositionsResponse{
		Positions: pbPositions,
	}, nil
}

func (s *PumpTradingService) ValidateRisk(ctx context.Context, req *pb.RiskValidationRequest) (*pb.RiskValidationResponse, error) {
	if err := s.riskMgr.ValidatePosition(req.Symbol, req.Size); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("risk_rejected").Inc()
		return &pb.RiskValidationResponse{
			Valid:  false,
			Reason: fmt.Sprintf("risk validation failed: %v", err),
		}, nil
	}

	return &pb.RiskValidationResponse{
		Valid: true,
	}, nil
}
