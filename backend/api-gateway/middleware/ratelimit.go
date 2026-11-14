package middleware

import (
	"net/http"
	"sync"
	"time"
)

type clientRecord struct {
	tokens     int
	lastRefill time.Time
}

type RateLimiter struct {
	sync.Mutex
	rate    int
	window  time.Duration
	clients map[string]*clientRecord
}

func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		rate:    rate,
		window:  window,
		clients: make(map[string]*clientRecord),
	}

	// Background cleanup of stale IP records every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := getIP(r)

		rl.Lock()
		record, exists := rl.clients[clientIP]
		now := time.Now()

		if !exists {
			rl.clients[clientIP] = &clientRecord{
				tokens:     rl.rate - 1,
				lastRefill: now,
			}
			rl.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		// Refill tokens proportionally to elapsed time
		elapsed := now.Sub(record.lastRefill)
		if elapsed >= rl.window {
			record.tokens = rl.rate
			record.lastRefill = now
		}

		if record.tokens <= 0 {
			rl.Unlock()
			respondJSONError(w, http.StatusTooManyRequests, "Rate limit exceeded. Too many requests from this device/IP.")
			return
		}

		record.tokens--
		rl.Unlock()

		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) cleanup() {
	rl.Lock()
	defer rl.Unlock()

	now := time.Now()
	for ip, record := range rl.clients {
		if now.Sub(record.lastRefill) > rl.window*2 {
			delete(rl.clients, ip)
		}
	}
}

func getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	return r.RemoteAddr
}
