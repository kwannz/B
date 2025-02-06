from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager

def verify_wallet():
    wm = WalletManager()
    wm.initialize_wallet(os.environ.get("WALLET_KEY"))
    print(f"Wallet initialized with public key: {wm.get_public_key()}")

if __name__ == "__main__":
    import os
    verify_wallet()
