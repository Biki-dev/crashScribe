#!/usr/bin/env bash
set -e

# ==============================================================================
# CrashScribe Complete System Launcher
# Boots Native PostgreSQL, 4 Microservices, Go Gateway, & Mobile Client
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
AMBER='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}      Launching CrashScribe Full System (Run-Ready)    ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Start PostgreSQL if not already running on port 5434
if ! pg_isready -h "$PROJECT_ROOT/.pgdata" -p 5434 >/dev/null 2>&1; then
  echo -e "${AMBER}Starting PostgreSQL database cluster on port 5434...${NC}"
  postgres -D "$PROJECT_ROOT/.pgdata" -p 5434 -k "$PROJECT_ROOT/.pgdata" -h 127.0.0.1 >/dev/null 2>&1 &
  sleep 1.5
fi
echo -e "${GREEN}✓ PostgreSQL is active on port 5434${NC}"

# PIDs to manage
AUTH_PID=""
REPORT_PID=""
EVIDENCE_PID=""
ANALYTICS_PID=""
GATEWAY_PID=""
MOBILE_PID=""

cleanup() {
  echo -e "\n${AMBER}Stopping CrashScribe processes...${NC}"
  [ -n "$AUTH_PID" ] && kill -9 "$AUTH_PID" 2>/dev/null || true
  [ -n "$REPORT_PID" ] && kill -9 "$REPORT_PID" 2>/dev/null || true
  [ -n "$EVIDENCE_PID" ] && kill -9 "$EVIDENCE_PID" 2>/dev/null || true
  [ -n "$ANALYTICS_PID" ] && kill -9 "$ANALYTICS_PID" 2>/dev/null || true
  [ -n "$GATEWAY_PID" ] && kill -9 "$GATEWAY_PID" 2>/dev/null || true
  [ -n "$MOBILE_PID" ] && kill -9 "$MOBILE_PID" 2>/dev/null || true
  echo -e "${GREEN}All services cleanly terminated.${NC}"
}
trap cleanup EXIT INT TERM

# 2. Start Microservices
echo -e "\n${BLUE}Launching 4 Domain Microservices...${NC}"
(cd "$PROJECT_ROOT/backend/services/auth-service" && node dist/index.js >/dev/null 2>&1) &
AUTH_PID=$!

(cd "$PROJECT_ROOT/backend/services/report-service" && node dist/index.js >/dev/null 2>&1) &
REPORT_PID=$!

(cd "$PROJECT_ROOT/backend/services/evidence-service" && node dist/index.js >/dev/null 2>&1) &
EVIDENCE_PID=$!

(cd "$PROJECT_ROOT/backend/services/analytics-service" && node dist/index.js >/dev/null 2>&1) &
ANALYTICS_PID=$!

# 3. Start Go API Gateway (:8080)
echo -e "${BLUE}Launching Go API Gateway (:8080)...${NC}"
(cd "$PROJECT_ROOT/backend/api-gateway" && ./api-gateway >/dev/null 2>&1) &
GATEWAY_PID=$!

# Wait for Gateway
retries=20
while [ $retries -gt 0 ]; do
  if curl -s http://localhost:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.4
  retries=$((retries - 1))
done

echo -e "${GREEN}✓ Go API Gateway is UP on http://localhost:8080${NC}"
echo -e "${GREEN}  - Auth Service:       http://localhost:5001${NC}"
echo -e "${GREEN}  - Report Service:     http://localhost:5002${NC}"
echo -e "${GREEN}  - Evidence Service:   http://localhost:5003${NC}"
echo -e "${GREEN}  - Analytics Service:  http://localhost:5004${NC}"

# 4. Start Mobile Web Client (:3000)
echo -e "\n${BLUE}Launching Mobile Client (:3000)...${NC}"
(cd "$PROJECT_ROOT/mobile" && npm run preview >/dev/null 2>&1) &
MOBILE_PID=$!

echo -e "${GREEN}✓ CrashScribe Mobile App is LIVE at:${NC} ${AMBER}http://localhost:3000${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Press [Ctrl+C] to stop all services."

# Wait indefinitely
wait
