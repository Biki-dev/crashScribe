package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/crashscribe/api-gateway/config"
	"github.com/crashscribe/api-gateway/middleware"
	"github.com/golang-jwt/jwt/v5"
)

func TestHealthCheck(t *testing.T) {
	cfg := &config.Config{
		Port:               "8080",
		Environment:        "test",
		JWTSecret:          "test_jwt_secret",
		AuthServiceURL:     "http://localhost:5001",
		ReportServiceURL:   "http://localhost:5002",
		EvidenceServiceURL: "http://localhost:5003",
		AnalyticsServiceURL: "http://localhost:5004",
		RateLimitRequests:  100,
		RateLimitWindow:    time.Minute,
	}

	router, err := SetupRouter(cfg)
	if err != nil {
		t.Fatalf("Failed to setup router: %v", err)
	}

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	// Verify X-Trace-ID header is generated
	traceID := w.Header().Get("X-Trace-ID")
	if traceID == "" {
		t.Fatalf("Expected X-Trace-ID header in response")
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if resp["status"] != "UP" {
		t.Errorf("Expected status UP, got %v", resp["status"])
	}
}

func TestAuthGuard_Unauthorized(t *testing.T) {
	cfg := &config.Config{
		Port:               "8080",
		Environment:        "test",
		JWTSecret:          "test_jwt_secret",
		AuthServiceURL:     "http://localhost:5001",
		ReportServiceURL:   "http://localhost:5002",
		EvidenceServiceURL: "http://localhost:5003",
		AnalyticsServiceURL: "http://localhost:5004",
		RateLimitRequests:  100,
		RateLimitWindow:    time.Minute,
	}

	router, err := SetupRouter(cfg)
	if err != nil {
		t.Fatalf("Failed to setup router: %v", err)
	}

	// 1. Missing Authorization Header
	req, _ := http.NewRequest("GET", "/api/v1/auth/profile", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for missing token, got %d", w.Code)
	}

	// 2. Invalid Token Format
	req2, _ := http.NewRequest("GET", "/api/v1/auth/profile", nil)
	req2.Header.Set("Authorization", "InvalidFormatToken")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for invalid format, got %d", w2.Code)
	}

	// 3. Bogus Token String
	req3, _ := http.NewRequest("GET", "/api/v1/auth/profile", nil)
	req3.Header.Set("Authorization", "Bearer invalid.signature.token")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for bogus token, got %d", w3.Code)
	}
}

func TestAuthGuard_ValidToken_HeaderEnrichment(t *testing.T) {
	secret := "test_secret_for_jwt_test"
	cfg := &config.Config{
		Port:               "8080",
		Environment:        "test",
		JWTSecret:          secret,
		AuthServiceURL:     "http://localhost:5001",
		ReportServiceURL:   "http://localhost:5002",
		EvidenceServiceURL: "http://localhost:5003",
		AnalyticsServiceURL: "http://localhost:5004",
		RateLimitRequests:  100,
		RateLimitWindow:    time.Minute,
	}

	// Create test upstream mock server to inspect enriched headers
	var capturedOfficerID, capturedDistrict, capturedRole string
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedOfficerID = r.Header.Get("X-Officer-ID")
		capturedDistrict = r.Header.Get("X-District-ID")
		capturedRole = r.Header.Get("X-User-Role")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"success":true}`))
	}))
	defer mockServer.Close()

	cfg.AuthServiceURL = mockServer.URL
	router, err := SetupRouter(cfg)
	if err != nil {
		t.Fatalf("Failed to setup router: %v", err)
	}

	// Generate valid signed JWT
	claims := middleware.OfficerClaims{
		OfficerID:     "officer-uuid-1234",
		OfficialID:    "AS-POL-99",
		District:      "Kamrup Metropolitan",
		PoliceStation: "Dispur",
		Role:          "OFFICER",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	// Dispatch request to protected route
	req, _ := http.NewRequest("GET", "/api/v1/auth/profile", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	// Inject spoofed header to verify it gets sanitized/overridden
	req.Header.Set("X-Officer-ID", "spoofed-hacker-id")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	if capturedOfficerID != "officer-uuid-1234" {
		t.Errorf("Expected X-Officer-ID 'officer-uuid-1234', got '%s'", capturedOfficerID)
	}
	if capturedDistrict != "Kamrup Metropolitan" {
		t.Errorf("Expected X-District-ID 'Kamrup Metropolitan', got '%s'", capturedDistrict)
	}
	if capturedRole != "OFFICER" {
		t.Errorf("Expected X-User-Role 'OFFICER', got '%s'", capturedRole)
	}
}
