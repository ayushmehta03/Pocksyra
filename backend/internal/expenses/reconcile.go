package expenses

import (
	"context"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// DriftView is one balance row that disagreed with the books.
type DriftView struct {
	UserLow  string `json:"userLow"`
	UserHigh string `json:"userHigh"`
	Currency string `json:"currency"`
	Stored   int64  `json:"stored"`
	Expected int64  `json:"expected"`
}

type ReconcileReport struct {
	Rows  int         `json:"rows"` // balance rows compared
	Drift []DriftView `json:"drift"`
	Fixed int         `json:"fixed"`
}

// Reconcile rebuilds what every balance should be from the expenses and
// settlements (the source of truth) and compares it to the materialized
// balances. With fix set, drifted rows are rewritten. It exists as a safety
// net: the balances are updated transactionally, so drift should never happen,
// and if it does you want to know and heal it.
func (s *Service) Reconcile(ctx context.Context, fix bool) (ReconcileReport, error) {
	expected := ledger.Totals{}

	ec, err := s.expenses.Find(ctx, bson.M{"deletedAt": nil})
	if err != nil {
		return ReconcileReport{}, err
	}
	for ec.Next(ctx) {
		var e models.Expense
		if err := ec.Decode(&e); err != nil {
			_ = ec.Close(ctx)
			return ReconcileReport{}, err
		}
		expected.Add(e.Currency, ledger.ExpenseDeltas(e.PaidBy, e.Splits))
	}
	if err := ec.Err(); err != nil {
		return ReconcileReport{}, err
	}
	_ = ec.Close(ctx)

	sc, err := s.settlements.Find(ctx, bson.M{})
	if err != nil {
		return ReconcileReport{}, err
	}
	for sc.Next(ctx) {
		var m models.Settlement
		if err := sc.Decode(&m); err != nil {
			_ = sc.Close(ctx)
			return ReconcileReport{}, err
		}
		expected.Add(m.Currency, []ledger.Delta{ledger.SettlementDelta(m.From, m.To, m.Amount)})
	}
	if err := sc.Err(); err != nil {
		return ReconcileReport{}, err
	}
	_ = sc.Close(ctx)

	bc, err := s.balances.Find(ctx, bson.M{})
	if err != nil {
		return ReconcileReport{}, err
	}
	var rows []models.Balance
	if err := bc.All(ctx, &rows); err != nil {
		return ReconcileReport{}, err
	}
	stored := ledger.Totals{}
	for _, r := range rows {
		stored[ledger.Key{Low: r.UserLow, High: r.UserHigh, Currency: r.Currency}] = r.Net
	}

	report := ReconcileReport{Rows: len(rows), Drift: []DriftView{}}
	for _, d := range ledger.Diff(stored, expected) {
		report.Drift = append(report.Drift, DriftView{
			UserLow: d.Key.Low.Hex(), UserHigh: d.Key.High.Hex(), Currency: d.Key.Currency,
			Stored: d.Stored, Expected: d.Expected,
		})
		if fix {
			if err := s.repairPair(ctx, d.Key); err != nil {
				return report, err
			}
			report.Fixed++
		}
	}
	return report, nil
}

// repairPair recomputes one pair's balance from its own expenses and
// settlements inside a transaction. If a normal write touches the same row at
// the same time, the transaction retries, so it can't clobber live changes.
func (s *Service) repairPair(ctx context.Context, k ledger.Key) error {
	return s.inTx(ctx, func(ctx context.Context) error {
		totals := ledger.Totals{}

		ec, err := s.expenses.Find(ctx, bson.M{"$and": bson.A{
			bson.M{"deletedAt": nil, "currency": k.Currency},
			involves(k.Low), involves(k.High),
		}})
		if err != nil {
			return err
		}
		var es []models.Expense
		if err := ec.All(ctx, &es); err != nil {
			return err
		}
		for _, e := range es {
			totals.Add(e.Currency, ledger.ExpenseDeltas(e.PaidBy, e.Splits))
		}

		sc, err := s.settlements.Find(ctx, bson.M{"currency": k.Currency, "$or": bson.A{
			bson.M{"from": k.Low, "to": k.High},
			bson.M{"from": k.High, "to": k.Low},
		}})
		if err != nil {
			return err
		}
		var ms []models.Settlement
		if err := sc.All(ctx, &ms); err != nil {
			return err
		}
		for _, m := range ms {
			totals.Add(m.Currency, []ledger.Delta{ledger.SettlementDelta(m.From, m.To, m.Amount)})
		}

		_, err = s.balances.UpdateOne(ctx,
			bson.M{"userLow": k.Low, "userHigh": k.High, "currency": k.Currency},
			bson.M{"$set": bson.M{"net": totals[k], "updatedAt": time.Now().UTC()}},
			options.UpdateOne().SetUpsert(true),
		)
		return err
	})
}

// RunReconcileLoop checks (and heals) the balances once shortly after boot and
// then every `every`, until ctx is cancelled. Run it in a goroutine.
func (s *Service) RunReconcileLoop(ctx context.Context, log *slog.Logger, every time.Duration) {
	timer := time.NewTimer(time.Minute)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			rep, err := s.Reconcile(ctx, true)
			switch {
			case err != nil:
				log.Error("balance reconcile failed", "err", err)
			case len(rep.Drift) > 0:
				// Should never happen; if it does, this is worth investigating.
				log.Warn("balance drift repaired", "rows", rep.Rows, "drifted", len(rep.Drift), "fixed", rep.Fixed, "drift", rep.Drift)
			default:
				log.Info("balances reconciled", "rows", rep.Rows)
			}
			timer.Reset(every)
		}
	}
}
