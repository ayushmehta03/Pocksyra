// Package expenses implements shared expenses, the pairwise balance ledger
// and settlements. Every change to an expense or settlement and its effect on
// the balances happen in one Mongo transaction, so the ledger can never drift.
package expenses

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/internal/friends"
	"github.com/ayushmehta03/Pocksyra/backend/internal/ledger"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrInvalid       = errors.New("invalid input")
	ErrNotFriends    = errors.New("everyone in an expense must be your friend")
	ErrNoOtherPeople = errors.New("add at least one other person")
)

const (
	maxAmount       = int64(1_000_000_000_00) // 1 billion major units, keeps int64 math far from overflow
	maxParticipants = 20
	maxListed       = 100
)

type PublicUser = friends.PublicUser

type Service struct {
	db          *mongo.Database
	users       *mongo.Collection
	friendships *mongo.Collection
	expenses    *mongo.Collection
	settlements *mongo.Collection
	balances    *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		db:          db,
		users:       db.Collection(database.CollUsers),
		friendships: db.Collection(database.CollFriendships),
		expenses:    db.Collection(database.CollExpenses),
		settlements: db.Collection(database.CollSettlements),
		balances:    db.Collection(database.CollBalances),
	}
}

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
}

// inTx runs fn inside a transaction (the dev replica set makes this possible).
func (s *Service) inTx(ctx context.Context, fn func(ctx context.Context) error) error {
	sess, err := s.db.Client().StartSession()
	if err != nil {
		return err
	}
	defer sess.EndSession(ctx)
	_, err = sess.WithTransaction(ctx, func(ctx context.Context) (any, error) {
		return nil, fn(ctx)
	})
	return err
}

// applyDeltas adds each delta to the matching pair's balance, creating the
// balance row on first use. Must run inside the same transaction as the
// write that caused the deltas.
func (s *Service) applyDeltas(ctx context.Context, currency string, ds []ledger.Delta) error {
	now := time.Now().UTC()
	for _, d := range ds {
		_, err := s.balances.UpdateOne(ctx,
			bson.M{"userLow": d.Low, "userHigh": d.High, "currency": currency},
			bson.M{"$inc": bson.M{"net": d.Amount}, "$set": bson.M{"updatedAt": now}},
			options.UpdateOne().SetUpsert(true),
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// requireFriends checks that me has an accepted friendship with every id in others.
func (s *Service) requireFriends(ctx context.Context, me bson.ObjectID, others []bson.ObjectID) error {
	if len(others) == 0 {
		return ErrNoOtherPeople
	}
	pairs := make(bson.A, 0, len(others))
	for _, o := range others {
		low, high := ledger.Canonical(me, o)
		pairs = append(pairs, bson.M{"userLow": low, "userHigh": high})
	}
	n, err := s.friendships.CountDocuments(ctx, bson.M{"status": models.FriendAccepted, "$or": pairs})
	if err != nil {
		return err
	}
	if n != int64(len(others)) {
		return ErrNotFriends
	}
	return nil
}

// people loads public profiles for the given ids, keyed by hex id.
func (s *Service) people(ctx context.Context, ids []bson.ObjectID) (map[string]PublicUser, error) {
	out := make(map[string]PublicUser, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	cur, err := s.users.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
	if err != nil {
		return nil, err
	}
	var us []models.User
	if err := cur.All(ctx, &us); err != nil {
		return nil, err
	}
	for _, u := range us {
		out[u.ID.Hex()] = PublicUser{ID: u.ID.Hex(), Name: u.Name, Username: u.Username, AvatarURL: u.AvatarURL}
	}
	return out, nil
}

func parseID(hex string) (bson.ObjectID, error) {
	id, err := bson.ObjectIDFromHex(hex)
	if err != nil {
		return id, invalid("bad user id")
	}
	return id, nil
}

func validCurrency(c string) bool {
	if len(c) != 3 {
		return false
	}
	for _, r := range c {
		if r < 'A' || r > 'Z' {
			return false
		}
	}
	return true
}
