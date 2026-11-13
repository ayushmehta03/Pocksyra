package friends

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
	"github.com/ayushmehta03/Pocksyra/backend/internal/ratelimit"
)

type Handler struct {
	svc            *Service
	requestLimiter *ratelimit.Limiter // friend lookups, per user (stops email/username enumeration)
	inviteLimiter  *ratelimit.Limiter // invite creation, per user
}

func NewHandler(svc *Service) *Handler {
	return &Handler{
		svc:            svc,
		requestLimiter: ratelimit.New(30, time.Hour),
		inviteLimiter:  ratelimit.New(10, time.Hour),
	}
}

// me parses the authenticated user's id (set by auth.RequireAuth).
func me(c *gin.Context) (bson.ObjectID, bool) {
	id, err := bson.ObjectIDFromHex(auth.UserID(c))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return id, false
	}
	return id, true
}

func idParam(c *gin.Context) (bson.ObjectID, bool) {
	id, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return id, false
	}
	return id, true
}

func fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrInviteInvalid):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrSelf):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, ErrAlreadyFriends), errors.Is(err, ErrRequestPending), errors.Is(err, ErrUnsettled):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, ErrTooManyInvites):
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
	default:
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}

// GET /friends
func (h *Handler) List(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	out, err := h.svc.List(c.Request.Context(), uid)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

type requestBody struct {
	Email    string `json:"email" binding:"omitempty,email,max=254"`
	Username string `json:"username" binding:"omitempty,max=40"`
}

// POST /friends/requests  {"email": "..."} or {"username": "..."}
func (h *Handler) SendRequest(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	var req requestBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Username = strings.TrimPrefix(strings.TrimSpace(req.Username), "@")
	if (req.Email == "") == (req.Username == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide exactly one of email or username"})
		return
	}
	if allowed, _ := h.requestLimiter.Allow(uid.Hex()); !allowed {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, try again later"})
		return
	}

	e, auto, err := h.svc.SendRequest(c.Request.Context(), uid, req.Email, req.Username)
	if err != nil {
		fail(c, err)
		return
	}
	status := http.StatusCreated
	if auto {
		status = http.StatusOK
	}
	c.JSON(status, gin.H{"friendship": e, "autoAccepted": auto})
}

// POST /friends/requests/:id/accept
func (h *Handler) Accept(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	e, err := h.svc.Accept(c.Request.Context(), uid, id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"friendship": e})
}

// POST /friends/requests/:id/decline
func (h *Handler) Decline(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	if err := h.svc.Decline(c.Request.Context(), uid, id); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// DELETE /friends/:id  (unfriend, or cancel a request I sent)
func (h *Handler) Remove(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	if err := h.svc.Remove(c.Request.Context(), uid, id, c.Query("force") == "true"); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// POST /invites
func (h *Handler) CreateInvite(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	if allowed, _ := h.inviteLimiter.Allow(uid.Hex()); !allowed {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many invites created, try again later"})
		return
	}
	link, err := h.svc.CreateInvite(c.Request.Context(), uid)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, link)
}

// GET /invites/:token  (who is this invite from?)
func (h *Handler) PreviewInvite(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	p, err := h.svc.PreviewInvite(c.Request.Context(), uid, c.Param("token"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

// POST /invites/:token/accept
func (h *Handler) AcceptInvite(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	e, err := h.svc.AcceptInvite(c.Request.Context(), uid, c.Param("token"))
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"friendship": e})
}
