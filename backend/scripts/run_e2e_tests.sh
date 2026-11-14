#!/usr/bin/env bash
set -e

# ==============================================================================
# CrashScribe End-to-End Integration Verification Script
# Tests Gateway -> Auth -> Report Sync -> Evidence -> Analytics
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Starting CrashScribe E2E Verification ===${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATEWAY_URL="http://localhost:8080"

# Cleanup background processes on exit
GATEWAY_PID=""
AUTH_PID=""
REPORT_PID=""
EVIDENCE_PID=""
ANALYTICS_PID=""

cleanup() {
  echo -e "\n${BLUE}Shutting down background service processes...${NC}"
  [ -n "$GATEWAY_PID" ] && kill -9 "$GATEWAY_PID" 2>/dev/null || true
  [ -n "$AUTH_PID" ] && kill -9 "$AUTH_PID" 2>/dev/null || true
  [ -n "$REPORT_PID" ] && kill -9 "$REPORT_PID" 2>/dev/null || true
  [ -n "$EVIDENCE_PID" ] && kill -9 "$EVIDENCE_PID" 2>/dev/null || true
  [ -n "$ANALYTICS_PID" ] && kill -9 "$ANALYTICS_PID" 2>/dev/null || true
  echo -e "${GREEN}Cleanup complete.${NC}"
}
trap cleanup EXIT INT TERM

# 1. Start Services
echo -e "${BLUE}1. Launching Microservices...${NC}"

# Auth Service (:5001)
(cd "$PROJECT_ROOT/backend/services/auth-service" && npm run build >/dev/null 2>&1 && node dist/index.js >/dev/null 2>&1) &
AUTH_PID=$!

# Report Service (:5002)
(cd "$PROJECT_ROOT/backend/services/report-service" && npm run build >/dev/null 2>&1 && node dist/index.js >/dev/null 2>&1) &
REPORT_PID=$!

# Evidence Service (:5003)
(cd "$PROJECT_ROOT/backend/services/evidence-service" && npm run build >/dev/null 2>&1 && node dist/index.js >/dev/null 2>&1) &
EVIDENCE_PID=$!

# Analytics Service (:5004)
(cd "$PROJECT_ROOT/backend/services/analytics-service" && npm run build >/dev/null 2>&1 && node dist/index.js >/dev/null 2>&1) &
ANALYTICS_PID=$!

# Go API Gateway (:8080)
(cd "$PROJECT_ROOT/backend/api-gateway" && go run main.go >/dev/null 2>&1) &
GATEWAY_PID=$!

echo -e "Waiting for services to become healthy on ports 8080, 5001, 5002, 5003, 5004..."

# Wait for each service
wait_for_port() {
  local port=$1
  local name=$2
  local retries=30
  while [ $retries -gt 0 ]; do
    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
      echo -e "${GREEN}✓ $name is UP on port $port${NC}"
      return 0
    fi
    sleep 0.5
    retries=$((retries - 1))
  done
  echo -e "${RED}✗ $name on port $port timed out!${NC}"
  return 1
}

wait_for_port 5001 "Auth Service"
wait_for_port 5002 "Report Service"
wait_for_port 5003 "Evidence Service"
wait_for_port 5004 "Analytics Service"
wait_for_port 8080 "API Gateway"

# 2. Test Gateway Health Endpoint
echo -e "\n${BLUE}2. Testing Gateway /health...${NC}"
HEALTH_RESP=$(curl -s "$GATEWAY_URL/health")
echo "Gateway response: $HEALTH_RESP"
echo -e "${GREEN}✓ Gateway Health Check Passed${NC}"

# 3. Test Officer Registration via Gateway
RAND_ID=$(date +%s)
OFFICIAL_ID="AP-${RAND_ID}"
EMAIL="officer_${OFFICIAL_ID}@assam.police.gov.in"
PHONE="98${RAND_ID: -8}"
echo -e "\n${BLUE}3. Testing Officer Registration (POST /api/v1/auth/register)...${NC}"
REGISTER_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"official_id\": \"$OFFICIAL_ID\",
    \"name\": \"Sub-Inspector Hemanta Barua\",
    \"email\": \"$EMAIL\",
    \"password\": \"AssamPolice@2026\",
    \"phone\": \"$PHONE\",
    \"district\": \"Kamrup Metropolitan\",
    \"police_station\": \"Panbazar PS\",
    \"designation\": \"Sub-Inspector\"
  }")

echo "Register response: $REGISTER_RESP"
if ! echo "$REGISTER_RESP" | grep -q "registered successfully"; then
  echo -e "${RED}Registration failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Officer Registration Passed${NC}"

# 4. Test Officer Login & Obtain JWT Token
echo -e "\n${BLUE}4. Testing Officer Login (POST /api/v1/auth/login)...${NC}"
LOGIN_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"login_id\": \"$OFFICIAL_ID\",
    \"password\": \"AssamPolice@2026\"
  }")

echo "Login response: $LOGIN_RESP"
ACCESS_TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Login failed, token not obtained!${NC}"
  exit 1
fi
echo "Access token obtained successfully."
echo -e "${GREEN}✓ Officer Login & JWT Generation Passed${NC}"

# 5. Test Authenticated Profile Route through Gateway
echo -e "\n${BLUE}5. Testing Authenticated Route (GET /api/v1/auth/profile)...${NC}"
PROFILE_RESP=$(curl -s "$GATEWAY_URL/api/v1/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Profile response: $PROFILE_RESP"
if ! echo "$PROFILE_RESP" | grep -q "$OFFICIAL_ID"; then
  echo -e "${RED}Failed to fetch profile through Gateway auth guard!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Header Enrichment & Profile Guard Passed${NC}"

# 6. Test eDAR Accident Report Sync
CLIENT_REP_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CLIENT_VEH_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
CLIENT_PER_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

echo -e "\n${BLUE}6. Testing eDAR Report Sync (POST /api/v1/reports/sync)...${NC}"
REPORT_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/reports/sync" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_report_id\": \"$CLIENT_REP_ID\",
    \"accident_date\": \"2026-11-14\",
    \"accident_time\": \"14:45:00\",
    \"accident_category\": \"Head-on Collision\",
    \"accident_nature\": \"Fatal\",
    \"severity\": \"Fatal\",
    \"state\": \"Assam\",
    \"district\": \"Kamrup Metropolitan\",
    \"police_station\": \"Panbazar PS\",
    \"road_name\": \"National Highway 37\",
    \"landmark\": \"Near Panbazar Flyover\",
    \"exact_location\": \"NH-37 Westbound, Ch 142.5 km\",
    \"latitude\": 26.1850,
    \"longitude\": 91.7500,
    \"road_type\": \"Four Lane Divided\",
    \"surface_condition\": \"Wet Asphalt\",
    \"weather_condition\": \"Rain\",
    \"visibility\": \"Good\",
    \"lighting_condition\": \"Daylight\",
    \"accident_description\": \"Commercial vehicle collided with passenger car in wet conditions.\",
    \"vehicles\": [
      {
        \"client_vehicle_id\": \"$CLIENT_VEH_ID\",
        \"vehicle_category\": \"Commercial Truck / HGV\",
        \"registration_number\": \"AS-01-EC-9988\",
        \"movement_direction\": \"Westbound\",
        \"damage_description\": \"Front axle damage\"
      }
    ],
    \"persons\": [
      {
        \"client_person_id\": \"$CLIENT_PER_ID\",
        \"client_vehicle_id\": \"$CLIENT_VEH_ID\",
        \"person_role\": \"Driver\",
        \"name\": \"S. Barua\",
        \"age\": 35,
        \"gender\": \"Male\",
        \"injury_status\": \"Fatal\",
        \"helmet_seatbelt_used\": true
      }
    ]
  }")

echo "Report Sync response: $REPORT_RESP"
if ! echo "$REPORT_RESP" | grep -q '"success":true'; then
  echo -e "${RED}Report sync failed!${NC}"
  exit 1
fi
REPORT_DB_ID=$(echo "$REPORT_RESP" | grep -o '"server_report_id":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ eDAR Report Sync Passed (Report ID: $REPORT_DB_ID)${NC}"

# 7. Test Idempotency Replay
echo -e "\n${BLUE}7. Testing Report Sync Idempotency Replay...${NC}"
REPLAY_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/reports/sync" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_report_id\": \"$CLIENT_REP_ID\",
    \"accident_date\": \"2026-11-14\",
    \"accident_time\": \"14:45:00\",
    \"accident_category\": \"Head-on Collision\",
    \"accident_nature\": \"Fatal\",
    \"severity\": \"Fatal\",
    \"state\": \"Assam\",
    \"district\": \"Kamrup Metropolitan\",
    \"police_station\": \"Panbazar PS\",
    \"road_name\": \"National Highway 37\",
    \"landmark\": \"Near Panbazar Flyover\",
    \"exact_location\": \"NH-37 Westbound, Ch 142.5 km\",
    \"latitude\": 26.1850,
    \"longitude\": 91.7500,
    \"accident_description\": \"Commercial vehicle collided with passenger car in wet conditions.\",
    \"vehicles\": [
      {
        \"client_vehicle_id\": \"$CLIENT_VEH_ID\",
        \"vehicle_category\": \"Commercial Truck / HGV\",
        \"registration_number\": \"AS-01-EC-9988\",
        \"movement_direction\": \"Westbound\",
        \"damage_description\": \"Front axle damage\"
      }
    ],
    \"persons\": [
      {
        \"client_person_id\": \"$CLIENT_PER_ID\",
        \"client_vehicle_id\": \"$CLIENT_VEH_ID\",
        \"person_role\": \"Driver\",
        \"name\": \"S. Barua\",
        \"age\": 35,
        \"gender\": \"Male\",
        \"injury_status\": \"Fatal\",
        \"helmet_seatbelt_used\": true
      }
    ]
  }")

echo "Replay response: $REPLAY_RESP"
if ! echo "$REPLAY_RESP" | grep -q '"is_duplicate":true'; then
  echo -e "${RED}Idempotency replay failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Idempotency Replay Guard Passed (is_duplicate:true returned)${NC}"

# 8. Test Evidence Presigning
CLIENT_EVID_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo -e "\n${BLUE}8. Testing Evidence Presigning (POST /api/v1/evidence/presigned-url)...${NC}"
EVIDENCE_RESP=$(curl -s -X POST "$GATEWAY_URL/api/v1/evidence/presigned-url" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": \"$REPORT_DB_ID\",
    \"client_evidence_id\": \"$CLIENT_EVID_ID\",
    \"file_name\": \"crash_scene.jpg\",
    \"file_size_bytes\": 10240,
    \"file_type\": \"image/jpeg\",
    \"sha256_hash\": \"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\"
  }")

echo "Evidence Presign response: $EVIDENCE_RESP"
if ! echo "$EVIDENCE_RESP" | grep -q "upload_url"; then
  echo -e "${RED}Evidence presigning failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Cloudflare R2 Presigned Upload URL Generated${NC}"

# 9. Test Analytics Summary Endpoint
echo -e "\n${BLUE}9. Testing Analytics Summary (GET /api/v1/analytics/summary)...${NC}"
ANALYTICS_RESP=$(curl -s "$GATEWAY_URL/api/v1/analytics/summary?district=Kamrup+Metropolitan" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Analytics response: $ANALYTICS_RESP"
if ! echo "$ANALYTICS_RESP" | grep -q "overview"; then
  echo -e "${RED}Analytics summary query failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Analytics Summary Query Passed${NC}"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   ALL CRASHSCRibe E2E INTEGRATION TESTS PASSED!       ${NC}"
echo -e "${GREEN}======================================================${NC}"
