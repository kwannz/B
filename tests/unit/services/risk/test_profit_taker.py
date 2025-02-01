import pytest
from decimal import Decimal
from src.shared.trading.executor.profit_taker import (
    StagedProfitTaker,
    ProfitTakingState,
)


@pytest.fixture
def profit_taker():
    return StagedProfitTaker()


@pytest.fixture
def position_params():
    return {
        "position_id": "test_position_1",
        "entry_price": Decimal("100"),
        "position_size": Decimal("1000"),
    }


def test_initial_state(profit_taker, position_params):
    state = profit_taker.get_state(position_params["position_id"])
    assert isinstance(state, ProfitTakingState)
    assert not state.sold_2x
    assert not state.sold_3x
    assert not state.sold_5x
    assert state.total_sold == Decimal("0")


def test_2x_profit_taking(profit_taker, position_params):
    current_price = Decimal("200")  # 2x entry price
    sell_amount = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        current_price,
        position_params["position_size"],
    )

    assert sell_amount == Decimal("200")  # 20% of 1000
    state = profit_taker.get_state(position_params["position_id"])
    assert state.sold_2x
    assert not state.sold_3x
    assert not state.sold_5x
    assert state.total_sold == Decimal("200")


def test_3x_profit_taking(profit_taker, position_params):
    current_price = Decimal("300")  # 3x entry price
    sell_amount = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        current_price,
        position_params["position_size"],
    )

    assert sell_amount == Decimal("250")  # 25% of 1000
    state = profit_taker.get_state(position_params["position_id"])
    assert state.sold_3x
    assert state.total_sold == Decimal("250")


def test_5x_profit_taking(profit_taker, position_params):
    current_price = Decimal("500")  # 5x entry price
    sell_amount = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        current_price,
        position_params["position_size"],
    )

    assert sell_amount == Decimal("200")  # 20% of 1000
    state = profit_taker.get_state(position_params["position_id"])
    assert state.sold_5x
    assert state.total_sold == Decimal("200")


def test_sequential_profit_taking(profit_taker, position_params):
    # Test 2x
    sell_amount_2x = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        Decimal("200"),
        position_params["position_size"],
    )
    assert sell_amount_2x == Decimal("200")

    # Test 3x
    sell_amount_3x = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        Decimal("300"),
        position_params["position_size"],
    )
    assert sell_amount_3x == Decimal("250")

    # Test 5x
    sell_amount_5x = profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        Decimal("500"),
        position_params["position_size"],
    )
    assert sell_amount_5x == Decimal("200")

    state = profit_taker.get_state(position_params["position_id"])
    assert state.sold_2x and state.sold_3x and state.sold_5x
    assert state.total_sold == Decimal("650")  # 20% + 25% + 20%


def test_reset_state(profit_taker, position_params):
    # First trigger a sale
    profit_taker.calculate_sell_amount(
        position_params["position_id"],
        position_params["entry_price"],
        Decimal("200"),
        position_params["position_size"],
    )

    # Verify state exists
    assert position_params["position_id"] in profit_taker.states

    # Reset state
    profit_taker.reset_state(position_params["position_id"])

    # Verify state is reset
    state = profit_taker.get_state(position_params["position_id"])
    assert not state.sold_2x
    assert not state.sold_3x
    assert not state.sold_5x
    assert state.total_sold == Decimal("0")
