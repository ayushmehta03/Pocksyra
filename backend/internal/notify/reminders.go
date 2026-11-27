package notify

import (
	"context"
	"fmt"
	"log/slog"
	"time"
	_ "time/tzdata" // so each person's own time zone resolves even in a minimal container

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

const (
	// A balance gets a reminder once it has not changed for this long.
	reminderAfter = 7 * 24 * time.Hour
	// After a reminder, the same person is not reminded about the same friend again for this long.
	reminderCooldown = 7 * 24 * time.Hour
	// Reminders go out only between these local hours (start inclusive, end exclusive).
	reminderFromHour = 9
	reminderToHour   = 21
)

// parties says who owes whom in a balance row, and how much (always positive).
// Net > 0 means UserHigh owes UserLow; Net < 0 means UserLow owes UserHigh.
func parties(b models.Balance) (debtor, creditor bson.ObjectID, amount int64) {
	if b.Net > 0 {
		return b.UserHigh, b.UserLow, b.Net
	}
	return b.UserLow, b.UserHigh, -b.Net
}

// inReminderWindow is true when it is daytime where the person lives. An
// unknown time zone is treated as UTC.
func inReminderWindow(now time.Time, tz string) bool {
	loc, err := time.LoadLocation(tz)
	if tz == "" || err != nil {
		loc = time.UTC
	}
	h := now.In(loc).Hour()
	return h >= reminderFromHour && h < reminderToHour
}

// shouldRemind decides whether this debtor gets a reminder about this friend now.
func (s *Service) shouldRemind(ctx context.Context, now time.Time, debtor, creditor bson.ObjectID, currency string) (bool, error) {
	// Not if they were already reminded recently.
	recent, err := s.coll.CountDocuments(ctx, bson.M{
		"userId": debtor, "actorId": creditor, "type": TypePaymentReminder,
		"createdAt": bson.M{"$gte": now.Add(-reminderCooldown)},
	})
	if err != nil || recent > 0 {
		return false, err
	}

	// Not if a payment between them is already waiting to be confirmed.
	pending, err := s.settlements.CountDocuments(ctx, bson.M{
		"currency": currency,
		"status":   models.SettlementPending,
		"$or": []bson.M{
			{"from": debtor, "to": creditor},
			{"from": creditor, "to": debtor},
		},
	})
	if err != nil || pending > 0 {
		return false, err
	}

	// Only during their daytime.
	var u models.User
	err = s.users.FindOne(ctx, bson.M{"_id": debtor},
		options.FindOne().SetProjection(bson.M{"tz": 1})).Decode(&u)
	if err != nil {
		return false, err
	}
	return inReminderWindow(now, u.Timezone), nil
}

// SendReminders nudges people about balances they owe that have not changed
// for a week. It returns how many reminders were saved. A person who muted
// reminders is skipped when the notification is created.
func (s *Service) SendReminders(ctx context.Context, now time.Time) (int, error) {
	cur, err := s.balances.Find(ctx, bson.M{
		"net":       bson.M{"$ne": 0},
		"updatedAt": bson.M{"$lte": now.Add(-reminderAfter)},
	})
	if err != nil {
		return 0, err
	}
	defer cur.Close(ctx)

	sent := 0
	for cur.Next(ctx) {
		var b models.Balance
		if err := cur.Decode(&b); err != nil {
			return sent, err
		}
		debtor, creditor, amount := parties(b)

		ok, err := s.shouldRemind(ctx, now, debtor, creditor, b.Currency)
		if err != nil {
			slog.Warn("reminder check failed", "err", err)
			continue
		}
		if !ok {
			continue
		}
		days := int(now.Sub(b.UpdatedAt).Hours() / 24)
		if s.send(ctx, Event{
			To:      debtor,
			Actor:   creditor,
			Type:    TypePaymentReminder,
			Message: fmt.Sprintf("Reminder: you still owe %s %s. Nothing has changed in %d days.", ActorToken, Money(amount, b.Currency), days),
			Link:    "/dashboard/settle",
		}) {
			sent++
		}
	}
	return sent, cur.Err()
}

// RunReminderLoop checks for overdue balances shortly after boot and then
// every `every` (hourly is right, since reminders wait for the person's
// daytime), until ctx is cancelled. Run it in a goroutine.
func (s *Service) RunReminderLoop(ctx context.Context, log *slog.Logger, every time.Duration) {
	timer := time.NewTimer(2 * time.Minute)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			n, err := s.SendReminders(ctx, time.Now().UTC())
			switch {
			case err != nil:
				log.Error("balance reminders failed", "err", err)
			case n > 0:
				log.Info("balance reminders sent", "count", n)
			}
			timer.Reset(every)
		}
	}
}
