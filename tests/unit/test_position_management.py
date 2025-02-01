import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from trading_agent.python.trading_agent import PositionManager

@pytest.fixture
async def position_manager():
    manager = PositionManager()
    await manager.start()
    yield manager
    await manager.stop()

@pytest.fixture
def mock_exchange():
    exchange = MagicMock()
    exchange.fetch_positions = AsyncMock()
    exchange.fetch_balance = AsyncMock()
    exchange.create_order = AsyncMock()
    return exchange

@pytest.mark.asyncio
async def test_open_position(position_manager, mock_exchange):
    position_params = {
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000,
        'leverage': 1,
        'stop_loss': 19000,
        'take_profit': 22000
    }
    
    mock_exchange.create_order.return_value = {
        'id': '123456',
        'status': 'filled',
        'filled': 1.0,
        'average': 20000
    }
    
    result = await position_manager.open_position(position_params, mock_exchange)
    
    assert result['success'] is True
    assert result['position_id'] is not None
    assert result['entry_price'] == 20000
    assert result['size'] == 1.0
    assert result['side'] == 'long'
    
    # Verify position is tracked
    positions = await position_manager.get_active_positions()
    assert len(positions) == 1
    assert positions[0]['symbol'] == 'BTC/USDT'

@pytest.mark.asyncio
async def test_close_position(position_manager, mock_exchange):
    # First open a position
    position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000
    }, mock_exchange)
    
    mock_exchange.create_order.return_value = {
        'id': '123457',
        'status': 'filled',
        'filled': 1.0,
        'average': 21000
    }
    
    result = await position_manager.close_position(position['position_id'], mock_exchange)
    
    assert result['success'] is True
    assert result['realized_pnl'] > 0  # Profit in this case
    assert result['exit_price'] == 21000
    
    # Verify position is no longer active
    positions = await position_manager.get_active_positions()
    assert len(positions) == 0

@pytest.mark.asyncio
async def test_update_position_size(position_manager, mock_exchange):
    # Open initial position
    position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000
    }, mock_exchange)
    
    mock_exchange.create_order.return_value = {
        'id': '123458',
        'status': 'filled',
        'filled': 0.5,
        'average': 20500
    }
    
    result = await position_manager.update_position_size(
        position['position_id'],
        'increase',
        0.5,
        mock_exchange
    )
    
    assert result['success'] is True
    assert result['new_size'] == 1.5
    assert result['average_entry'] != 20000  # Should be adjusted for the new entry

@pytest.mark.asyncio
async def test_calculate_position_size(position_manager):
    account_balance = 100000
    risk_per_trade = 0.02  # 2%
    entry_price = 20000
    stop_loss = 19000
    
    size = await position_manager.calculate_position_size(
        account_balance,
        risk_per_trade,
        entry_price,
        stop_loss
    )
    
    expected_size = (account_balance * risk_per_trade) / (entry_price - stop_loss)
    assert size == pytest.approx(expected_size)
    assert size > 0

@pytest.mark.asyncio
async def test_manage_stop_loss(position_manager, mock_exchange):
    # Open position
    position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000,
        'stop_loss': 19000
    }, mock_exchange)
    
    # Update stop loss
    new_stop_loss = 19500
    result = await position_manager.update_stop_loss(
        position['position_id'],
        new_stop_loss,
        mock_exchange
    )
    
    assert result['success'] is True
    assert result['new_stop_loss'] == new_stop_loss
    
    # Verify stop loss is updated
    position_info = await position_manager.get_position(position['position_id'])
    assert position_info['stop_loss'] == new_stop_loss

@pytest.mark.asyncio
async def test_manage_take_profit(position_manager, mock_exchange):
    # Open position
    position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000,
        'take_profit': 22000
    }, mock_exchange)
    
    # Update take profit
    new_take_profit = 23000
    result = await position_manager.update_take_profit(
        position['position_id'],
        new_take_profit,
        mock_exchange
    )
    
    assert result['success'] is True
    assert result['new_take_profit'] == new_take_profit
    
    # Verify take profit is updated
    position_info = await position_manager.get_position(position['position_id'])
    assert position_info['take_profit'] == new_take_profit

@pytest.mark.asyncio
async def test_calculate_pnl(position_manager):
    position_info = {
        'symbol': 'BTC/USDT',
        'side': 'long',
        'size': 1.0,
        'entry_price': 20000,
        'current_price': 21000
    }
    
    pnl = await position_manager.calculate_pnl(position_info)
    
    assert pnl['unrealized_pnl'] == 1000
    assert pnl['pnl_percentage'] == pytest.approx(0.05)  # 5% profit

@pytest.mark.asyncio
async def test_handle_margin_calls(position_manager, mock_exchange):
    # Open leveraged position
    position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000,
        'leverage': 5
    }, mock_exchange)
    
    # Simulate price dropping to margin call level
    mock_exchange.fetch_positions.return_value = [{
        'symbol': 'BTC/USDT',
        'margin_ratio': 0.95,  # Close to margin call
        'liquidation_price': 19000
    }]
    
    result = await position_manager.check_margin_requirements(position['position_id'], mock_exchange)
    
    assert result['margin_call_warning'] is True
    assert result['recommended_action'] == 'reduce_position'

@pytest.mark.asyncio
async def test_handle_position_hedging(position_manager, mock_exchange):
    # Open main position
    main_position = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000
    }, mock_exchange)
    
    # Create hedge position
    hedge_result = await position_manager.create_hedge_position(
        main_position['position_id'],
        0.5,  # Hedge 50% of main position
        mock_exchange
    )
    
    assert hedge_result['success'] is True
    assert hedge_result['hedge_ratio'] == 0.5
    assert hedge_result['hedge_position_id'] is not None
    
    # Verify both positions are tracked
    positions = await position_manager.get_active_positions()
    assert len(positions) == 2
    assert any(p['is_hedge'] for p in positions)

@pytest.mark.asyncio
async def test_position_exposure_limits(position_manager, mock_exchange):
    # Set max exposure limit
    await position_manager.set_exposure_limits({
        'BTC/USDT': 2.0,  # Maximum 2 BTC position
        'total_leverage': 5
    })
    
    # Try to open position within limits
    result1 = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.5,
        'entry_price': 20000
    }, mock_exchange)
    
    assert result1['success'] is True
    
    # Try to open position exceeding limits
    result2 = await position_manager.open_position({
        'symbol': 'BTC/USDT',
        'side': 'long',
        'amount': 1.0,
        'entry_price': 20000
    }, mock_exchange)
    
    assert result2['success'] is False
    assert 'exposure limit exceeded' in result2['error']
