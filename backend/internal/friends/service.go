// Package friends implements friend requests, friendships and invite links.
package friends

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/config"
	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrSelf           = errors.New("you can't add yourself")
	ErrAlreadyFriends = errors.New("you're already friends")
	ErrRequestPending = errors.New("a request is already pending")
	ErrInviteInvalid  = errors.New("invite is invalid, expired or already used")
	ErrTooManyInvites = errors.New("too many active invites, wait for one to be used or expire")
	ErrUnsettled      = errors.New("you still have an unsettled balance with this friend")
)

const (
	inviteTTL        = 7 * 24 * time.Hour
	maxActiveInvites = 20
	maxListed        = 500
)

type Service struct {
	users       *mongo.Collection
	friendships *mongo.Collection
	invites     *mongo.Collection
	balances    *mongo.Collection
	cfg         config.Config
}

func NewService(db *mongo.Database, cfg config.Config) *Service {
	return &Service{
		users:       db.Collection(database.CollUsers),
		friendships: db.Collection(database.CollFriendships),
		invites:     db.Collection(database.CollInvites),
		balances:    db.Collection(database.CollBalances),
		cfg:         cfg,
	}
}

// ---------- API shapes ----------

// PublicUser is the only user data other people can see. No email.
type PublicUser struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

type Entry struct {
	ID         string     `json:"id"` // friendship id (used for accept/decline/remove)
	Status     string     `json:"status"`
	Friend     PublicUser `json:"friend"`
	CreatedAt  time.Time  `json:"createdAt"`
	AcceptedAt *time.Time `json:"acceptedAt,omitempty"`
}

type List struct {
	Friends  []Entry `json:"friends"`
	Incoming []Entry `json:"incoming"` // requests waiting for my answer
	Outgoing []Entry `json:"outgoing"` // requests I sent
}

func publicUser(u models.User) PublicUser {
	return PublicUser{ID: u.ID.Hex(), Name: u.Name, Username: u.Username, AvatarURL: u.AvatarURL}
}

func entry(f models.Friendship, friend models.User) Entry {
	return Entry{
		ID:         f.ID.Hex(),
		Status:     f.Status,
		Friend:     publicUser(friend),
		CreatedAt:  f.CreatedAt,
		AcceptedAt: f.AcceptedAt,
	}
}

// ---------- helpers ----------

// pair returns the two ids in canonical order (low < high).
func pair(a, b bson.ObjectID) (low, high bson.ObjectID) {
	if bytes.Compare(a[:], b[:]) < 0 {
		return a, b
	}
	return b, a
}

func participant(me bson.ObjectID) bson.A {
	return bson.A{bson.M{"userLow": me}, bson.M{"userHigh": me}}
}

func (s *Service) user(ctx context.Context, id bson.ObjectID) (models.User, error) {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Service) entryFor(ctx context.Context, f models.Friendship, me bson.ObjectID) (Entry, error) {
	other, err := s.user(ctx, f.Other(me))
	if err != nil {
		return Entry{}, err
	}
	return entry(f, other), nil
}

// ---------- friends ----------

func (s *Service) List(ctx context.Context, me bson.ObjectID) (List, error) {
	cur, err := s.friendships.Find(ctx,
		bson.M{"$or": participant(me)},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(maxListed),
	)
	if err != nil {
		return List{}, err
	}
	var fs []models.Friendship
	if err := cur.All(ctx, &fs); err != nil {
		return List{}, err
	}

	ids := make([]bson.ObjectID, 0, len(fs))
	for _, f := range fs {
		ids = append(ids, f.Other(me))
	}
	byID := make(map[bson.ObjectID]models.User, len(ids))
	if len(ids) > 0 {
		ucur, err := s.users.Find(ctx, bson.M{"_id": bson.M{"$in": ids}})
		if err != nil {
			return List{}, err
		}
		var us []models.User
		if err := ucur.All(ctx, &us); err != nil {
			return List{}, err
		}
		for _, u := range us {
			byID[u.ID] = u
		}
	}

	out := List{Friends: []Entry{}, Incoming: []Entry{}, Outgoing: []Entry{}}
	for _, f := range fs {
		u, ok := byID[f.Other(me)]
		if !ok {
			continue // account vanished; skip rather than fail the whole list
		}
		e := entry(f, u)
		switch {
		case f.Status == models.FriendAccepted:
			out.Friends = append(out.Friends, e)
		case f.RequestedBy == me:
			out.Outgoing = append(out.Outgoing, e)
		default:
			out.Incoming = append(out.Incoming, e)
		}
	}
	sort.Slice(out.Friends, func(i, j int) bool {
		return strings.ToLower(out.Friends[i].Friend.Name) < strings.ToLower(out.Friends[j].Friend.Name)
	})
	return out, nil
}

// SendRequest finds a user by email or username and sends them a friend
// request. If they had already asked me, it accepts instead (autoAccepted).
func (s *Service) SendRequest(ctx context.Context, me bson.ObjectID, email, username string) (e Entry, autoAccepted bool, err error) {
	filter := bson.M{}
	if email != "" {
		filter["email"] = strings.ToLower(strings.TrimSpace(email))
	} else {
		filter["username"] = strings.ToLower(strings.TrimSpace(username))
	}
	var target models.User
	if err = s.users.FindOne(ctx, filter).Decode(&target); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return e, false, ErrNotFound
		}
		return e, false, err
	}
	if target.ID == me {
		return e, false, ErrSelf
	}

	low, high := pair(me, target.ID)
	var existing models.Friendship
	err = s.friendships.FindOne(ctx, bson.M{"userLow": low, "userHigh": high}).Decode(&existing)
	switch {
	case err == nil:
		if existing.Status == models.FriendAccepted {
			return e, false, ErrAlreadyFriends
		}
		if existing.RequestedBy == me {
			return e, false, ErrRequestPending
		}
		// They already asked me: sending a request back means "yes".
		accepted, aerr := s.Accept(ctx, me, existing.ID)
		return accepted, true, aerr
	case !errors.Is(err, mongo.ErrNoDocuments):
		return e, false, err
	}

	f := models.Friendship{
		UserLow:     low,
		UserHigh:    high,
		Status:      models.FriendPending,
		RequestedBy: me,
		CreatedAt:   time.Now().UTC(),
	}
	res, err := s.friendships.InsertOne(ctx, f)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return e, false, ErrRequestPending // lost a race with the other side
		}
		return e, false, err
	}
	f.ID = res.InsertedID.(bson.ObjectID)
	return entry(f, target), false, nil
}

// Accept accepts a pending request that someone else sent me.
func (s *Service) Accept(ctx context.Context, me, id bson.ObjectID) (Entry, error) {
	now := time.Now().UTC()
	var f models.Friendship
	err := s.friendships.FindOneAndUpdate(ctx,
		bson.M{
			"_id":         id,
			"status":      models.FriendPending,
			"requestedBy": bson.M{"$ne": me}, // only the recipient may accept
			"$or":         participant(me),
		},
		bson.M{"$set": bson.M{"status": models.FriendAccepted, "acceptedAt": now}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Entry{}, ErrNotFound
	}
	if err != nil {
		return Entry{}, err
	}
	return s.entryFor(ctx, f, me)
}

// Decline rejects a pending request that someone else sent me.
func (s *Service) Decline(ctx context.Context, me, id bson.ObjectID) error {
	res, err := s.friendships.DeleteOne(ctx, bson.M{
		"_id":         id,
		"status":      models.FriendPending,
		"requestedBy": bson.M{"$ne": me},
		"$or":         participant(me),
	})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// Remove deletes a friendship: unfriend, or cancel a request I sent. An
// accepted friendship with an unsettled balance is refused with ErrUnsettled
// unless force is set.
func (s *Service) Remove(ctx context.Context, me, id bson.ObjectID, force bool) error {
	var f models.Friendship
	err := s.friendships.FindOne(ctx, bson.M{"_id": id, "$or": participant(me)}).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	// Don't let a friend vanish while money is still owed, unless forced.
	if f.Status == models.FriendAccepted && !force {
		open, err := s.balances.CountDocuments(ctx, bson.M{
			"userLow": f.UserLow, "userHigh": f.UserHigh, "net": bson.M{"$ne": 0},
		})
		if err != nil {
			return err
		}
		if open > 0 {
			return ErrUnsettled
		}
	}

	res, err := s.friendships.DeleteOne(ctx, bson.M{"_id": id, "$or": participant(me)})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- invite links ----------

type InviteLink struct {
	Token     string    `json:"token"`
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (s *Service) CreateInvite(ctx context.Context, me bson.ObjectID) (InviteLink, error) {
	now := time.Now().UTC()
	active, err := s.invites.CountDocuments(ctx, bson.M{
		"inviterId": me, "usedBy": nil, "expiresAt": bson.M{"$gt": now},
	})
	if err != nil {
		return InviteLink{}, err
	}
	if active >= maxActiveInvites {
		return InviteLink{}, ErrTooManyInvites
	}

	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return InviteLink{}, err
	}
	inv := models.Invite{
		Token:     base64.RawURLEncoding.EncodeToString(b),
		InviterID: me,
		CreatedAt: now,
		ExpiresAt: now.Add(inviteTTL),
	}
	if _, err := s.invites.InsertOne(ctx, inv); err != nil {
		return InviteLink{}, err
	}
	return InviteLink{
		Token:     inv.Token,
		URL:       s.cfg.FrontendURL + "/invite/" + inv.Token,
		ExpiresAt: inv.ExpiresAt,
	}, nil
}

type InvitePreview struct {
	Inviter   PublicUser `json:"inviter"`
	ExpiresAt time.Time  `json:"expiresAt"`
	Own       bool       `json:"own"` // true when I'm looking at my own invite
}

// PreviewInvite shows who an invite is from, without using it.
func (s *Service) PreviewInvite(ctx context.Context, me bson.ObjectID, token string) (InvitePreview, error) {
	var inv models.Invite
	err := s.invites.FindOne(ctx, bson.M{
		"token": token, "usedBy": nil, "expiresAt": bson.M{"$gt": time.Now().UTC()},
	}).Decode(&inv)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return InvitePreview{}, ErrInviteInvalid
	}
	if err != nil {
		return InvitePreview{}, err
	}
	inviter, err := s.user(ctx, inv.InviterID)
	if err != nil {
		return InvitePreview{}, ErrInviteInvalid
	}
	return InvitePreview{Inviter: publicUser(inviter), ExpiresAt: inv.ExpiresAt, Own: inv.InviterID == me}, nil
}

// AcceptInvite consumes a single-use invite and makes me friends with the
// inviter immediately (no request/approval step: they created the link).
func (s *Service) AcceptInvite(ctx context.Context, me bson.ObjectID, token string) (Entry, error) {
	now := time.Now().UTC()

	var inv models.Invite
	err := s.invites.FindOneAndUpdate(ctx,
		bson.M{
			"token":     token,
			"usedBy":    nil,
			"expiresAt": bson.M{"$gt": now},
			"inviterId": bson.M{"$ne": me},
		},
		bson.M{"$set": bson.M{"usedBy": me, "usedAt": now}},
		options.FindOneAndUpdate().SetReturnDocument(options.Before),
	).Decode(&inv)
	if errors.Is(err, mongo.ErrNoDocuments) {
		// Distinguish "my own invite" from "bad/used/expired" for a clearer message.
		var own models.Invite
		if e := s.invites.FindOne(ctx, bson.M{"token": token, "inviterId": me}).Decode(&own); e == nil {
			return Entry{}, ErrSelf
		}
		return Entry{}, ErrInviteInvalid
	}
	if err != nil {
		return Entry{}, err
	}

	low, high := pair(me, inv.InviterID)
	_, err = s.friendships.UpdateOne(ctx,
		bson.M{"userLow": low, "userHigh": high},
		bson.M{
			"$set":         bson.M{"status": models.FriendAccepted},
			"$min":         bson.M{"acceptedAt": now}, // keep the earliest if already friends
			"$setOnInsert": bson.M{"requestedBy": inv.InviterID, "createdAt": now},
		},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		// Don't burn the invite if we couldn't create the friendship.
		_, _ = s.invites.UpdateOne(ctx, bson.M{"_id": inv.ID}, bson.M{"$unset": bson.M{"usedBy": "", "usedAt": ""}})
		return Entry{}, err
	}

	var f models.Friendship
	if err := s.friendships.FindOne(ctx, bson.M{"userLow": low, "userHigh": high}).Decode(&f); err != nil {
		return Entry{}, err
	}
	return s.entryFor(ctx, f, me)
}
