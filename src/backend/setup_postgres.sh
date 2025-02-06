#!/bin/bash
psql -v ON_ERROR_STOP=1 <<-EOSQL
    DROP DATABASE IF EXISTS tradingbot;
    DROP USER IF EXISTS admin;
    CREATE USER admin WITH PASSWORD 'admin' CREATEDB;
    CREATE DATABASE tradingbot OWNER admin;
EOSQL
