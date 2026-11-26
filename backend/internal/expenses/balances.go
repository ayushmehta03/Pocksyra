package expenses

import (
	"context"
	"sort"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// FriendBalance is what one friend and I owe each other in one currency.
// Amount > 0 means they owe me; Amount < 0 means I owe them.
type FriendBalance struct {
	Friend   PublicUser `json:"friend"`
	Currency string     `json:"currency"`
	Amount   int64      `json:"amount"`

	// FriendUPIID is the friend's UPI ID. It is only filled in when I owe them
	// (Amount < 0), because that is the only time I need it to pay them.
	FriendUPIID string `json:"friendUpiId,omitempty"`
}

// Totals rolls my balances up per currency (currencies are never mixed).
type Totals struct {
	Currency string `json:"currency"`
	Owed     int64  `json:"owed"` // others owe me
	Owe      int64  `json:"owe"`  // I owe others
	Net      int64  `json:"net"`
}

type Summary struct {
	Balances []FriendBalance `json:"balances"`
	Totals   []Totals        `json:"totals"`
}

// Summary reads my materialized balances. Pairs that are settled (net 0) are omitted.
func (s *Service) Summary(ctx context.Context, me bson.ObjectID) (Summary, error) {
	cur, err := s.balances.Find(ctx, bson.M{
		"$or": bson.A{bson.M{"userLow": me}, bson.M{"userHigh": me}},
		"net": bson.M{"$ne": 0},
	})
	if err != nil {
		return Summary{}, err
	}
	var rows []models.Balance
	if err := cur.All(ctx, &rows); err != nil {
		return Summary{}, err
	}

	ids := make([]bson.ObjectID, 0, len(rows))
	for _, r := range rows {
		other := r.UserLow
		if other == me {
			other = r.UserHigh
		}
		ids = append(ids, other)
	}
	people, err := s.people(ctx, ids)
	if err != nil {
		return Summary{}, err
	}

	amts := make([]int64, len(rows))
	var owedTo []bson.ObjectID // friends I owe money to
	for i, r := range rows {
		amts[i] = ledger.Between(me, ids[i], r.Net)
		if amts[i] < 0 {
			owedTo = append(owedTo, ids[i])
		}
	}
	upi, err := s.upiIDs(ctx, owedTo)
	if err != nil {
		return Summary{}, err
	}

	out := Summary{Balances: []FriendBalance{}, Totals: []Totals{}}
	byCur := map[string]*Totals{}
	for i, r := range rows {
		amt := amts[i]
		out.Balances = append(out.Balances, FriendBalance{
			Friend:      people[ids[i].Hex()],
			Currency:    r.Currency,
			Amount:      amt,
			FriendUPIID: upi[ids[i].Hex()],
		})
		t := byCur[r.Currency]
		if t == nil {
			t = &Totals{Currency: r.Currency}
			byCur[r.Currency] = t
		}
		if amt > 0 {
			t.Owed += amt
		} else {
			t.Owe += -amt
		}
		t.Net += amt
	}
	for _, t := range byCur {
		out.Totals = append(out.Totals, *t)
	}
	sort.Slice(out.Totals, func(i, j int) bool { return out.Totals[i].Currency < out.Totals[j].Currency })
	// Biggest absolute amounts first.
	sort.Slice(out.Balances, func(i, j int) bool { return abs(out.Balances[i].Amount) > abs(out.Balances[j].Amount) })
	return out, nil
}

// upiIDs returns the saved UPI IDs of the given users, keyed by hex id.
// Users without one are left out.
func (s *Service) upiIDs(ctx context.Context, ids []bson.ObjectID) (map[string]string, error) {
	out := make(map[string]string, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	cur, err := s.users.Find(ctx, bson.M{"_id": bson.M{"$in": ids}, "upiId": bson.M{"$exists": true, "$ne": ""}})
	if err != nil {
		return nil, err
	}
	var us []models.User
	if err := cur.All(ctx, &us); err != nil {
		return nil, err
	}
	for _, u := range us {
		out[u.ID.Hex()] = u.UPIID
	}
	return out, nil
}

func abs(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}
