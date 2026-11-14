package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/crashscribe/api-gateway/config"
	"github.com/crashscribe/api-gateway/routes"
)

func main() {
	log.Println("==================================================")
	log.Println(" Starting CrashScribe High-Performance API Gateway")
	log.Println("==================================================")

	// 1. Load Configuration
	cfg := config.LoadConfig()

	// 2. Setup Router & Reverse Proxies
	router, err := routes.SetupRouter(cfg)
	if err != nil {
		log.Fatalf("[Gateway Fatal] Failed to setup router: %v", err)
	}

	// 3. Configure HTTP Server with strict mobile network timeouts
	serverAddr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,  // Fast read timeout to avoid slow mobile client locks
		WriteTimeout: 15 * time.Second,  // Write timeout
		IdleTimeout:  120 * time.Second, // Long keep-alive timeout for mobile multiplexing
	}

	// 4. Graceful Shutdown listener
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Gateway Listening] http://%s (Health check: http://%s/health)", serverAddr, serverAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Gateway Error] Server listen failed: %v", err)
		}
	}()

	// Block until signal received
	<-shutdownChan
	log.Println("\n[Gateway Shutdown] Gracefully stopping server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[Gateway Error] Graceful shutdown failed: %v", err)
	}

	log.Println("[Gateway Stopped] Server cleanly terminated.")
}
