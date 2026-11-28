package profiles

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func me(c *gin.Context) (bson.ObjectID, bool) {
	id, err := bson.ObjectIDFromHex(auth.UserID(c))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return id, false
	}
	return id, true
}

func fail(c *gin.Context, err error) {
	if errors.Is(err, ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	_ = c.Error(err)
	slog.Error("profiles request failed", "method", c.Request.Method, "path", c.FullPath(), "err", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
}

// GET /profiles/:id  (":id" can be "me")
func (h *Handler) Get(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	target := uid
	if raw := c.Param("id"); raw != "me" {
		id, err := bson.ObjectIDFromHex(raw)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		target = id
	}
	p, err := h.svc.Get(c.Request.Context(), uid, target)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"profile": p})
}

// GET /friends/suggestions?limit=
func (h *Handler) Suggestions(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	items, err := h.svc.Suggestions(c.Request.Context(), uid, limit)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestions": items})
}
