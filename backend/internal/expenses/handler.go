package expenses

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
)

const maxBody = 64 << 10 // 64 KiB is far more than any expense needs

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

func idParam(c *gin.Context) (bson.ObjectID, bool) {
	id, err := bson.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return id, false
	}
	return id, true
}

// friendQuery parses the optional ?friend=<userId> filter.
func friendQuery(c *gin.Context) (*bson.ObjectID, bool) {
	raw := c.Query("friend")
	if raw == "" {
		return nil, true
	}
	id, err := bson.ObjectIDFromHex(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid friend id"})
		return nil, false
	}
	return &id, true
}

func fail(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrInvalid), errors.Is(err, ErrNoOtherPeople):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, ErrNotFriends):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		_ = c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "something went wrong"})
	}
}

func bind(c *gin.Context, v any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody)
	if err := c.ShouldBindJSON(v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return false
	}
	return true
}

// POST /expenses  (optional Idempotency-Key header)
func (h *Handler) Create(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	var in ExpenseInput
	if !bind(c, &in) {
		return
	}
	d, err := h.svc.Create(c.Request.Context(), uid, c.GetHeader("Idempotency-Key"), in)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, d)
}

// GET /expenses?friend=&cursor=&limit=
func (h *Handler) List(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	friend, ok := friendQuery(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	page, err := h.svc.List(c.Request.Context(), uid, friend, c.Query("cursor"), limit)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}

// GET /expenses/:id
func (h *Handler) Get(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	d, err := h.svc.Get(c.Request.Context(), uid, id)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

// PATCH /expenses/:id  (send the full expense; it replaces the old one)
func (h *Handler) Update(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in ExpenseInput
	if !bind(c, &in) {
		return
	}
	d, err := h.svc.Update(c.Request.Context(), uid, id, in)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

// DELETE /expenses/:id
func (h *Handler) Delete(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	id, ok := idParam(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), uid, id); err != nil {
		fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// GET /balances
func (h *Handler) Balances(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	sum, err := h.svc.Summary(c.Request.Context(), uid)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, sum)
}

// POST /settlements  (optional Idempotency-Key header)
func (h *Handler) CreateSettlement(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	var in SettlementInput
	if !bind(c, &in) {
		return
	}
	v, err := h.svc.CreateSettlement(c.Request.Context(), uid, c.GetHeader("Idempotency-Key"), in)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, v)
}

// GET /settlements?friend=
func (h *Handler) ListSettlements(c *gin.Context) {
	uid, ok := me(c)
	if !ok {
		return
	}
	friend, ok := friendQuery(c)
	if !ok {
		return
	}
	page, err := h.svc.ListSettlements(c.Request.Context(), uid, friend)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, page)
}
