from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solana.rpc.api import Client
import base58
import json


def test_wallet():
    """Test wallet functionality on Solana testnet"""
    # Initialize Solana client (testnet)
    client = Client("https://api.testnet.solana.com")

    # Test wallet private key
    private_key_bytes = base58.b58decode(
        "29f8rVGdqnNAeJPffprmrPzbXnbuhTwRML4EeZYRsG3oyHcXnFpVvSxrC87s3YJy4UqRoYQSpCTNMpBH8q5VkzMx"
    )
    keypair = Keypair.from_bytes(private_key_bytes)
    pubkey = keypair.pubkey()

    # Verify wallet address matches
    print("Wallet Verification:")
    print(f"Expected address: Bmy8pkxSMLHTdaCop7urr7b4FPqs3QojVsGuC9Ly4vsU")
    print(f"Generated address: {pubkey}")

    # Get account info and balance
    response = client.get_account_info(pubkey)
    balance = client.get_balance(pubkey)
    print("\nAccount Status:")
    print(f"Balance: {balance.value / 10**9} SOL")
    print(f"Account exists: {response.value is not None}")


if __name__ == "__main__":
    test_wallet()
