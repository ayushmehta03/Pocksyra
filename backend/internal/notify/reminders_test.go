package notify

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

func TestParties(t *testing.T) {
	low, high := bson.NewObjectID(), bson.NewObjectID()

	// Net > 0: the high user owes the low user.
	d, c, a := parties(models.Balance{UserLow: low, UserHigh: high, Net: 2500})
	if d != high || c != low || a != 2500 {
		t.Errorf("positive net: got debtor %v creditor %v amount %d", d, c, a)
	}

	// Net < 0: the low user owes the high user, and the amount is positive.
	d, c, a = parties(models.Balance{UserLow: low, UserHigh: high, Net: -4000})
	if d != low || c != high || a != 4000 {
		t.Errorf("negative net: got debtor %v creditor %v amount %d", d, c, a)
	}
}

func TestInReminderWindow(t *testing.T) {
	utc := func(h, m int) time.Time { return time.Date(2026, 11, 27, h, m, 0, 0, time.UTC) }

	cases := []struct {
		name string
		now  time.Time
		tz   string
		want bool
	}{
		{"09:00 in India is allowed", utc(3, 30), "Asia/Kolkata", true},
		{"08:59 in India is too early", utc(3, 29), "Asia/Kolkata", false},
		{"20:59 in India is allowed", utc(15, 29), "Asia/Kolkata", true},
		{"21:00 in India is too late", utc(15, 30), "Asia/Kolkata", false},
		{"midday UTC for an unknown zone", utc(12, 0), "Nope/Zone", true},
		{"3am UTC for an unknown zone", utc(3, 0), "Nope/Zone", false},
		{"empty zone is UTC", utc(12, 0), "", true},
	}
	for _, tc := range cases {
		if got := inReminderWindow(tc.now, tc.tz); got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}
