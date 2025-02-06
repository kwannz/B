from setuptools import setup, find_packages

setup(
    name="tradingbot",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "aiohttp",
        "pandas",
        "pandas_ta",
        "solana",
        "base58",
    ],
)
