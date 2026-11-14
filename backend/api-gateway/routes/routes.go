package routes

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/crashscribe/api-gateway/config"
	"github.com/crashscribe/api-gateway/middleware"
	"github.com/crashscribe/api-gateway/proxy"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func SetupRouter(cfg *config.Config) (*chi.Mux, error) {
	r := chi.NewRouter()

	// Base Standard Middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Compress(5)) // Gzip compression
	r.Use(chimiddleware.Timeout(15 * time.Second)) // Enforce 15s mobile timeout

	// Custom Trace ID & Rate Limiting
	r.Use(middleware.TraceIDMiddleware)
	limiter := middleware.NewRateLimiter(cfg.RateLimitRequests, cfg.RateLimitWindow)
	r.Use(limiter.Middleware)

	// CORS Setup for Mobile & Web clients
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Trace-ID", "X-Idempotency-Key"},
		ExposedHeaders:   []string{"Link", "X-Trace-ID", "X-Idempotency-Key"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      "UP",
			"service":     "CrashScribe API Gateway",
			"timestamp":   time.Now().UTC().Format(time.RFC3339),
			"environment": cfg.Environment,
		})
	})

	// Setup Reverse Proxies for Upstream Microservices
	authProxy, err := proxy.NewReverseProxy(cfg.AuthServiceURL)
	if err != nil {
		return nil, err
	}

	reportProxy, err := proxy.NewReverseProxy(cfg.ReportServiceURL)
	if err != nil {
		return nil, err
	}

	evidenceProxy, err := proxy.NewReverseProxy(cfg.EvidenceServiceURL)
	if err != nil {
		return nil, err
	}

	analyticsProxy, err := proxy.NewReverseProxy(cfg.AnalyticsServiceURL)
	if err != nil {
		return nil, err
	}

	// Route Group: /api/v1
	r.Route("/api/v1", func(api chi.Router) {
		// 1. Auth Service Routes (Public login/signup & Protected profile)
		api.Route("/auth", func(auth chi.Router) {
			// Public auth endpoints: /signup, /register, /login, /refresh
			auth.Post("/signup", authProxy.ServeHTTP)
			auth.Post("/register", authProxy.ServeHTTP)
			auth.Post("/login", authProxy.ServeHTTP)
			auth.Post("/refresh", authProxy.ServeHTTP)

			// Protected auth endpoints: /profile
			auth.Group(func(protected chi.Router) {
				protected.Use(middleware.AuthGuard(cfg.JWTSecret))
				protected.Get("/profile", authProxy.ServeHTTP)
				protected.Put("/profile", authProxy.ServeHTTP)
			})
		})

		// 2. Protected Microservice Route Groups
		api.Group(func(protected chi.Router) {
			protected.Use(middleware.AuthGuard(cfg.JWTSecret))

			// Accident Reports & Ingestion Service
			protected.Mount("/reports", reportProxy)

			// Evidence Service (Presigned URLs, File confirm)
			protected.Mount("/evidence", evidenceProxy)

			// Analytics & Dashboard Service (Map clusters, KPIs, blackspots)
			protected.Mount("/analytics", analyticsProxy)
		})
	})

	return r, nil
}
