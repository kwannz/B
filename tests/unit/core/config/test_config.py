#!/usr/bin/env python3

"""
Test script to verify the configuration system.
"""

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.config.settings import Settings


def test_config():
    """Test configuration loading and validation."""
    try:
        # Load settings
        settings = Settings.get_settings()
        print("\n✅ Settings loaded successfully")

        # Test database settings
        db_settings = settings.get_mongodb_settings()
        print(f"\nMongoDB Settings:")
        print(f"  URI: {db_settings['uri']}")
        print(f"  Database: {db_settings['database']}")
        print("✅ Database settings verified")

        # Test DeepSeek settings
        ai_settings = settings.get_deepseek_settings()
        print(f"\nDeepSeek AI Settings:")
        print(f"  API URL: {ai_settings['api_url']}")
        print(f"  Model: {ai_settings['model']}")
        print("✅ DeepSeek settings verified")

        # Test trading settings
        trading_settings = settings.get_risk_settings()
        print(f"\nTrading Settings:")
        print(f"  Risk Level: {trading_settings['level']}")
        print(f"  Max Loss: {trading_settings['max_loss']}%")
        print(f"  Position Size: {trading_settings['position_size']}%")
        print("✅ Trading settings verified")

        # Test monitoring settings
        monitoring_settings = settings.get_prometheus_settings()
        print(f"\nMonitoring Settings:")
        print(f"  Prometheus: {monitoring_settings['enabled']}")
        print(f"  Pushgateway: {monitoring_settings['pushgateway']}")
        print("✅ Monitoring settings verified")

        # Test alert settings
        alert_settings = settings.get_alert_settings()
        print(f"\nAlert Settings:")
        print(f"  Channels: {', '.join(alert_settings['channels'])}")
        print(f"  Min Level: {alert_settings['min_level']}")
        print("✅ Alert settings verified")

        # Validate all settings
        settings.validate_all()
        print("\n✅ All settings validated successfully")

        # Test settings update
        test_updates = {
            "RISK_LEVEL": "low",
            "TRADING_MODE": "spot",
            "MIN_ALERT_LEVEL": "warning",
        }
        settings.update_settings(test_updates)
        print("\n✅ Settings updated successfully")

        # Export example env file
        settings.export_env_file(".env.test")
        print("\n✅ Example environment file exported to .env.test")

        print("\n🎉 All configuration tests passed!")
        return True

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False


if __name__ == "__main__":
    success = test_config()
    sys.exit(0 if success else 1)
