package grpc

import (
	"context"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"

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
	executor  executor.TradingExecutor
	riskMgr   types.RiskManager
}

func NewPumpTradingService(logger *zap.Logger, executor executor.TradingExecutor, riskMgr types.RiskManager) *PumpTradingService {
	return &PumpTradingService{
		logger:   logger,
		executor: executor,
		riskMgr:  riskMgr,
	}
}

func (s *PumpTradingService) ExecuteTrade(ctx context.Context, trade *pb.Trade) (*pb.TradeResponse, error) {
	size, err := decimal.NewFromString(trade.Size)
	if err != nil {
		return &pb.TradeResponse{
			TradeId: trade.Id,
			Status:  "failed",
			Message: fmt.Sprintf("invalid size: %v", err),
		}, nil
	}

	price, err := decimal.NewFromString(trade.Price)
	if err != nil {
		return &pb.TradeResponse{
			TradeId: trade.Id,
			Status:  "failed",
			Message: fmt.Sprintf("invalid price: %v", err),
		}, nil
	}

	signal := &types.Signal{
		Symbol:    trade.Symbol,
		Size:      size,
		Price:     price,
		Timestamp: time.Unix(trade.Timestamp, 0),
	}

	if err := s.executor.ExecuteTrade(ctx, signal); err != nil {
		metrics.PumpTradeExecutions.WithLabelValues("grpc_failed").Inc()
		return &pb.TradeResponse{
			TradeId: trade.Id,
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
