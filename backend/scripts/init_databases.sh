#!/bin/bash
# CrashScribe Database Migration Setup Script
set -e

PSQL_BIN=$(which psql || echo "/opt/homebrew/opt/postgresql@15/bin/psql")
HOST="localhost"
PORT="5432"

echo "===================================================="
echo "Initializing CrashScribe Native PostgreSQL Databases"
echo "===================================================="

# 1. Create databases if not exists
for DB_NAME in crashscribe_auth crashscribe_reports crashscribe_analytics; do
  echo "Checking database: $DB_NAME..."
  if $PSQL_BIN -h "$HOST" -p "$PORT" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "  Database $DB_NAME already exists."
  else
    echo "  Creating database $DB_NAME..."
    $PSQL_BIN -h "$HOST" -p "$PORT" -d postgres -c "CREATE DATABASE $DB_NAME;"
  fi
done

echo ""
echo "Enabling extensions..."
$PSQL_BIN -h "$HOST" -p "$PORT" -d crashscribe_auth -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true
$PSQL_BIN -h "$HOST" -p "$PORT" -d crashscribe_reports -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true
$PSQL_BIN -h "$HOST" -p "$PORT" -d crashscribe_analytics -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true

echo "PostGIS check on crashscribe_analytics..."
$PSQL_BIN -h "$HOST" -p "$PORT" -d crashscribe_analytics -c "CREATE EXTENSION IF NOT EXISTS postgis;" || echo "  Note: PostGIS extension skipped if not compiled for this PostgreSQL instance."

echo ""
echo "===================================================="
echo "Database Initialization Completed Successfully!"
echo "===================================================="
