import os

# Environment
PYTHON_VERSION = "3.12"
GO_VERSION = "1.23"

# GMGN API Configuration
GMGN_API_BASE_URL = "https://gmgn.ai/defi/router/v1/sol"
GMGN_API_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://gmgn.ai",
    "Referer": "https://gmgn.ai/",
    "Accept-Language": "en-US,en;q=0.9"
}

# Trading Configuration
SLIPPAGE_TOLERANCE = "0.5"  # 0.5%
PLATFORM_FEE = "0.002"  # 0.2%
USE_ANTI_MEV = True

# Token Addresses
SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112"
USDC_TOKEN_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Network Configuration
RPC_URL = "https://api.mainnet-beta.solana.com"
COMMITMENT_LEVEL = "confirmed"
