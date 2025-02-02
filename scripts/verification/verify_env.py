import ssl
import sys
import importlib


def verify_environment():
    # Check Python version
    print(f"Python version: {sys.version}")

    # Check SSL support
    print(f"SSL support: {ssl.OPENSSL_VERSION}")

    # Check required packages
    required_packages = [
        "aiohttp",
        "fastapi",
        "sqlalchemy",
        "pandas",
        "cryptography",
        "uvicorn",
        "pydantic",
        "python-jose",
        "passlib",
    ]

    for package in required_packages:
        try:
            if package == "python-jose":
                import jose

                print(f"✓ {package} imported successfully (version {jose.__version__})")
            else:
                importlib.import_module(package)
                print(f"✓ {package} imported successfully")
        except ImportError as e:
            print(f"✗ Failed to import {package}: {str(e)}")
            sys.exit(1)

    print("\nEnvironment verification completed successfully!")


if __name__ == "__main__":
    verify_environment()
