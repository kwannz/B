from setuptools import setup, find_packages

setup(
    name="tradingbot",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.100.0",
        "pydantic>=2.0.0",
        "sqlalchemy>=1.4.0",
        "aiohttp>=3.8.0",
        "beautifulsoup4>=4.9.0",
        "pytest>=7.0.0",
        "pytest-asyncio>=0.21.0"
    ]
)
