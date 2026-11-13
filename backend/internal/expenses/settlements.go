package expenses

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

const (
	DirectionPaid     = "paid"     // I paid them back
	DirectionReceived = "received" // they paid me back
)

type SettlementInput struct {
	WithUserID string `json:"withUserId"`
	Direction  string `json:"direction"`
	Amount     int64  `json:"amount"` // minor units
	Currency   string `json:"currency"`
	Note       string `json:"note"`
}

type SettlementView struct {
	ID        string    `json:"id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Amount    int64     `json:"amount"`
	Currency  string    `json:"currency"`
	Note      string    `json:"note,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type SettlementPage struct {
	Settlements []SettlementView      `json:"settlements"`
	People      map[string]PublicUser `json:"people"`
}

func settlementView(m models.Settlement) SettlementView {
	return SettlementView{
		ID: m.ID.Hex(), From: m.From.Hex(), To: m.To.Hex(), Amount: m.Amount,
		Currency: m.Currency, Note: m.Note, CreatedAt: m.CreatedAt,
	}
}

// CreateSettlement records a real-world payment between me and a friend and
// moves their balance by that amount. Idempotent per key, like expenses.
func (s *Service) CreateSettlement(ctx context.Context, me bson.ObjectID, key string, in SettlementInput) (SettlementView, error) {
	key = strings.TrimSpace(key)
	if len(key) > 100 {
		return SettlementView{}, invalid("idempotency key is too long")
	}
	if key != "" {
		var existing models.Settlement
		err := s.settlements.FindOne(ctx, bson.M{"createdBy": me, "idempotencyKey": key}).Decode(&existing)
		if err == nil {
			return settlementView(existing), nil
		}
		if err != mongo.ErrNoDocuments {
			return SettlementView{}, err
		}
	}

	other, err := parseID(in.WithUserID)
	if err != nil {
		return SettlementView{}, err
	}
	if other == me {
		return SettlementView{}, invalid("you can't settle up with yourself")
	}
	if in.Amount <= 0 || in.Amount > maxAmount {
		return SettlementView{}, invalid("amount must be greater than zero")
	}
	cur := strings.ToUpper(strings.TrimSpace(in.Currency))
	if !validCurrency(cur) {
		return SettlementView{}, invalid("currency must be a 3-letter code")
	}
	note := strings.TrimSpace(in.Note)
	if len([]rune(note)) > 200 {
		return SettlementView{}, invalid("note is too long")
	}
	m := models.Settlement{
		ID: bson.NewObjectID(), Amount: in.Amount, Currency: cur, Note: note,
		CreatedBy: me, IdempotencyKey: key, CreatedAt: time.Now().UTC(),
	}
	switch in.Direction {
	case DirectionPaid:
		m.From, m.To = me, other
	case DirectionReceived:
		m.From, m.To = other, me
	default:
		return SettlementView{}, invalid("direction must be paid or received")
	}
	if err := s.requireFriends(ctx, me, []bson.ObjectID{other}); err != nil {
		return SettlementView{}, err
	}

	err = s.inTx(ctx, func(ctx context.Context) error {
		if _, err := s.settlements.InsertOne(ctx, m); err != nil {
			return err
		}
		return s.applyDeltas(ctx, m.Currency, []ledger.Delta{ledger.SettlementDelta(m.From, m.To, m.Amount)})
	})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) && key != "" {
			var existing models.Settlement
			if ferr := s.settlements.FindOne(ctx, bson.M{"createdBy": me, "idempotencyKey": key}).Decode(&existing); ferr == nil {
				return settlementView(existing), nil
			}
		}
		return SettlementView{}, err
	}
	return settlementView(m), nil
}

// ListSettlements returns payments I made or received, newest first,
// optionally only those with one friend.
func (s *Service) ListSettlements(ctx context.Context, me bson.ObjectID, friend *bson.ObjectID) (SettlementPage, error) {
	filter := bson.M{"$or": bson.A{bson.M{"from": me}, bson.M{"to": me}}}
	if friend != nil {
		filter = bson.M{"$or": bson.A{
			bson.M{"from": me, "to": *friend},
			bson.M{"from": *friend, "to": me},
		}}
	}
	cur, err := s.settlements.Find(ctx, filter,
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(maxListed))
	if err != nil {
		return SettlementPage{}, err
	}
	var ms []models.Settlement
	if err := cur.All(ctx, &ms); err != nil {
		return SettlementPage{}, err
	}
	page := SettlementPage{Settlements: make([]SettlementView, len(ms))}
	var ids []bson.ObjectID
	seen := map[bson.ObjectID]struct{}{}
	for i, m := range ms {
		page.Settlements[i] = settlementView(m)
		for _, id := range []bson.ObjectID{m.From, m.To} {
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				ids = append(ids, id)
			}
		}
	}
	if page.People, err = s.people(ctx, ids); err != nil {
		return SettlementPage{}, err
	}
	return page, nil
}
