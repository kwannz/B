"""
Test module imports
"""

import sys
import os


def test_imports():
    """Test that we can import the backtester module"""
    from tradingbot.shared.backtester import Backtester

    assert Backtester is not None


if __name__ == "__main__":
    test_imports()
    print("Successfully imported all modules")
