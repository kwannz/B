import asyncio
import os
import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient

async def verify_wallet():
    try:
        # Initialize Solana client
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        
        # Get wallet key from environment
        wallet_key = os.environ.get("walletkey")
        if not wallet_key:
            print("Error: walletkey not found in environment")
            return False
            
        # Verify key format and create keypair
        try:
            decoded_key = base58.b58decode(wallet_key)
            if len(decoded_key) != 64:
                print("Error: Invalid key length")
                return False
                
            keypair = Keypair.from_bytes(decoded_key)
            address = str(keypair.pubkey())
            expected_address = "4BKPzFyjBaRP3L1PNDf3xTerJmbbxxESmDmZJ2CZYdQ5"
            
            print("\nWallet Verification Results:")
            print(f"Generated Address: {address}")
            print(f"Expected Address:  {expected_address}")
            
            if address != expected_address:
                print("❌ Verification Failed: Address mismatch")
                return False
                
            # Get and verify balance
            response = await client.get_balance(keypair.pubkey())
            if response.value is not None:
                balance = float(response.value) / 1e9
                print(f"\nBalance: {balance} SOL")
            
            print("✅ Verification Successful: Key and address match")
            return True
            
        except Exception as e:
            print(f"Error: Invalid key format - {e}")
            return False
            
    except Exception as e:
        print(f"Error verifying wallet: {e}")
        return False
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(verify_wallet())
