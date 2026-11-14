package proxy

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

type ReverseProxyHandler struct {
	targetURL *url.URL
	proxy     *httputil.ReverseProxy
}

func NewReverseProxy(targetStr string) (*ReverseProxyHandler, error) {
	target, err := url.Parse(targetStr)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom Transport with mobile network connection tuning
	proxy.Transport = &http.Transport{
		MaxIdleConns:        1000,
		MaxIdleConnsPerHost: 200,
		IdleConnTimeout:     120 * time.Second,
		DisableCompression:  false, // Enable gzip support
	}

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host

		// Forward original protocol & host
		if req.Header.Get("X-Forwarded-Host") == "" {
			req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		}

		log.Printf("[Proxy] Forwarding %s %s -> %s%s", req.Method, req.URL.Path, targetStr, req.URL.RequestURI())
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		log.Printf("[Proxy Error] Upstream service %s unavailable: %v", targetStr, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"success":false,"error":"Upstream service temporarily unavailable. Please retry.","code":502}`))
	}

	return &ReverseProxyHandler{
		targetURL: target,
		proxy:     proxy,
	}, nil
}

func (h *ReverseProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Preserve client context cancellation (e.g. if mobile device disconnects mid-flight)
	h.proxy.ServeHTTP(w, r)
}

// StripPrefixProxy strips a prefix before reverse-proxying if needed
func StripPrefixProxy(prefix string, handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, prefix)
		if !strings.HasPrefix(r.URL.Path, "/") {
			r.URL.Path = "/" + r.URL.Path
		}
		handler.ServeHTTP(w, r)
	})
}
