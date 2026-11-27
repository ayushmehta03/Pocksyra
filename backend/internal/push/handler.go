package push

import (
	"errors"
	"log/slog"
	"net/http"

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
	if errors.Is(err, ErrInvalid) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "that browser's push subscription isn't valid or isn't supported"})
		return
	}
	_ = c.Error(err)
	slog.Error("push request failed", "method", c.Request.Method, "path", c.FullPath(), "err", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
}

// GET /push/key  (tells the app whether push is on, and the key to subscribe with)
func (h *Handler) Key(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"enabled": h.svc.Enabled(), "publicKey": h.svc.PublicKey()})
}

type subscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys"`
}

// POST /push/subscribe
func (h *Handler) Subscribe(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	if !h.svc.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "push notifications aren't set up on this server"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	err := h.svc.Subscribe(c.Request.Context(), uid, Subscription{Endpoint: req.Endpoint, P256dh: req.Keys.P256dh, Auth: req.Keys.Auth})
	if err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type unsubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
}

// POST /push/unsubscribe
func (h *Handler) Unsubscribe(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var req unsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.svc.Unsubscribe(c.Request.Context(), uid, req.Endpoint); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
