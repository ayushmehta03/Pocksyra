package expenses

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/internal/split"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// ---------- API shapes ----------

type SplitInput struct {
	UserID string `json:"userId"`
	// Value depends on the method: ignored for equal, minor units for exact,
	// basis points (10000 = 100%) for percent, relative weight for shares.
	Value int64 `json:"value"`
}

type ExpenseInput struct {
	Description string       `json:"description"`
	Amount      int64        `json:"amount"` // minor units
	Currency    string       `json:"currency"`
	PaidBy      string       `json:"paidBy"`
	Method      string       `json:"method"`
	Splits      []SplitInput `json:"splits"`
	Date        *time.Time   `json:"date,omitempty"`
}

type SplitView struct {
	UserID string `json:"userId"`
	Amount int64  `json:"amount"`
	Value  int64  `json:"value"`
}

type ExpenseView struct {
	ID          string      `json:"id"`
	Description string      `json:"description"`
	Amount      int64       `json:"amount"`
	Currency    string      `json:"currency"`
	Method      string      `json:"method"`
	PaidBy      string      `json:"paidBy"`
	CreatedBy   string      `json:"createdBy"`
	Splits      []SplitView `json:"splits"`
	Date        time.Time   `json:"date"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

type ExpenseDetail struct {
	Expense ExpenseView           `json:"expense"`
	People  map[string]PublicUser `json:"people"`
}

type ExpensePage struct {
	Expenses   []ExpenseView         `json:"expenses"`
	People     map[string]PublicUser `json:"people"`
	NextCursor string                `json:"nextCursor,omitempty"`
}

func view(e models.Expense) ExpenseView {
	sv := make([]SplitView, len(e.Splits))
	for i, s := range e.Splits {
		sv[i] = SplitView{UserID: s.UserID.Hex(), Amount: s.Amount, Value: s.Value}
	}
	return ExpenseView{
		ID: e.ID.Hex(), Description: e.Description, Amount: e.Amount, Currency: e.Currency,
		Method: e.Method, PaidBy: e.PaidBy.Hex(), CreatedBy: e.CreatedBy.Hex(), Splits: sv,
		Date: e.Date, CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
	}
}

func participantIDs(es ...models.Expense) []bson.ObjectID {
	seen := map[bson.ObjectID]struct{}{}
	var out []bson.ObjectID
	add := func(id bson.ObjectID) {
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			out = append(out, id)
		}
	}
	for _, e := range es {
		add(e.PaidBy)
		for _, s := range e.Splits {
			add(s.UserID)
		}
	}
	return out
}

// ---------- validation ----------

type prepared struct {
	paidBy      bson.ObjectID
	description string
	amount      int64
	currency    string
	method      string
	splits      []models.ExpenseSplit
	date        time.Time
}

// prepare validates the input and computes exact per-person amounts.
func (s *Service) prepare(ctx context.Context, me bson.ObjectID, in ExpenseInput) (prepared, error) {
	var p prepared
	p.description = strings.TrimSpace(in.Description)
	if n := len([]rune(p.description)); n == 0 || n > 120 {
		return p, invalid("description must be 1-120 characters")
	}
	if in.Amount <= 0 || in.Amount > maxAmount {
		return p, invalid("amount must be greater than zero")
	}
	p.amount = in.Amount
	p.currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if !validCurrency(p.currency) {
		return p, invalid("currency must be a 3-letter code")
	}
	p.method = in.Method
	if len(in.Splits) == 0 || len(in.Splits) > maxParticipants {
		return p, invalid("between 1 and %d people can share an expense", maxParticipants)
	}

	var err error
	if p.paidBy, err = parseID(in.PaidBy); err != nil {
		return p, err
	}
	inputs := make([]split.Input, len(in.Splits))
	for i, sp := range in.Splits {
		id, err := parseID(sp.UserID)
		if err != nil {
			return p, err
		}
		inputs[i] = split.Input{UserID: id.Hex(), Value: sp.Value}
	}
	shares, err := split.Compute(in.Amount, in.Method, inputs)
	if err != nil {
		return p, invalid("%v", err)
	}
	p.splits = make([]models.ExpenseSplit, len(shares))
	for i, sh := range shares {
		id, _ := bson.ObjectIDFromHex(sh.UserID)
		p.splits[i] = models.ExpenseSplit{UserID: id, Amount: sh.Amount, Value: in.Splits[i].Value}
	}

	// Participants = payer + everyone in the split. I must be one of them,
	// and everyone else must be my friend.
	set := map[bson.ObjectID]struct{}{p.paidBy: {}}
	for _, sp := range p.splits {
		set[sp.UserID] = struct{}{}
	}
	if _, ok := set[me]; !ok {
		return p, invalid("you must be the payer or part of the split")
	}
	others := make([]bson.ObjectID, 0, len(set))
	for id := range set {
		if id != me {
			others = append(others, id)
		}
	}
	if err := s.requireFriends(ctx, me, others); err != nil {
		return p, err
	}

	if in.Date != nil {
		p.date = in.Date.UTC()
	} else {
		p.date = time.Now().UTC()
	}
	return p, nil
}

// ---------- create ----------

// Create stores an expense and updates balances atomically. A repeated call
// with the same idempotency key returns the original expense unchanged, so a
// retry after a flaky network can't double-book it.
func (s *Service) Create(ctx context.Context, me bson.ObjectID, key string, in ExpenseInput) (ExpenseDetail, error) {
	key = strings.TrimSpace(key)
	if len(key) > 100 {
		return ExpenseDetail{}, invalid("idempotency key is too long")
	}
	if key != "" {
		if existing, err := s.findByKey(ctx, me, key); err != nil {
			return ExpenseDetail{}, err
		} else if existing != nil {
			return s.detail(ctx, *existing)
		}
	}

	p, err := s.prepare(ctx, me, in)
	if err != nil {
		return ExpenseDetail{}, err
	}
	now := time.Now().UTC()
	e := models.Expense{
		ID: bson.NewObjectID(), CreatedBy: me, PaidBy: p.paidBy, Description: p.description,
		Amount: p.amount, Currency: p.currency, Method: p.method, Splits: p.splits,
		Date: p.date, IdempotencyKey: key, CreatedAt: now, UpdatedAt: now,
	}
	err = s.inTx(ctx, func(ctx context.Context) error {
		if _, err := s.expenses.InsertOne(ctx, e); err != nil {
			return err
		}
		return s.applyDeltas(ctx, e.Currency, ledger.ExpenseDeltas(e.PaidBy, e.Splits))
	})
	if err != nil {
		// Two identical requests raced: the loser sees the unique index fire.
		if mongo.IsDuplicateKeyError(err) && key != "" {
			if existing, ferr := s.findByKey(ctx, me, key); ferr == nil && existing != nil {
				return s.detail(ctx, *existing)
			}
		}
		return ExpenseDetail{}, err
	}
	return s.detail(ctx, e)
}

func (s *Service) findByKey(ctx context.Context, me bson.ObjectID, key string) (*models.Expense, error) {
	var e models.Expense
	err := s.expenses.FindOne(ctx, bson.M{"createdBy": me, "idempotencyKey": key}).Decode(&e)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *Service) detail(ctx context.Context, e models.Expense) (ExpenseDetail, error) {
	people, err := s.people(ctx, participantIDs(e))
	if err != nil {
		return ExpenseDetail{}, err
	}
	return ExpenseDetail{Expense: view(e), People: people}, nil
}

// involves matches expenses that a user took part in (as payer or in the split).
func involves(user bson.ObjectID) bson.M {
	return bson.M{"$or": bson.A{bson.M{"paidBy": user}, bson.M{"splits.userId": user}}}
}

// ---------- read ----------

func (s *Service) Get(ctx context.Context, me, id bson.ObjectID) (ExpenseDetail, error) {
	var e models.Expense
	err := s.expenses.FindOne(ctx, bson.M{"$and": bson.A{
		bson.M{"_id": id, "deletedAt": nil}, involves(me),
	}}).Decode(&e)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ExpenseDetail{}, ErrNotFound
	}
	if err != nil {
		return ExpenseDetail{}, err
	}
	return s.detail(ctx, e)
}

// cursor format: "<unix millis of date>.<hex id>", the sort key of the last row.
func encodeCursor(e models.Expense) string {
	return strconv.FormatInt(e.Date.UnixMilli(), 10) + "." + e.ID.Hex()
}

func decodeCursor(c string) (time.Time, bson.ObjectID, bool) {
	ms, hexID, ok := strings.Cut(c, ".")
	if !ok {
		return time.Time{}, bson.ObjectID{}, false
	}
	n, err := strconv.ParseInt(ms, 10, 64)
	if err != nil {
		return time.Time{}, bson.ObjectID{}, false
	}
	id, err := bson.ObjectIDFromHex(hexID)
	if err != nil {
		return time.Time{}, bson.ObjectID{}, false
	}
	return time.UnixMilli(n).UTC(), id, true
}

// List returns my expenses newest first. friend (optional) narrows to
// expenses shared with that one person. cursor pages through results.
func (s *Service) List(ctx context.Context, me bson.ObjectID, friend *bson.ObjectID, cursor string, limit int) (ExpensePage, error) {
	if limit <= 0 || limit > maxListed {
		limit = 30
	}
	conds := bson.A{bson.M{"deletedAt": nil}, involves(me)}
	if friend != nil {
		conds = append(conds, involves(*friend))
	}
	if cursor != "" {
		d, id, ok := decodeCursor(cursor)
		if !ok {
			return ExpensePage{}, invalid("bad cursor")
		}
		conds = append(conds, bson.M{"$or": bson.A{
			bson.M{"date": bson.M{"$lt": d}},
			bson.M{"date": d, "_id": bson.M{"$lt": id}},
		}})
	}
	cur, err := s.expenses.Find(ctx, bson.M{"$and": conds},
		options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(int64(limit+1)))
	if err != nil {
		return ExpensePage{}, err
	}
	var es []models.Expense
	if err := cur.All(ctx, &es); err != nil {
		return ExpensePage{}, err
	}
	page := ExpensePage{Expenses: []ExpenseView{}}
	if len(es) > limit {
		es = es[:limit]
		page.NextCursor = encodeCursor(es[len(es)-1])
	}
	for _, e := range es {
		page.Expenses = append(page.Expenses, view(e))
	}
	if page.People, err = s.people(ctx, participantIDs(es...)); err != nil {
		return ExpensePage{}, err
	}
	return page, nil
}

// ---------- update / delete ----------

// Update replaces an expense I created. The old effect on the balances is
// reversed and the new one applied, all in one transaction.
func (s *Service) Update(ctx context.Context, me, id bson.ObjectID, in ExpenseInput) (ExpenseDetail, error) {
	p, err := s.prepare(ctx, me, in)
	if err != nil {
		return ExpenseDetail{}, err
	}
	var updated models.Expense
	err = s.inTx(ctx, func(ctx context.Context) error {
		var old models.Expense
		err := s.expenses.FindOne(ctx, bson.M{"_id": id, "createdBy": me, "deletedAt": nil}).Decode(&old)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		updated = old
		updated.PaidBy, updated.Description, updated.Amount = p.paidBy, p.description, p.amount
		updated.Currency, updated.Method, updated.Splits, updated.Date = p.currency, p.method, p.splits, p.date
		updated.UpdatedAt = time.Now().UTC()
		if _, err := s.expenses.ReplaceOne(ctx, bson.M{"_id": id}, updated); err != nil {
			return err
		}

		undo := ledger.Negate(ledger.ExpenseDeltas(old.PaidBy, old.Splits))
		redo := ledger.ExpenseDeltas(updated.PaidBy, updated.Splits)
		if old.Currency == updated.Currency {
			return s.applyDeltas(ctx, updated.Currency, ledger.Merge(undo, redo))
		}
		if err := s.applyDeltas(ctx, old.Currency, undo); err != nil {
			return err
		}
		return s.applyDeltas(ctx, updated.Currency, redo)
	})
	if err != nil {
		return ExpenseDetail{}, err
	}
	return s.detail(ctx, updated)
}

// Delete soft-deletes an expense I created and reverses its balance effect.
func (s *Service) Delete(ctx context.Context, me, id bson.ObjectID) error {
	return s.inTx(ctx, func(ctx context.Context) error {
		var old models.Expense
		now := time.Now().UTC()
		err := s.expenses.FindOneAndUpdate(ctx,
			bson.M{"_id": id, "createdBy": me, "deletedAt": nil},
			bson.M{"$set": bson.M{"deletedAt": now, "updatedAt": now}},
			options.FindOneAndUpdate().SetReturnDocument(options.Before),
		).Decode(&old)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		return s.applyDeltas(ctx, old.Currency, ledger.Negate(ledger.ExpenseDeltas(old.PaidBy, old.Splits)))
	})
}
