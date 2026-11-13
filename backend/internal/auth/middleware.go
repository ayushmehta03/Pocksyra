package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireAuth validates the access-token cookie and stores the user id in the
// gin context. The Go API is the real authority; Next.js only gates routes.
func (h *Handler) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		tok, err := c.Cookie(accessCookie)
		if err != nil || tok == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		uid, err := h.svc.ParseAccessToken(tok)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set(ctxUserID, uid)
		c.Next()
	}
}

// UserID returns the authenticated user's id (use after RequireAuth).
func UserID(c *gin.Context) string { return c.GetString(ctxUserID) }

// RequireCustomHeader is the CSRF second layer on top of SameSite=Lax:
// mutating requests must carry X-Requested-With, which cross-site forms can't set.
func RequireCustomHeader() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if c.GetHeader("X-Requested-With") == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing X-Requested-With header"})
			return
		}
		c.Next()
	}
}
