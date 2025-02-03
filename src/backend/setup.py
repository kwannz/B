from setuptools import find_packages, setup

setup(
    name="tradingbot",
    version="0.1.0",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "fastapi==0.95.0",
        "uvicorn==0.21.0",
        "pydantic==1.10.12",
        "motor==2.5.1",
        "pymongo==3.12.3",
        "redis==4.5.4",
        "sqlalchemy==2.0.0",
        "asyncpg==0.27.0",
        "python-jose==3.3.0",
        "passlib==1.7.4",
        "python-multipart==0.0.6",
        "aiohttp==3.8.4",
        "websockets==11.0.3",
        "python-dotenv==0.19.0",
    ],
)
