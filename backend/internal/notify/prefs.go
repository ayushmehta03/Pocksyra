package notify

import (
	"context"
	"errors"
	"slices"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// Groups are the switches a person sees in Settings. Each notification type
// belongs to one group; muting a group stops both the inbox entry and the push.
const (
	GroupFriends   = "friends"
	GroupExpenses  = "expenses"
	GroupPayments  = "payments"
	GroupReminders = "reminders"
)

// Groups lists every group in the order Settings shows them.
var Groups = []string{GroupFriends, GroupExpenses, GroupPayments, GroupReminders}

var ErrBadGroup = errors.New("unknown notification group")

// GroupOf says which switch controls a notification type. An unknown type has
// no group and so can't be muted.
func GroupOf(t string) string {
	switch t {
	case TypeFriendRequest, TypeFriendAccepted:
		return GroupFriends
	case TypeExpenseAdded:
		return GroupExpenses
	case TypePaymentPending, TypePaymentRecorded, TypePaymentConfirmed, TypePaymentDeclined, TypePaymentCancelled:
		return GroupPayments
	case TypePaymentReminder:
		return GroupReminders
	}
	return ""
}

// NormalizeMuted checks the groups, drops duplicates and returns them in the
// standard order, so the same choice is always stored the same way.
func NormalizeMuted(in []string) ([]string, error) {
	for _, g := range in {
		if !slices.Contains(Groups, g) {
			return nil, ErrBadGroup
		}
	}
	out := make([]string, 0, len(in))
	for _, g := range Groups {
		if slices.Contains(in, g) {
			out = append(out, g)
		}
	}
	return out, nil
}

// Muted returns the groups I have switched off.
func (s *Service) Muted(ctx context.Context, me bson.ObjectID) ([]string, error) {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{"_id": me},
		options.FindOne().SetProjection(bson.M{"notifyMuted": 1})).Decode(&u)
	if err != nil {
		return nil, err
	}
	if u.NotifyMuted == nil {
		return []string{}, nil
	}
	return u.NotifyMuted, nil
}

// SetMuted replaces the groups I have switched off and returns what was stored.
func (s *Service) SetMuted(ctx context.Context, me bson.ObjectID, muted []string) ([]string, error) {
	clean, err := NormalizeMuted(muted)
	if err != nil {
		return nil, err
	}
	update := bson.M{"$set": bson.M{"notifyMuted": clean}}
	if len(clean) == 0 {
		update = bson.M{"$unset": bson.M{"notifyMuted": ""}}
	}
	if _, err := s.users.UpdateOne(ctx, bson.M{"_id": me}, update); err != nil {
		return nil, err
	}
	return clean, nil
}

// isMuted reports whether the recipient switched this type off. If the lookup
// fails the notification is delivered: missing one is worse than an extra one.
func (s *Service) isMuted(ctx context.Context, user bson.ObjectID, typ string) bool {
	group := GroupOf(typ)
	if group == "" {
		return false
	}
	muted, err := s.Muted(ctx, user)
	if err != nil {
		return false
	}
	return slices.Contains(muted, group)
}
