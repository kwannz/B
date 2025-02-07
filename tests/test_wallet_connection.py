from solana.rpc.api import Client
from solana.keypair import Keypair
import base58
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    try:
        # Test RPC connection
        rpc_client = Client(os.getenv('HELIUS_RPC_URL'))
        health = rpc_client.get_health()
        logger.info(f'RPC Health: {health}')

        # Test wallet key
        wallet_key = os.getenv('SOLANA_WALLET_KEY')
        keypair = Keypair.from_secret_key(base58.b58decode(wallet_key))
        logger.info(f'Wallet Address: {keypair.public_key}')

        # Get wallet balance
        balance = rpc_client.get_balance(str(keypair.public_key))
        logger.info(f'Wallet Balance: {balance["result"]["value"] / 10**9} SOL')

    except Exception as e:
        logger.error(f'Error testing wallet connection: {e}')
        raise

if __name__ == '__main__':
    main()
