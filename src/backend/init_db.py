import os
import sys

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.tradingbot.api.core.deps import init_db
from src.tradingbot.api.core.config import Settings

def main():
    print("Initializing database...")
    init_db()
    print(f"Database initialized at {Settings().DATABASE_URL}")

if __name__ == "__main__":
    main()
