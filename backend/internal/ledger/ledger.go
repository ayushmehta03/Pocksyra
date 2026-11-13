// Package ledger holds the pure bookkeeping rules for the pairwise balances.
// It has no database code, so the rules can be tested exhaustively.
//
// Sign convention (matches models.Balance): for a canonical pair (Low, High),
// a positive amount means High owes Low more; negative means Low owes High.
package ledger

import (
	"bytes"
	"sort"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// Delta is a change to one pair's net balance.
type Delta struct {
	Low, High bson.ObjectID
	Amount    int64
}

// Canonical orders two ids so (a,b) and (b,a) map to the same pair.
func Canonical(a, b bson.ObjectID) (low, high bson.ObjectID) {
	if bytes.Compare(a[:], b[:]) <= 0 {
		return a, b
	}
	return b, a
}

// debt records that debtor owes creditor amount.
func debt(debtor, creditor bson.ObjectID, amount int64) Delta {
	low, high := Canonical(debtor, creditor)
	if creditor == low {
		return Delta{Low: low, High: high, Amount: amount} // high (debtor) owes low
	}
	return Delta{Low: low, High: high, Amount: -amount} // low (debtor) owes high
}

// ExpenseDeltas is the balance effect of an expense: every participant other
// than the payer owes the payer their share.
func ExpenseDeltas(paidBy bson.ObjectID, splits []models.ExpenseSplit) []Delta {
	out := make([]Delta, 0, len(splits))
	for _, s := range splits {
		if s.UserID == paidBy || s.Amount == 0 {
			continue
		}
		out = append(out, debt(s.UserID, paidBy, s.Amount))
	}
	return out
}

// SettlementDelta is the effect of `from` paying `to` amount: it cancels debt
// that `from` owed, which is the same as `to` now owing `from` that much less
// negative, i.e. to's debt to from grows by amount.
func SettlementDelta(from, to bson.ObjectID, amount int64) Delta {
	return debt(to, from, amount)
}

// Negate returns the deltas that exactly undo ds.
func Negate(ds []Delta) []Delta {
	out := make([]Delta, len(ds))
	for i, d := range ds {
		out[i] = Delta{Low: d.Low, High: d.High, Amount: -d.Amount}
	}
	return out
}

// Merge adds deltas for the same pair together and drops pairs that cancel to
// zero. Output order is deterministic.
func Merge(groups ...[]Delta) []Delta {
	type key struct{ low, high bson.ObjectID }
	sums := map[key]int64{}
	for _, g := range groups {
		for _, d := range g {
			sums[key{d.Low, d.High}] += d.Amount
		}
	}
	out := make([]Delta, 0, len(sums))
	for k, v := range sums {
		if v != 0 {
			out = append(out, Delta{Low: k.low, High: k.high, Amount: v})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if c := bytes.Compare(out[i].Low[:], out[j].Low[:]); c != 0 {
			return c < 0
		}
		return bytes.Compare(out[i].High[:], out[j].High[:]) < 0
	})
	return out
}

// Between reports what `me` and `other` owe each other given a stored net for
// their pair: positive means other owes me, negative means I owe other.
func Between(me, other bson.ObjectID, net int64) int64 {
	low, _ := Canonical(me, other)
	if me == low {
		return net
	}
	return -net
}
