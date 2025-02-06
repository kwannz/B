import sys
import importlib

required_packages = [
    'fastapi',
    'uvicorn',
    'pydantic',
    'motor',
    'pymongo',
    'dotenv',
    'redis',
    'sqlalchemy',
    'asyncpg',
    'psycopg2',
    'aiohttp',
    'websockets'
]

missing_packages = []
for package in required_packages:
    try:
        importlib.import_module(package)
        print(f"✓ {package}")
    except ImportError as e:
        missing_packages.append(package)
        print(f"✗ {package}: {str(e)}")

if missing_packages:
    print("\nMissing packages:", ", ".join(missing_packages))
    sys.exit(1)
print("\nAll required packages are installed")
