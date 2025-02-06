import os
import base58
from solders.keypair import Keypair

def verify_wallet():
    """Verify wallet address from private key."""
    try:
        private_key = os.environ.get("walletkey")
        private_key_bytes = base58.b58decode(private_key)
        seed = private_key_bytes[:32]
        keypair = Keypair.from_seed(seed)
        public_key = str(keypair.pubkey())
        print(f"Wallet public key: {public_key}")
        print(f"Solscan link: https://solscan.io/account/{public_key}")
    except Exception as e:
        print(f"Error verifying wallet: {e}")

if __name__ == "__main__":
    verify_wallet()
