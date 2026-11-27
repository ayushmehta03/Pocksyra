package notify

import (
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
	_ = c.Error(err)
	slog.Error("notifications request failed", "method", c.Request.Method, "path", c.FullPath(), "err", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
}

// GET /notifications?limit=
func (h *Handler) List(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	items, unread, err := h.svc.List(c.Request.Context(), uid, limit)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"notifications": items, "unread": unread})
}

// GET /notifications/unread  (cheap; the app polls this for the bell badge)
func (h *Handler) Unread(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	n, err := h.svc.Unread(c.Request.Context(), uid)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"unread": n})
}

// POST /notifications/:id/read
func (h *Handler) MarkRead(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": errBadID.Error()})
		return
	}
	if err := h.svc.MarkRead(c.Request.Context(), uid, id); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// PATCH /notifications  (marks everything read)
func (h *Handler) MarkAllRead(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	if err := h.svc.MarkAllRead(c.Request.Context(), uid); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
