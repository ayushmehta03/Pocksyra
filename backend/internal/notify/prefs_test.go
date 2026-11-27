package notify

import (
	"errors"
	"slices"
	"testing"
)

func TestGroupOfCoversEveryType(t *testing.T) {
	types := []string{
		TypeFriendRequest, TypeFriendAccepted, TypeExpenseAdded,
		TypePaymentPending, TypePaymentRecorded, TypePaymentConfirmed, TypePaymentDeclined, TypePaymentCancelled,
		TypePaymentReminder,
	}
	for _, ty := range types {
		g := GroupOf(ty)
		if g == "" {
			t.Errorf("type %q has no group, so it could never be muted", ty)
		} else if !slices.Contains(Groups, g) {
			t.Errorf("type %q maps to %q, which is not in Groups", ty, g)
		}
	}
	if GroupOf("something_new") != "" {
		t.Error("an unknown type should not belong to a group")
	}
}

func TestGroupOf(t *testing.T) {
	cases := map[string]string{
		TypeFriendRequest:    GroupFriends,
		TypeFriendAccepted:   GroupFriends,
		TypeExpenseAdded:     GroupExpenses,
		TypePaymentPending:   GroupPayments,
		TypePaymentCancelled: GroupPayments,
		TypePaymentReminder:  GroupReminders,
	}
	for ty, want := range cases {
		if got := GroupOf(ty); got != want {
			t.Errorf("GroupOf(%q) = %q, want %q", ty, got, want)
		}
	}
}

func TestNormalizeMuted(t *testing.T) {
	got, err := NormalizeMuted([]string{"reminders", "friends", "reminders"})
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{GroupFriends, GroupReminders}; !slices.Equal(got, want) {
		t.Errorf("got %v, want %v (deduplicated, in standard order)", got, want)
	}

	got, err = NormalizeMuted(nil)
	if err != nil || got == nil || len(got) != 0 {
		t.Errorf("nil input should give an empty, non-nil list, got %v, %v", got, err)
	}

	if _, err := NormalizeMuted([]string{"friends", "bogus"}); !errors.Is(err, ErrBadGroup) {
		t.Errorf("an unknown group should be rejected, got %v", err)
	}
}
