package config

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	Host              string
	Environment       string
	JWTSecret         string
	JWTRefreshSecret  string
	AuthServiceURL    string
	ReportServiceURL  string
	EvidenceServiceURL string
	AnalyticsServiceURL string
	RateLimitRequests int
	RateLimitWindow   time.Duration
}

func LoadConfig() *Config {
	// Attempt to load .env from workspace root or current dir
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &Config{
		Port:               getEnv("GATEWAY_PORT", "8080"),
		Host:               getEnv("GATEWAY_HOST", "0.0.0.0"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		JWTSecret:          getEnv("JWT_SECRET", "crashscribe_super_secret_jwt_dev_key_2026_assam_police_traffic"),
		JWTRefreshSecret:   getEnv("JWT_REFRESH_SECRET", "crashscribe_super_secret_refresh_dev_key_2026"),
		AuthServiceURL:     getEnv("AUTH_SERVICE_URL", "http://localhost:5001"),
		ReportServiceURL:   getEnv("REPORT_SERVICE_URL", "http://localhost:5002"),
		EvidenceServiceURL: getEnv("EVIDENCE_SERVICE_URL", "http://localhost:5003"),
		AnalyticsServiceURL: getEnv("ANALYTICS_SERVICE_URL", "http://localhost:5004"),
		RateLimitRequests:  100, // 100 requests
		RateLimitWindow:    1 * time.Minute,
	}

	log.Printf("[Config] Gateway Port: %s | Auth: %s | Reports: %s | Evidence: %s | Analytics: %s",
		cfg.Port, cfg.AuthServiceURL, cfg.ReportServiceURL, cfg.EvidenceServiceURL, cfg.AnalyticsServiceURL)

	return cfg
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
