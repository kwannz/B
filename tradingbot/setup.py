from setuptools import setup, find_packages

setup(
    name="trading-bot",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.21.0",
        "pytest>=7.0.0",
        "pytest-asyncio>=0.18.0",
        "pytest-cov>=3.0.0",
    ],
    python_requires=">=3.8",
)
