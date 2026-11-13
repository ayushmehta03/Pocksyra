package ledger

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

func id(b byte) bson.ObjectID {
	var o bson.ObjectID
	o[11] = b
	return o
}

// net applies deltas to a single-pair ledger and returns what `me` is owed by `other`.
func owedToMe(me, other bson.ObjectID, ds []Delta) int64 {
	var net int64
	for _, d := range ds {
		l, h := Canonical(me, other)
		if d.Low == l && d.High == h {
			net += d.Amount
		}
	}
	return Between(me, other, net)
}

func TestExpenseDeltasBothDirections(t *testing.T) {
	a, b := id(1), id(2) // a sorts before b

	// a pays 1000, split 500/500 -> b owes a 500
	ds := ExpenseDeltas(a, []models.ExpenseSplit{{UserID: a, Amount: 500}, {UserID: b, Amount: 500}})
	if got := owedToMe(a, b, ds); got != 500 {
		t.Fatalf("a is owed %d by b, want 500", got)
	}
	if got := owedToMe(b, a, ds); got != -500 {
		t.Fatalf("b is owed %d by a, want -500", got)
	}

	// b pays 600, split 300/300 -> a owes b 300
	ds = ExpenseDeltas(b, []models.ExpenseSplit{{UserID: a, Amount: 300}, {UserID: b, Amount: 300}})
	if got := owedToMe(b, a, ds); got != 300 {
		t.Fatalf("b is owed %d by a, want 300", got)
	}
}

func TestPayerShareAndZeroSharesAreIgnored(t *testing.T) {
	a, b, c := id(1), id(2), id(3)
	ds := ExpenseDeltas(a, []models.ExpenseSplit{{UserID: a, Amount: 100}, {UserID: b, Amount: 0}, {UserID: c, Amount: 50}})
	if len(ds) != 1 {
		t.Fatalf("got %d deltas, want 1", len(ds))
	}
}

func TestSettlementCancelsDebt(t *testing.T) {
	a, b := id(1), id(2)
	// b owes a 500; b pays a 500 -> square.
	all := Merge(
		ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 500}}),
		[]Delta{SettlementDelta(b, a, 500)},
	)
	if len(all) != 0 {
		t.Fatalf("expected a clean slate, got %+v", all)
	}
	// b pays a 700 when only 500 was owed -> a now owes b 200.
	all = Merge(
		ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 500}}),
		[]Delta{SettlementDelta(b, a, 700)},
	)
	if got := owedToMe(a, b, all); got != -200 {
		t.Fatalf("a is owed %d, want -200", got)
	}
}

func TestEditReversesOldEffect(t *testing.T) {
	a, b := id(2), id(1) // reversed on purpose: b sorts first
	old := ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 400}})
	edited := ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 650}})
	diff := Merge(Negate(old), edited)
	if got := owedToMe(a, b, diff); got != 250 {
		t.Fatalf("net change %d, want +250", got)
	}
	// delete = just reverse
	if len(Merge(old, Negate(old))) != 0 {
		t.Fatal("reversal should cancel exactly")
	}
}

func TestMergeIsDeterministicAndAggregates(t *testing.T) {
	a, b, c := id(1), id(2), id(3)
	ds := Merge(
		ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 10}, {UserID: c, Amount: 20}}),
		ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 5}}),
	)
	if len(ds) != 2 || ds[0].Amount != 15 || ds[1].Amount != 20 {
		t.Fatalf("unexpected merge result %+v", ds)
	}
}

func TestTotalsAndDiffFindDrift(t *testing.T) {
	a, b, c := id(1), id(2), id(3)
	expected := Totals{}
	expected.Add("INR", ExpenseDeltas(a, []models.ExpenseSplit{{UserID: b, Amount: 500}, {UserID: c, Amount: 200}}))
	expected.Add("INR", []Delta{SettlementDelta(b, a, 500)}) // b paid a back in full

	// Stored is correct for (a,b) settled and (a,c) 200, so no drift.
	stored := Totals{}
	stored.Add("INR", []Delta{debt(c, a, 200)})
	if d := Diff(stored, expected); len(d) != 0 {
		t.Fatalf("unexpected drift: %+v", d)
	}

	// A stale non-zero row (a,b) and a wrong (a,c) are both reported, in stable order.
	stored.Add("INR", []Delta{debt(b, a, 500)})
	stored.Add("INR", []Delta{debt(c, a, 50)})
	d := Diff(stored, expected)
	if len(d) != 2 {
		t.Fatalf("got %d drifts, want 2: %+v", len(d), d)
	}
	if d[0].Stored != 500 || d[0].Expected != 0 || d[1].Stored != 250 || d[1].Expected != 200 {
		t.Fatalf("wrong drift values: %+v", d)
	}
	// A missing row that should be non-zero is drift too.
	if d := Diff(Totals{}, expected); len(d) != 1 || d[0].Expected != 200 {
		t.Fatalf("missing row not reported: %+v", d)
	}
}
