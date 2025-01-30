package main

import (
    "log"
    "net"
    "google.golang.org/grpc"
    "github.com/kwanRoshi/tradingbot/src/go_executor/internal/server"
    pb "github.com/kwanRoshi/tradingbot/src/go_executor/pb"
)

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    
    s := grpc.NewServer()
    tradingServer := server.NewTradingServer()
    pb.RegisterTradingExecutorServer(s, tradingServer)
    
    log.Printf("server listening at %v", lis.Addr())
    if err := s.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
