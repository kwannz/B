import os

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def init_database():
    # Database connection parameters
    dbname = os.getenv("POSTGRES_DB", "tradingbot")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")

    # Connect to PostgreSQL server
    conn = psycopg2.connect(
        dbname="postgres", user=user, password=password, host=host, port=port
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    try:
        # Ensure postgres user exists and has necessary privileges
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname='postgres'")
        if not cur.fetchone():
            cur.execute("CREATE USER postgres WITH SUPERUSER")
        # Create database if it doesn't exist
        cur.execute(
            "SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (dbname,)
        )
        exists = cur.fetchone()
        if not exists:
            print(f"Creating database {dbname}...")
            cur.execute("CREATE DATABASE %s", (dbname,))
            cur.execute(f"GRANT ALL PRIVILEGES ON DATABASE {dbname} TO postgres")
            print(f"Database {dbname} created successfully")
    finally:
        cur.close()
        conn.close()

    # Connect to the trading bot database
    conn = psycopg2.connect(
        dbname=dbname, user=user, password=password, host=host, port=port
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    try:
        # Read and execute SQL initialization script
        print("Initializing database schema...")
        with open("init_db.sql", "r") as f:
            sql_script = f.read()
            cur.execute(sql_script)
        print("Database schema initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    try:
        init_database()
        print("Database initialization completed successfully")
    except Exception as e:
        print(f"Database initialization failed: {str(e)}")
        exit(1)
