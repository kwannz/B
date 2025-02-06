from setuptools import setup, find_packages

setup(
    name="tradingbot",
    version="0.1.0",
    python_requires=">=3.12",
    packages=find_packages(),
    install_requires=[
        "aiohttp>=3.9.1",
        "pandas>=2.2.0",
        "pandas_ta>=0.3.14b",
        "solana>=0.30.2",
        "base58>=2.1.1",
        "solders>=0.20.0",
        "httpx>=0.26.0",
    ],
)
