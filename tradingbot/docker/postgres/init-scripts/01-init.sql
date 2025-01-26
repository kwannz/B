-- Create extensions in public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- Create system schema
CREATE SCHEMA IF NOT EXISTS system;

-- Set search path
ALTER DATABASE tradingbot SET search_path TO system,public;
