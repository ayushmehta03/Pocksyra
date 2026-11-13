package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env          string
	Port         string
	MongoURI     string
	MongoDB      string
	JWTSecret    string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
	CookieSecure bool
	CookieDomain string
	// Proxies whose X-Forwarded-For we trust (needed for correct client IPs in
	// rate limiting when deployed behind Fly/Cloud Run/nginx). Empty = trust none.
	TrustedProxies []string
}

func Load() (Config, error) {
	cfg := Config{
		Env:          getenv("APP_ENV", "development"),
		Port:         getenv("PORT", "8080"),
		MongoURI:     getenv("MONGO_URI", "mongodb://localhost:27017/?directConnection=true"),
		MongoDB:      getenv("MONGO_DB", "pocksyra"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		CookieDomain: os.Getenv("COOKIE_DOMAIN"),
	}

	for _, p := range strings.Split(os.Getenv("TRUSTED_PROXIES"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			cfg.TrustedProxies = append(cfg.TrustedProxies, p)
		}
	}

	var err error
	if cfg.AccessTTL, err = duration("ACCESS_TTL", 15*time.Minute); err != nil {
		return cfg, err
	}
	if cfg.RefreshTTL, err = duration("REFRESH_TTL", 30*24*time.Hour); err != nil {
		return cfg, err
	}
	if v := os.Getenv("COOKIE_SECURE"); v != "" {
		if cfg.CookieSecure, err = strconv.ParseBool(v); err != nil {
			return cfg, fmt.Errorf("COOKIE_SECURE: %w", err)
		}
	} else {
		cfg.CookieSecure = cfg.Env == "production"
	}

	if len(cfg.JWTSecret) < 32 {
		return cfg, errors.New("JWT_SECRET must be set and at least 32 characters")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func duration(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", key, err)
	}
	return d, nil
}
