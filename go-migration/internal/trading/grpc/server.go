package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/shopspring/decimal"
	"google.golang.org/grpc"
	"go.uber.org/zap"

	pb "github.com/kwanRoshi/B/go-migration/proto"
	"github.com/kwanRoshi/B/go-migration/internal/trading"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Server struct {
	pb.UnimplementedTradingServiceServer
	service *trading.Service
	logger  *zap.Logger
}

func NewServer(service *trading.Service, logger *zap.Logger) *Server {
	return &Server{
		service: service,
		logger:  logger,
	}
}

func (s *Server) Start(port int) error {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}

	server := grpc.NewServer(
		grpc.MaxConcurrentStreams(1000),
		grpc.MaxRecvMsgSize(4 * 1024 * 1024),
		grpc.MaxSendMsgSize(4 * 1024 * 1024),
	)
	pb.RegisterTradingServiceServer(server, s)

	go func() {
		if err := server.Serve(lis); err != nil {
			s.logger.Error("Failed to serve gRPC", zap.Error(err))
		}
	}()

	return nil
}

func (s *Server) PlaceOrder(ctx context.Context, req *pb.Order) (*pb.OrderResponse, error) {
	price, err := decimal.NewFromString(req.Price)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	size, err := decimal.NewFromString(req.Size)
	if err != nil {
		return nil, fmt.Errorf("invalid size: %w", err)
	}

	order := &types.Order{
		ID:        req.Id,
		UserID:    req.UserId,
		Symbol:    req.Symbol,
		Side:      types.OrderSide(req.Side),
		Type:      types.OrderType(req.Type),
		Price:     price,
		Size:      size,
		Status:    types.OrderStatus(req.Status),
		CreatedAt: time.Unix(req.CreatedAt, 0),
		UpdatedAt: time.Unix(req.UpdatedAt, 0),
	}

	if err := s.service.PlaceOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to place order: %w", err)
	}

	return &pb.OrderResponse{
		OrderId: order.ID,
		Status:  "success",
	}, nil
}

func (s *Server) CancelOrder(ctx context.Context, req *pb.CancelOrderRequest) (*pb.OrderResponse, error) {
	if err := s.service.CancelOrder(ctx, req.OrderId); err != nil {
		return nil, fmt.Errorf("failed to cancel order: %w", err)
	}

	return &pb.OrderResponse{
		OrderId: req.OrderId,
		Status:  "success",
	}, nil
}

func (s *Server) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.Order, error) {
	order, err := s.service.GetOrder(ctx, req.OrderId)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	return &pb.Order{
		Id:        order.ID,
		UserId:    order.UserID,
		Symbol:    order.Symbol,
		Side:      string(order.Side),
		Type:      string(order.Type),
		Price:     order.Price.String(),
		Size:      order.Size.String(),
		Status:    string(order.Status),
		CreatedAt: order.CreatedAt.Unix(),
		UpdatedAt: order.UpdatedAt.Unix(),
	}, nil
}

func (s *Server) GetOrders(ctx context.Context, req *pb.GetOrdersRequest) (*pb.OrderList, error) {
	orders, err := s.service.GetOrders(ctx, req.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to get orders: %w", err)
	}

	pbOrders := make([]*pb.Order, len(orders))
	for i, order := range orders {
		pbOrders[i] = &pb.Order{
			Id:        order.ID,
			UserId:    order.UserID,
			Symbol:    order.Symbol,
			Side:      string(order.Side),
			Type:      string(order.Type),
			Price:     order.Price.String(),
			Size:      order.Size.String(),
			Status:    string(order.Status),
			CreatedAt: order.CreatedAt.Unix(),
			UpdatedAt: order.UpdatedAt.Unix(),
		}
	}

	return &pb.OrderList{Orders: pbOrders}, nil
}

func (s *Server) ExecuteTrade(ctx context.Context, req *pb.Trade) (*pb.TradeResponse, error) {
	price, err := decimal.NewFromString(req.Price)
	if err != nil {
		return nil, fmt.Errorf("invalid price: %w", err)
	}

	size, err := decimal.NewFromString(req.Size)
	if err != nil {
		return nil, fmt.Errorf("invalid size: %w", err)
	}

	trade := &types.Trade{
		ID:        req.Id,
		OrderID:   req.OrderId,
		Symbol:    req.Symbol,
		Price:     price,
		Size:      size,
		Side:      types.OrderSide(req.Side),
		Provider:  "pump",
		Timestamp: time.Unix(req.Timestamp, 0),
	}

	if err := s.service.ExecuteTrade(ctx, trade); err != nil {
		return nil, fmt.Errorf("failed to execute trade: %w", err)
	}

	return &pb.TradeResponse{
		TradeId: trade.ID,
		Status:  "success",
	}, nil
}

func (s *Server) GetPosition(ctx context.Context, req *pb.GetPositionRequest) (*pb.Position, error) {
	pos, err := s.service.GetPosition(ctx, req.UserId, req.Symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	if pos == nil {
		return &pb.Position{}, nil
	}

	return &pb.Position{
		Symbol:        pos.Symbol,
		Size:          pos.Size.String(),
		EntryPrice:    pos.EntryPrice.String(),
		CurrentPrice:  pos.CurrentPrice.String(),
		UnrealizedPnl: pos.UnrealizedPnL.String(),
		RealizedPnl:   pos.RealizedPnL.String(),
	}, nil
}

func (s *Server) GetPositions(ctx context.Context, req *pb.GetPositionsRequest) (*pb.PositionList, error) {
	positions, err := s.service.GetPositions(ctx, req.UserId)
	if err != nil {
		return nil, fmt.Errorf("failed to get positions: %w", err)
	}

	pbPositions := make([]*pb.Position, len(positions))
	for i, pos := range positions {
		pbPositions[i] = &pb.Position{
			Symbol:        pos.Symbol,
			Size:          pos.Size.String(),
			EntryPrice:    pos.EntryPrice.String(),
			CurrentPrice:  pos.CurrentPrice.String(),
			UnrealizedPnl: pos.UnrealizedPnL.String(),
			RealizedPnl:   pos.RealizedPnL.String(),
		}
	}

	return &pb.PositionList{Positions: pbPositions}, nil
}

func (s *Server) SubscribeOrderBook(req *pb.SubscribeOrderBookRequest, stream pb.TradingService_SubscribeOrderBookServer) error {
	ctx := stream.Context()
	updates, err := s.service.SubscribeOrderBook(ctx, req.Symbol)
	if err != nil {
		return fmt.Errorf("failed to subscribe to order book: %w", err)
	}

	for update := range updates {
		pbUpdate := &pb.OrderBook{
			Symbol:    update.Symbol,
			Timestamp: time.Now().UnixNano(),
		}

		pbUpdate.Bids = make([]*pb.PriceLevel, len(update.Bids))
		for i, bid := range update.Bids {
			pbUpdate.Bids[i] = &pb.PriceLevel{
				Price: fmt.Sprintf("%f", bid.Price),
				Size:  fmt.Sprintf("%f", bid.Amount),
			}
		}

		pbUpdate.Asks = make([]*pb.PriceLevel, len(update.Asks))
		for i, ask := range update.Asks {
			pbUpdate.Asks[i] = &pb.PriceLevel{
				Price: fmt.Sprintf("%f", ask.Price),
				Size:  fmt.Sprintf("%f", ask.Amount),
			}
		}

		if err := stream.Send(pbUpdate); err != nil {
			return fmt.Errorf("failed to send order book update: %w", err)
		}
	}

	return nil
}
