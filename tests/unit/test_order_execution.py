import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from trading_agent.python.executor import OrderExecutor

@pytest.fixture
async def order_executor():
    executor = OrderExecutor()
    await executor.start()
    yield executor
    await executor.stop()

@pytest.fixture
def mock_exchange():
    exchange = MagicMock()
    exchange.create_order = AsyncMock()
    exchange.cancel_order = AsyncMock()
    exchange.get_order_status = AsyncMock()
    return exchange

@pytest.mark.asyncio
async def test_execute_market_order(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'market',
        'side': 'buy',
        'amount': 1.0,
        'price': None  # Market order doesn't need price
    }
    
    mock_exchange.create_order.return_value = {
        'id': '123456',
        'status': 'filled',
        'filled': 1.0,
        'average': 20000
    }
    
    result = await order_executor.execute_order(order, mock_exchange)
    
    assert result['success'] is True
    assert result['order_id'] == '123456'
    assert result['status'] == 'filled'
    assert result['filled_amount'] == 1.0
    assert result['average_price'] == 20000
    
    mock_exchange.create_order.assert_called_once_with(
        symbol='BTC/USDT',
        type='market',
        side='buy',
        amount=1.0
    )

@pytest.mark.asyncio
async def test_execute_limit_order(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'limit',
        'side': 'sell',
        'amount': 0.5,
        'price': 21000
    }
    
    mock_exchange.create_order.return_value = {
        'id': '123457',
        'status': 'open',
        'filled': 0,
        'price': 21000
    }
    
    result = await order_executor.execute_order(order, mock_exchange)
    
    assert result['success'] is True
    assert result['order_id'] == '123457'
    assert result['status'] == 'open'
    assert result['price'] == 21000
    
    mock_exchange.create_order.assert_called_once_with(
        symbol='BTC/USDT',
        type='limit',
        side='sell',
        amount=0.5,
        price=21000
    )

@pytest.mark.asyncio
async def test_execute_order_with_retry(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'market',
        'side': 'buy',
        'amount': 1.0
    }
    
    # Simulate first attempt failing, second succeeding
    mock_exchange.create_order.side_effect = [
        Exception("Network error"),
        {
            'id': '123458',
            'status': 'filled',
            'filled': 1.0,
            'average': 20000
        }
    ]
    
    result = await order_executor.execute_order(order, mock_exchange)
    
    assert result['success'] is True
    assert result['order_id'] == '123458'
    assert result['status'] == 'filled'
    assert mock_exchange.create_order.call_count == 2

@pytest.mark.asyncio
async def test_cancel_order(order_executor, mock_exchange):
    order_id = '123459'
    
    mock_exchange.cancel_order.return_value = {
        'id': order_id,
        'status': 'canceled'
    }
    
    result = await order_executor.cancel_order(order_id, 'BTC/USDT', mock_exchange)
    
    assert result['success'] is True
    assert result['order_id'] == order_id
    assert result['status'] == 'canceled'
    
    mock_exchange.cancel_order.assert_called_once_with(
        id=order_id,
        symbol='BTC/USDT'
    )

@pytest.mark.asyncio
async def test_execute_batch_orders(order_executor, mock_exchange):
    orders = [
        {
            'symbol': 'BTC/USDT',
            'type': 'market',
            'side': 'buy',
            'amount': 0.5
        },
        {
            'symbol': 'ETH/USDT',
            'type': 'limit',
            'side': 'sell',
            'amount': 5.0,
            'price': 1500
        }
    ]
    
    mock_exchange.create_order.side_effect = [
        {
            'id': '123460',
            'status': 'filled',
            'filled': 0.5,
            'average': 20000
        },
        {
            'id': '123461',
            'status': 'open',
            'filled': 0,
            'price': 1500
        }
    ]
    
    results = await order_executor.execute_batch_orders(orders, mock_exchange)
    
    assert len(results) == 2
    assert all(result['success'] for result in results)
    assert results[0]['order_id'] == '123460'
    assert results[1]['order_id'] == '123461'
    assert mock_exchange.create_order.call_count == 2

@pytest.mark.asyncio
async def test_handle_partial_fills(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'limit',
        'side': 'buy',
        'amount': 1.0,
        'price': 20000
    }
    
    # Simulate partial fills
    mock_exchange.get_order_status.side_effect = [
        {'status': 'open', 'filled': 0.3},
        {'status': 'open', 'filled': 0.7},
        {'status': 'filled', 'filled': 1.0}
    ]
    
    mock_exchange.create_order.return_value = {
        'id': '123462',
        'status': 'open',
        'filled': 0
    }
    
    result = await order_executor.execute_order(order, mock_exchange, wait_for_fill=True)
    
    assert result['success'] is True
    assert result['status'] == 'filled'
    assert result['filled_amount'] == 1.0
    assert mock_exchange.get_order_status.call_count == 3

@pytest.mark.asyncio
async def test_handle_execution_error(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'market',
        'side': 'buy',
        'amount': 1.0
    }
    
    mock_exchange.create_order.side_effect = Exception("Insufficient funds")
    
    result = await order_executor.execute_order(order, mock_exchange)
    
    assert result['success'] is False
    assert 'error' in result
    assert 'Insufficient funds' in result['error']

@pytest.mark.asyncio
async def test_validate_order(order_executor):
    # Valid order
    valid_order = {
        'symbol': 'BTC/USDT',
        'type': 'limit',
        'side': 'buy',
        'amount': 1.0,
        'price': 20000
    }
    
    result = await order_executor.validate_order(valid_order)
    assert result['valid'] is True
    
    # Invalid order - missing required fields
    invalid_order = {
        'symbol': 'BTC/USDT',
        'type': 'limit'
    }
    
    result = await order_executor.validate_order(invalid_order)
    assert result['valid'] is False
    assert 'missing required fields' in result['reason']

@pytest.mark.asyncio
async def test_execute_conditional_order(order_executor, mock_exchange):
    order = {
        'symbol': 'BTC/USDT',
        'type': 'stop_limit',
        'side': 'sell',
        'amount': 1.0,
        'stop_price': 19000,
        'limit_price': 18900
    }
    
    mock_exchange.create_order.return_value = {
        'id': '123463',
        'status': 'open',
        'type': 'stop_limit'
    }
    
    result = await order_executor.execute_conditional_order(order, mock_exchange)
    
    assert result['success'] is True
    assert result['order_id'] == '123463'
    assert result['type'] == 'stop_limit'
    
    mock_exchange.create_order.assert_called_once_with(
        symbol='BTC/USDT',
        type='stop_limit',
        side='sell',
        amount=1.0,
        price=18900,
        stopPrice=19000
    )
