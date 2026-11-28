package profiles

import (
	"bytes"
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

var ErrNotFound = errors.New("not found")

const (
	maxFriends        = 500  // friendships read per person
	maxFriendsOfFriends = 5000 // friendships of my friends read when suggesting people
	defaultSuggest    = 10
	maxSuggest        = 20
)

type Service struct {
	users       *mongo.Collection
	friendships *mongo.Collection
	expenses    *mongo.Collection
	settlements *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		users:       db.Collection(database.CollUsers),
		friendships: db.Collection(database.CollFriendships),
		expenses:    db.Collection(database.CollExpenses),
		settlements: db.Collection(database.CollSettlements),
	}
}

// PublicUser is the only user data other people can see. No email.
type PublicUser struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

func publicUser(u models.User) PublicUser {
	return PublicUser{ID: u.ID.Hex(), Name: u.Name, Username: u.Username, AvatarURL: u.AvatarURL}
}

// Profile is what a person's friends (and the person) can see. It shows
// experience and badges, never expenses, payments or balances.
type Profile struct {
	User        PublicUser `json:"user"`
	MemberSince time.Time  `json:"memberSince"`
	Level       Level      `json:"level"`
	Badges      []Badge    `json:"badges"`
	Friends     int        `json:"friends"`
	// MutualFriends is how many friends I share with them; left out on my own profile.
	MutualFriends *int `json:"mutualFriends,omitempty"`
	IsSelf        bool `json:"isSelf"`
}

// pair returns the two ids in canonical order (low < high), as friendships store them.
func pair(a, b bson.ObjectID) (low, high bson.ObjectID) {
	if bytes.Compare(a[:], b[:]) < 0 {
		return a, b
	}
	return b, a
}

func participant(id bson.ObjectID) bson.A {
	return bson.A{bson.M{"userLow": id}, bson.M{"userHigh": id}}
}

// friendIDs returns the people this user is friends with.
func (s *Service) friendIDs(ctx context.Context, id bson.ObjectID) ([]bson.ObjectID, error) {
	cur, err := s.friendships.Find(ctx,
		bson.M{"status": models.FriendAccepted, "$or": participant(id)},
		options.Find().SetLimit(maxFriends).SetProjection(bson.M{"userLow": 1, "userHigh": 1}))
	if err != nil {
		return nil, err
	}
	var fs []models.Friendship
	if err := cur.All(ctx, &fs); err != nil {
		return nil, err
	}
	out := make([]bson.ObjectID, len(fs))
	for i, f := range fs {
		out[i] = f.Other(id)
	}
	return out, nil
}

// stats counts what this person has done in the app.
func (s *Service) stats(ctx context.Context, u models.User, now time.Time) (Stats, error) {
	var st Stats
	var err error

	// Shared expenses they added: at least one other person has a share.
	st.Expenses, err = s.expenses.CountDocuments(ctx, bson.M{
		"createdBy": u.ID,
		"deletedAt": nil,
		"splits":    bson.M{"$elemMatch": bson.M{"userId": bson.M{"$ne": u.ID}}},
	})
	if err != nil {
		return st, err
	}

	// Payments that went through (a pending, declined or cancelled one doesn't count).
	notApplied := bson.M{"$nin": bson.A{models.SettlementPending, models.SettlementDeclined, models.SettlementCancelled}}
	st.Settlements, err = s.settlements.CountDocuments(ctx, bson.M{
		"$or":    bson.A{bson.M{"from": u.ID}, bson.M{"to": u.ID}},
		"status": notApplied,
	})
	if err != nil {
		return st, err
	}

	st.Friends, err = s.friendships.CountDocuments(ctx, bson.M{"status": models.FriendAccepted, "$or": participant(u.ID)})
	if err != nil {
		return st, err
	}

	// Payments to them that they confirmed within two days.
	st.QuickConfirms, err = s.settlements.CountDocuments(ctx, bson.M{
		"to":        u.ID,
		"status":    models.SettlementConfirmed,
		"decidedAt": bson.M{"$ne": nil},
		"$expr": bson.M{"$lte": bson.A{
			bson.M{"$subtract": bson.A{"$decidedAt", "$createdAt"}},
			quickConfirmWindow.Milliseconds(),
		}},
	})
	if err != nil {
		return st, err
	}

	st.DaysSinceJoin = int64(now.Sub(u.CreatedAt).Hours() / 24)
	return st, nil
}

// Get returns a profile. It works for me and for my accepted friends; for
// anyone else it says not found, so it can't be used to look people up.
func (s *Service) Get(ctx context.Context, me, target bson.ObjectID) (Profile, error) {
	self := me == target
	if !self {
		low, high := pair(me, target)
		n, err := s.friendships.CountDocuments(ctx, bson.M{"userLow": low, "userHigh": high, "status": models.FriendAccepted})
		if err != nil {
			return Profile{}, err
		}
		if n == 0 {
			return Profile{}, ErrNotFound
		}
	}

	var u models.User
	if err := s.users.FindOne(ctx, bson.M{"_id": target}).Decode(&u); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return Profile{}, ErrNotFound
		}
		return Profile{}, err
	}

	st, err := s.stats(ctx, u, time.Now().UTC())
	if err != nil {
		return Profile{}, err
	}
	p := Profile{
		User:        publicUser(u),
		MemberSince: u.CreatedAt,
		Level:       LevelFor(st.XP()),
		Badges:      BadgesFor(st),
		Friends:     int(st.Friends),
		IsSelf:      self,
	}

	if !self {
		mine, err := s.friendIDs(ctx, me)
		if err != nil {
			return Profile{}, err
		}
		theirs, err := s.friendIDs(ctx, target)
		if err != nil {
			return Profile{}, err
		}
		have := make(map[bson.ObjectID]bool, len(mine))
		for _, id := range mine {
			have[id] = true
		}
		mutual := 0
		for _, id := range theirs {
			if have[id] {
				mutual++
			}
		}
		p.MutualFriends = &mutual
	}
	return p, nil
}

// Suggestion is someone I might know, with how many friends we share.
type Suggestion struct {
	User          PublicUser `json:"user"`
	MutualFriends int        `json:"mutualFriends"`
}

// Suggestions returns friends of my friends, the ones I share the most
// friends with first. People I'm already friends with, or have a pending
// request with in either direction, are left out.
func (s *Service) Suggestions(ctx context.Context, me bson.ObjectID, limit int) ([]Suggestion, error) {
	if limit <= 0 {
		limit = defaultSuggest
	}
	if limit > maxSuggest {
		limit = maxSuggest
	}

	// Everyone I have any friendship record with: accepted friends, plus pending either way.
	cur, err := s.friendships.Find(ctx,
		bson.M{"$or": participant(me)},
		options.Find().SetLimit(maxFriends*2))
	if err != nil {
		return nil, err
	}
	var mine []models.Friendship
	if err := cur.All(ctx, &mine); err != nil {
		return nil, err
	}
	friends := map[bson.ObjectID]bool{}
	excluded := map[bson.ObjectID]bool{me: true}
	friendList := bson.A{}
	for _, f := range mine {
		other := f.Other(me)
		excluded[other] = true
		if f.Status == models.FriendAccepted {
			friends[other] = true
			friendList = append(friendList, other)
		}
	}
	if len(friends) == 0 {
		return []Suggestion{}, nil
	}

	// Accepted friendships that have one of my friends in them.
	cur, err = s.friendships.Find(ctx,
		bson.M{
			"status": models.FriendAccepted,
			"$or": bson.A{
				bson.M{"userLow": bson.M{"$in": friendList}},
				bson.M{"userHigh": bson.M{"$in": friendList}},
			},
		},
		options.Find().SetLimit(maxFriendsOfFriends).SetProjection(bson.M{"userLow": 1, "userHigh": 1}))
	if err != nil {
		return nil, err
	}
	var ofFriends []models.Friendship
	if err := cur.All(ctx, &ofFriends); err != nil {
		return nil, err
	}

	counts := countMutual(ofFriends, friends, excluded)
	top := rank(counts, limit)
	if len(top) == 0 {
		return []Suggestion{}, nil
	}

	ucur, err := s.users.Find(ctx, bson.M{"_id": bson.M{"$in": top}})
	if err != nil {
		return nil, err
	}
	var us []models.User
	if err := ucur.All(ctx, &us); err != nil {
		return nil, err
	}
	byID := make(map[bson.ObjectID]models.User, len(us))
	for _, u := range us {
		byID[u.ID] = u
	}

	out := make([]Suggestion, 0, len(top))
	for _, id := range top {
		u, ok := byID[id]
		if !ok {
			continue // account vanished
		}
		out = append(out, Suggestion{User: publicUser(u), MutualFriends: counts[id]})
	}
	return out, nil
}
