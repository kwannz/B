#!/bin/bash
set -e

echo "=== Configuring PostgreSQL ==="
# Update pg_hba.conf to use trust authentication temporarily
sudo bash -c 'cat > /etc/postgresql/*/main/pg_hba.conf << EOL
local   all             postgres                                trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOL'

echo "=== Restarting PostgreSQL ==="
sudo service postgresql restart

echo "=== Setting up database ==="
# Set password and create database without password prompt
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'trading_postgres_pass_123';"
sudo -u postgres createdb -O postgres tradingbot 2>/dev/null || true

# Update pg_hba.conf to use md5 authentication
sudo bash -c 'cat > /etc/postgresql/*/main/pg_hba.conf << EOL
local   all             postgres                                md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOL'

echo "=== Restarting PostgreSQL ==="
sudo service postgresql restart

echo "=== Setting environment variables ==="
export POSTGRES_DB=tradingbot
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=trading_postgres_pass_123
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
export PYTHONPATH=/home/ubuntu/repos/B

echo "=== Installing local package ==="
cd /home/ubuntu/repos/B/src/tradingbot && pip install -e .

echo "=== Initializing database schema ==="
cd /home/ubuntu/repos/B/src/backend
PGPASSWORD="${POSTGRES_PASSWORD}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1;" > /dev/null 2>&1 || exit 1
python init_db.py
