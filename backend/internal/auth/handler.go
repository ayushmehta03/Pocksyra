package auth

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ayushmehta03/Pocksyra/backend/config"
	"github.com/ayushmehta03/Pocksyra/backend/internal/ratelimit"
)

const (
	accessCookie  = "access_token"
	refreshCookie = "refresh_token"
	ctxUserID     = "userID"
)

type Handler struct {
	svc          *Service
	cfg          config.Config
	ipLimiter    *ratelimit.Limiter // signup + login, per client IP
	emailLimiter *ratelimit.Limiter // signup + login, per email
}

func NewHandler(svc *Service, cfg config.Config) *Handler {
	return &Handler{
		svc:          svc,
		cfg:          cfg,
		ipLimiter:    ratelimit.New(20, 15*time.Minute),
		emailLimiter: ratelimit.New(10, 15*time.Minute),
	}
}

// LimitByIP throttles the credential endpoints per client IP.
func (h *Handler) LimitByIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		if ok, wait := h.ipLimiter.Allow(c.ClientIP()); !ok {
			tooMany(c, wait)
			return
		}
		c.Next()
	}
}

func tooMany(c *gin.Context, wait time.Duration) {
	c.Header("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many attempts, try again later"})
}

type signupRequest struct {
	Email    string `json:"email" binding:"required,email,max=254"`
	Username string `json:"username" binding:"required"`
	Name     string `json:"name" binding:"required,max=60"`
	Password string `json:"password" binding:"required,min=8,max=128"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	if ok, wait := h.emailLimiter.Allow("signup:" + normalizeEmail(req.Email)); !ok {
		tooMany(c, wait)
		return
	}
	u, err := h.svc.Signup(c.Request.Context(), SignupInput(req))
	switch {
	case errors.Is(err, ErrEmailTaken), errors.Is(err, ErrUsernameTaken):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	case errors.Is(err, ErrInvalidUsername):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	case err != nil:
		serverError(c, err)
		return
	}
	tokens, err := h.svc.NewSession(c.Request.Context(), u, c.Request.UserAgent())
	if err != nil {
		serverError(c, err)
		return
	}
	h.setAuthCookies(c, tokens)
	c.JSON(http.StatusCreated, gin.H{"user": u.Public()})
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	emailKey := "login:" + normalizeEmail(req.Email)
	if ok, wait := h.emailLimiter.Allow(emailKey); !ok {
		tooMany(c, wait)
		return
	}
	u, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if errors.Is(err, ErrInvalidCredentials) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}
	tokens, err := h.svc.NewSession(c.Request.Context(), u, c.Request.UserAgent())
	if err != nil {
		serverError(c, err)
		return
	}
	h.emailLimiter.Reset(emailKey)
	h.setAuthCookies(c, tokens)
	c.JSON(http.StatusOK, gin.H{"user": u.Public()})
}

func (h *Handler) Refresh(c *gin.Context) {
	rt, err := c.Cookie(refreshCookie)
	if err != nil || rt == "" {
		h.clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}
	u, tokens, err := h.svc.Refresh(c.Request.Context(), rt, c.Request.UserAgent())
	if errors.Is(err, ErrInvalidRefresh) {
		h.clearAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}
	h.setAuthCookies(c, tokens)
	c.JSON(http.StatusOK, gin.H{"user": u.Public()})
}

func (h *Handler) Logout(c *gin.Context) {
	if rt, err := c.Cookie(refreshCookie); err == nil && rt != "" {
		if err := h.svc.Logout(c.Request.Context(), rt); err != nil {
			serverError(c, err)
			return
		}
	}
	h.clearAuthCookies(c)
	c.Status(http.StatusNoContent)
}

func (h *Handler) Me(c *gin.Context) {
	u, err := h.svc.GetUser(c.Request.Context(), c.GetString(ctxUserID))
	if errors.Is(err, ErrUserNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": u.Public()})
}

type updateMeRequest struct {
	Name            *string `json:"name" binding:"omitempty,min=1,max=60"`
	AvatarURL       *string `json:"avatarUrl" binding:"omitempty,max=500"`
	DefaultCurrency *string `json:"defaultCurrency"`
	Timezone        *string `json:"tz"`
}

func (h *Handler) UpdateMe(c *gin.Context) {
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
			return
		}
		req.Name = &trimmed
	}
	u, err := h.svc.UpdateProfile(c.Request.Context(), UserID(c), ProfileUpdate(req))
	switch {
	case errors.Is(err, ErrInvalidProfile):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	case errors.Is(err, ErrUserNotFound):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	case err != nil:
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": u.Public()})
}

func (h *Handler) setAuthCookies(c *gin.Context, t Tokens) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookie, t.Access, int(h.cfg.AccessTTL/time.Second), "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
	// Refresh cookie is only sent to /auth/* so it isn't attached to every API call.
	c.SetCookie(refreshCookie, t.Refresh, int(h.cfg.RefreshTTL/time.Second), "/auth", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
}

func (h *Handler) clearAuthCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookie, "", -1, "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
	c.SetCookie(refreshCookie, "", -1, "/auth", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
}

func serverError(c *gin.Context, err error) {
	_ = c.Error(err) // surfaces in gin's logger
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}
