import asyncio
import os
import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient

async def verify_solana_wallet():
    try:
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        
        # Initialize Solana keypair
        try:
            wallet_key = os.environ.get("walletkey")
            if not wallet_key:
                raise ValueError("walletkey not found in environment")
                
            keypair = Keypair.from_bytes(base58.b58decode(wallet_key))
            address = str(keypair.pubkey())
            
            print("\nSolana Wallet Verification:")
            print(f"Public Key (Address): {address}")
            
            # Verify wallet configuration
            if not os.environ.get("WALLET_ADDRESS"):
                print("✗ Missing required configuration")
                return
                
            # Get and display balance
            response = await client.get_balance(keypair.pubkey())
            if response.value is not None:
                balance = float(response.value) / 1e9
                print(f"Balance: {balance} SOL")
                print("✓ Wallet verification successful")
            else:
                print("✗ Balance check failed")
        except Exception as e:
            print(f"Error: Invalid key format - {e}")
            return
        
        print("\nSolana Wallet Verification:")
        print(f"Wallet Address: {address}")
        
        # Verify balance
        response = await client.get_balance(keypair.pubkey())
        if response.value is not None:
            balance = float(response.value) / 1e9
            print(f"Balance: {balance} SOL")
            
        # Verify address matches expected
        expected_address = "4BKPzFyjBaRP3L1PNDf3xTerJmbbxxESmDmZJ2CZYdQ5"
        if address == expected_address:
            print("✓ Wallet verification successful")
        else:
            print("✗ Wallet verification failed")
            print(f"Expected: {expected_address}")
            print(f"Got: {address}")
            
        await client.close()
        
    except Exception as e:
        print(f"Error verifying wallet: {e}")

if __name__ == "__main__":
    asyncio.run(verify_solana_wallet())
