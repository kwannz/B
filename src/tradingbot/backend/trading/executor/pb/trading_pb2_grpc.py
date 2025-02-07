# Generated by the gRPC Python protocol compiler plugin. DO NOT EDIT!
"""Client and server classes corresponding to protobuf-defined services."""
import grpc
import warnings

from . import trading_pb2 as trading__pb2

GRPC_GENERATED_VERSION = '1.70.0'
GRPC_VERSION = grpc.__version__
_version_not_supported = False

try:
    from grpc._utilities import first_version_is_lower
    _version_not_supported = first_version_is_lower(GRPC_VERSION, GRPC_GENERATED_VERSION)
except ImportError:
    _version_not_supported = True

if _version_not_supported:
    raise RuntimeError(
        f'The grpc package installed is at version {GRPC_VERSION},'
        + f' but the generated code in trading_pb2_grpc.py depends on'
        + f' grpcio>={GRPC_GENERATED_VERSION}.'
        + f' Please upgrade your grpc module to grpcio>={GRPC_GENERATED_VERSION}'
        + f' or downgrade your generated code using grpcio-tools<={GRPC_VERSION}.'
    )


class TradingExecutorStub(object):
    """Missing associated documentation comment in .proto file."""

    def __init__(self, channel):
        """Constructor.

        Args:
            channel: A grpc.Channel.
        """
        self.ExecuteTrade = channel.unary_unary(
                '/trading.TradingExecutor/ExecuteTrade',
                request_serializer=trading__pb2.TradeRequest.SerializeToString,
                response_deserializer=trading__pb2.TradeResponse.FromString,
                _registered_method=True)
        self.GetOrderStatus = channel.unary_unary(
                '/trading.TradingExecutor/GetOrderStatus',
                request_serializer=trading__pb2.OrderStatusRequest.SerializeToString,
                response_deserializer=trading__pb2.OrderStatusResponse.FromString,
                _registered_method=True)
        self.MonitorOrderStatus = channel.unary_stream(
                '/trading.TradingExecutor/MonitorOrderStatus',
                request_serializer=trading__pb2.OrderStatusRequest.SerializeToString,
                response_deserializer=trading__pb2.OrderStatusResponse.FromString,
                _registered_method=True)


class TradingExecutorServicer(object):
    """Missing associated documentation comment in .proto file."""

    def ExecuteTrade(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def GetOrderStatus(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')

    def MonitorOrderStatus(self, request, context):
        """Missing associated documentation comment in .proto file."""
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('Method not implemented!')
        raise NotImplementedError('Method not implemented!')


def add_TradingExecutorServicer_to_server(servicer, server):
    rpc_method_handlers = {
            'ExecuteTrade': grpc.unary_unary_rpc_method_handler(
                    servicer.ExecuteTrade,
                    request_deserializer=trading__pb2.TradeRequest.FromString,
                    response_serializer=trading__pb2.TradeResponse.SerializeToString,
            ),
            'GetOrderStatus': grpc.unary_unary_rpc_method_handler(
                    servicer.GetOrderStatus,
                    request_deserializer=trading__pb2.OrderStatusRequest.FromString,
                    response_serializer=trading__pb2.OrderStatusResponse.SerializeToString,
            ),
            'MonitorOrderStatus': grpc.unary_stream_rpc_method_handler(
                    servicer.MonitorOrderStatus,
                    request_deserializer=trading__pb2.OrderStatusRequest.FromString,
                    response_serializer=trading__pb2.OrderStatusResponse.SerializeToString,
            ),
    }
    generic_handler = grpc.method_handlers_generic_handler(
            'trading.TradingExecutor', rpc_method_handlers)
    server.add_generic_rpc_handlers((generic_handler,))
    server.add_registered_method_handlers('trading.TradingExecutor', rpc_method_handlers)


 # This class is part of an EXPERIMENTAL API.
class TradingExecutor(object):
    """Missing associated documentation comment in .proto file."""

    @staticmethod
    def ExecuteTrade(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(
            request,
            target,
            '/trading.TradingExecutor/ExecuteTrade',
            trading__pb2.TradeRequest.SerializeToString,
            trading__pb2.TradeResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
            _registered_method=True)

    @staticmethod
    def GetOrderStatus(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_unary(
            request,
            target,
            '/trading.TradingExecutor/GetOrderStatus',
            trading__pb2.OrderStatusRequest.SerializeToString,
            trading__pb2.OrderStatusResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
            _registered_method=True)

    @staticmethod
    def MonitorOrderStatus(request,
            target,
            options=(),
            channel_credentials=None,
            call_credentials=None,
            insecure=False,
            compression=None,
            wait_for_ready=None,
            timeout=None,
            metadata=None):
        return grpc.experimental.unary_stream(
            request,
            target,
            '/trading.TradingExecutor/MonitorOrderStatus',
            trading__pb2.OrderStatusRequest.SerializeToString,
            trading__pb2.OrderStatusResponse.FromString,
            options,
            channel_credentials,
            insecure,
            call_credentials,
            compression,
            wait_for_ready,
            timeout,
            metadata,
            _registered_method=True)
