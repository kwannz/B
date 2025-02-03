from setuptools import setup, find_packages

setup(
    name="tradingbot",
    version="0.1.0",
    packages=find_packages(where="src/backend"),
    package_dir={"": "src/backend"},
    python_requires=">=3.8",
    install_requires=[
        "aiohttp",
        "pytest",
        "pytest-asyncio",
        "pytest-cov",
        "nest-asyncio",
    ],
)
