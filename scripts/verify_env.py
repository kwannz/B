import os
import sys
from dotenv import load_dotenv
import psycopg2
from pymongo import MongoClient


def verify_environment():
    # Load environment variables from all .env files
    load_dotenv("src/trading_agent/config/.env")
    load_dotenv("src/frontend/.env")
    load_dotenv("src/api_gateway/.env")

    print("Python version:", sys.version)

    # Check environment variables
    env_vars = {
        "TRADING_WALLET_ADDRESS": os.getenv("TRADING_WALLET_ADDRESS"),
        "TRADING_WALLET_PRIVATE_KEY": os.getenv("TRADING_WALLET_PRIVATE_KEY"),
        "SOLANA_RPC_URL": os.getenv("SOLANA_RPC_URL"),
        "POSTGRES_URL": os.getenv("POSTGRES_URL"),
        "MONGODB_URL": os.getenv("MONGODB_URL"),
        "DEEPSEEK_API_KEY": os.getenv("DEEPSEEK_API_KEY"),
        "COINGECKO_API_KEY": os.getenv("COINGECKO_API_KEY"),
    }

    print("\nEnvironment variables:")
    for key, value in env_vars.items():
        # Mask private key if present
        if key == "TRADING_WALLET_PRIVATE_KEY" and value:
            print(f"{key}: ***masked***")
        else:
            print(f"{key}: {value}")

    # Check database connections
    print("\nTesting database connections:")
    try:
        # Test PostgreSQL connection
        postgres_url = os.getenv("POSTGRES_URL")
        if postgres_url:
            conn = psycopg2.connect(postgres_url)
            print("PostgreSQL connection: Success")
            conn.close()
        else:
            print("PostgreSQL connection: Failed - URL not configured")
    except Exception as e:
        print(f"PostgreSQL connection: Failed - {str(e)}")

    try:
        # Test MongoDB connection
        mongodb_url = os.getenv("MONGODB_URL")
        if mongodb_url:
            client = MongoClient(mongodb_url)
            client.admin.command("ping")
            print("MongoDB connection: Success")
            client.close()
        else:
            print("MongoDB connection: Failed - URL not configured")
    except Exception as e:
        print(f"MongoDB connection: Failed - {str(e)}")

    # Check installed packages
    required_packages = [
        "numpy",
        "pandas",
        "pandas-ta",
        "fastapi",
        "sqlalchemy",
        "solana",
        "aiohttp",
        "python-dotenv",
    ]

    print("\nInstalled packages:")
    try:
        import pkg_resources

        for package in required_packages:
            version = pkg_resources.get_distribution(package).version
            print(f"{package}: {version}")
    except Exception as e:
        print(f"Error checking packages: {e}")


if __name__ == "__main__":
    verify_environment()
