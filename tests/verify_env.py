import asyncio
from tradingbot.backend.shared.modules.solana_dex_integration import MarketDataAggregator
from tradingbot.shared.exchange.dex_client import DEXClient

async def verify_environment():
    print("Verifying trading environment...")
    
    # Test market data aggregator
    aggregator = MarketDataAggregator()
    test_token = "So11111111111111111111111111111111111111112"  # SOL token address
    market_data = await aggregator.get_market_data(test_token)
    print("Market data aggregator initialized successfully")
    print(f"Market data retrieved: {market_data}")
    
    # Test DEX client
    dex_client = DEXClient()
    await dex_client.start()
    print("DEX client initialized successfully")
    await dex_client.stop()
    
    print("Trading environment verification complete")

if __name__ == "__main__":
    asyncio.run(verify_environment())
