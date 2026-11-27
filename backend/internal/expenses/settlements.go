package expenses

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/internal/notify"
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
	// When the payment happened; defaults to now.
	Date *time.Time `json:"date,omitempty"`
	// For a payment I made: leave the balance alone until the other person
	// confirms they got it.
	NeedsConfirmation bool `json:"needsConfirmation,omitempty"`
}

type SettlementView struct {
	ID        string    `json:"id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Amount    int64     `json:"amount"`
	Currency  string    `json:"currency"`
	Note      string    `json:"note,omitempty"`
	Date      time.Time `json:"date"`
	CreatedAt time.Time `json:"createdAt"`
	// Status is confirmed, pending, declined or cancelled. Only confirmed
	// payments are counted in balances.
	Status string `json:"status"`
	// CreatedBy is who recorded it. For a pending payment this is the payer.
	CreatedBy string `json:"createdBy"`
}

// notApplied matches every settlement that counts in balances: confirmed ones
// and older rows that have no status at all.
var notApplied = bson.M{"$nin": bson.A{models.SettlementPending, models.SettlementDeclined, models.SettlementCancelled}}

// statusOf treats a missing status as confirmed.
func statusOf(m models.Settlement) string {
	if m.Status == "" {
		return models.SettlementConfirmed
	}
	return m.Status
}

type SettlementPage struct {
	Settlements []SettlementView      `json:"settlements"`
	People      map[string]PublicUser `json:"people"`
}

// dateOrCreated covers settlements saved before the date field existed.
func dateOrCreated(m models.Settlement) time.Time {
	if m.Date.IsZero() {
		return m.CreatedAt
	}
	return m.Date
}

func settlementView(m models.Settlement) SettlementView {
	return SettlementView{
		ID: m.ID.Hex(), From: m.From.Hex(), To: m.To.Hex(), Amount: m.Amount,
		Currency: m.Currency, Note: m.Note, Date: dateOrCreated(m), CreatedAt: m.CreatedAt,
		Status: statusOf(m), CreatedBy: m.CreatedBy.Hex(),
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
	now := time.Now().UTC()
	m := models.Settlement{
		ID: bson.NewObjectID(), Amount: in.Amount, Currency: cur, Note: note,
		CreatedBy: me, IdempotencyKey: key, CreatedAt: now, Date: now,
	}
	if in.Date != nil {
		if in.Date.After(now.Add(36 * time.Hour)) {
			return SettlementView{}, invalid("date can't be in the future")
		}
		m.Date = in.Date.UTC()
	}
	switch in.Direction {
	case DirectionPaid:
		m.From, m.To = me, other
	case DirectionReceived:
		m.From, m.To = other, me
	default:
		return SettlementView{}, invalid("direction must be paid or received")
	}
	if in.NeedsConfirmation {
		if in.Direction != DirectionPaid {
			return SettlementView{}, invalid("only a payment you made can wait for confirmation")
		}
		m.Status = models.SettlementPending
	}
	if err := s.requireFriends(ctx, me, []bson.ObjectID{other}); err != nil {
		return SettlementView{}, err
	}

	err = s.inTx(ctx, func(ctx context.Context) error {
		if _, err := s.settlements.InsertOne(ctx, m); err != nil {
			return err
		}
		if m.Status == models.SettlementPending {
			return nil // nothing moves until the receiver confirms
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
	s.notifyNewSettlement(ctx, me, m)
	return settlementView(m), nil
}

// notifyNewSettlement tells the other person about a payment I just recorded.
func (s *Service) notifyNewSettlement(ctx context.Context, me bson.ObjectID, m models.Settlement) {
	amount := notify.Money(m.Amount, m.Currency)
	ev := notify.Event{Actor: me, Link: "/dashboard/settle"}
	switch {
	case m.Status == models.SettlementPending:
		ev.To, ev.Type = m.To, notify.TypePaymentPending
		ev.Message = notify.ActorToken + " says they paid you " + amount + ". Confirm it once the money has arrived."
	case m.From == me:
		ev.To, ev.Type = m.To, notify.TypePaymentRecorded
		ev.Message = notify.ActorToken + " recorded a payment of " + amount + " to you."
	default:
		ev.To, ev.Type = m.From, notify.TypePaymentRecorded
		ev.Message = notify.ActorToken + " recorded that you paid them " + amount + "."
	}
	s.notify(ctx, ev)
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

// ConfirmSettlement is the receiver saying the money arrived. The payment is
// marked confirmed and the balance moves in the same transaction.
func (s *Service) ConfirmSettlement(ctx context.Context, me, id bson.ObjectID) (SettlementView, error) {
	return s.decide(ctx, me, id, bson.M{"to": me}, models.SettlementConfirmed)
}

// DeclineSettlement is the receiver saying the money never arrived. Balances
// are untouched.
func (s *Service) DeclineSettlement(ctx context.Context, me, id bson.ObjectID) (SettlementView, error) {
	return s.decide(ctx, me, id, bson.M{"to": me}, models.SettlementDeclined)
}

// CancelSettlement lets the payer withdraw a payment nobody has answered yet.
func (s *Service) CancelSettlement(ctx context.Context, me, id bson.ObjectID) (SettlementView, error) {
	return s.decide(ctx, me, id, bson.M{"createdBy": me}, models.SettlementCancelled)
}

// decide moves a pending settlement to its final status. who restricts which
// person may do it (the receiver, or the payer when cancelling). The status
// check and the update are one atomic operation, so two quick taps can't apply
// the same payment twice.
func (s *Service) decide(ctx context.Context, me, id bson.ObjectID, who bson.M, to string) (SettlementView, error) {
	filter := bson.M{"_id": id, "status": models.SettlementPending}
	for k, v := range who {
		filter[k] = v
	}

	var m models.Settlement
	err := s.inTx(ctx, func(ctx context.Context) error {
		now := time.Now().UTC()
		err := s.settlements.FindOneAndUpdate(ctx, filter,
			bson.M{"$set": bson.M{"status": to, "decidedAt": now}},
			options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&m)
		if err == mongo.ErrNoDocuments {
			return ErrNotPending
		}
		if err != nil {
			return err
		}
		if to != models.SettlementConfirmed {
			return nil
		}
		return s.applyDeltas(ctx, m.Currency, []ledger.Delta{ledger.SettlementDelta(m.From, m.To, m.Amount)})
	})
	if err != nil {
		return SettlementView{}, err
	}
	s.notifyDecision(ctx, me, m, to)
	return settlementView(m), nil
}

// notifyDecision tells the other person how a pending payment was answered.
func (s *Service) notifyDecision(ctx context.Context, me bson.ObjectID, m models.Settlement, status string) {
	amount := notify.Money(m.Amount, m.Currency)
	ev := notify.Event{Actor: me, Link: "/dashboard/settle"}
	switch status {
	case models.SettlementConfirmed:
		ev.To, ev.Type = m.From, notify.TypePaymentConfirmed
		ev.Message = notify.ActorToken + " confirmed your " + amount + " payment."
	case models.SettlementDeclined:
		ev.To, ev.Type = m.From, notify.TypePaymentDeclined
		ev.Message = notify.ActorToken + " says they didn't receive your " + amount + " payment."
	case models.SettlementCancelled:
		ev.To, ev.Type = m.To, notify.TypePaymentCancelled
		ev.Message = notify.ActorToken + " cancelled their " + amount + " payment."
	default:
		return
	}
	s.notify(ctx, ev)
}
