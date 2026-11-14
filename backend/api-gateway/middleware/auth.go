package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type OfficerClaims struct {
	OfficerID     string `json:"officer_id"`
	OfficialID    string `json:"official_id"`
	District      string `json:"district"`
	PoliceStation string `json:"police_station"`
	Role          string `json:"role"`
	jwt.RegisteredClaims
}

// AuthGuard verifies JWT Bearer tokens and enriches downstream headers with trusted identity claims
func AuthGuard(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondJSONError(w, http.StatusUnauthorized, "Missing Authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				respondJSONError(w, http.StatusUnauthorized, "Invalid Authorization header format. Expected 'Bearer <token>'")
				return
			}

			tokenString := parts[1]
			claims := &OfficerClaims{}

			token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				respondJSONError(w, http.StatusUnauthorized, "Invalid, expired, or malformed authentication token")
				return
			}

			// Sanitize any untrusted incoming headers from client
			r.Header.Del("X-Officer-ID")
			r.Header.Del("X-Official-ID")
			r.Header.Del("X-District-ID")
			r.Header.Del("X-Station-ID")
			r.Header.Del("X-User-Role")

			// Inject verified officer claims for downstream services
			r.Header.Set("X-Officer-ID", claims.OfficerID)
			r.Header.Set("X-Official-ID", claims.OfficialID)
			r.Header.Set("X-District-ID", claims.District)
			r.Header.Set("X-Station-ID", claims.PoliceStation)
			r.Header.Set("X-User-Role", claims.Role)

			next.ServeHTTP(w, r)
		})
	}
}

func respondJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
		"code":    status,
	})
}
