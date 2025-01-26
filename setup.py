from setuptools import setup, find_packages

setup(
    name="tradingbot",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.95.0,<0.105.0",
        "uvicorn>=0.22.0,<0.25.0",
        "sqlalchemy>=2.0.23",
        "alembic>=1.13.1",
        "psycopg2-binary>=2.9.9",
    ],
    python_requires=">=3.11",
)

