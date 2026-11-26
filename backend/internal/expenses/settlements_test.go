package expenses

import (
	"testing"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

func TestStatusOf(t *testing.T) {
	cases := []struct{ in, want string }{
		{"", models.SettlementConfirmed}, // rows from before confirmations existed
		{models.SettlementConfirmed, models.SettlementConfirmed},
		{models.SettlementPending, models.SettlementPending},
		{models.SettlementDeclined, models.SettlementDeclined},
		{models.SettlementCancelled, models.SettlementCancelled},
	}
	for _, c := range cases {
		if got := statusOf(models.Settlement{Status: c.in}); got != c.want {
			t.Errorf("statusOf(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
