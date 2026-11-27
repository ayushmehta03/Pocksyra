// Package notify stores in-app notifications and serves them to their owner.
// Other packages create them through the Sender interface; a notification
// failing to save is logged and never fails the action that caused it.
package notify

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// Notification types.
const (
	TypeFriendRequest    = "friend_request"
	TypeFriendAccepted   = "friend_accepted"
	TypeExpenseAdded     = "expense_added"
	TypePaymentPending   = "payment_pending"   // someone says they paid me; waiting for my answer
	TypePaymentRecorded  = "payment_recorded"  // someone recorded a payment from me
	TypePaymentConfirmed = "payment_confirmed" // they confirmed my payment
	TypePaymentDeclined  = "payment_declined"  // they say they didn't get my payment
	TypePaymentCancelled = "payment_cancelled" // they withdrew a payment they had said they made
)

// ActorToken in a message is replaced with the actor's name when it is saved.
const ActorToken = "{actor}"

const (
	defaultLimit = 50
	maxLimit     = 100
)

// Event describes one notification to create.
type Event struct {
	To      bson.ObjectID // recipient
	Actor   bson.ObjectID // who did it; their name replaces ActorToken
	Type    string
	Message string
	Link    string
}

// Sender is what the rest of the app uses to raise notifications.
type Sender interface {
	Send(ctx context.Context, e Event)
}

// Pusher delivers a notification to the person's devices as a push message.
type Pusher interface {
	Push(ctx context.Context, user bson.ObjectID, title, body, link string)
}

type Service struct {
	users  *mongo.Collection
	coll   *mongo.Collection
	pusher Pusher
}

// SetPusher makes every saved notification also go out as a push message.
func (s *Service) SetPusher(p Pusher) { s.pusher = p }

func NewService(db *mongo.Database) *Service {
	return &Service{
		users: db.Collection(database.CollUsers),
		coll:  db.Collection(database.CollNotifications),
	}
}

// Send saves a notification. It never returns an error: a lost notification is
// logged, not allowed to undo the expense, payment or friend request behind it.
// It keeps running if the request that triggered it has already finished.
func (s *Service) Send(parent context.Context, e Event) {
	if e.To.IsZero() || e.To == e.Actor {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), 3*time.Second)
	defer cancel()

	msg := e.Message
	if strings.Contains(msg, ActorToken) {
		msg = strings.ReplaceAll(msg, ActorToken, s.actorName(ctx, e.Actor))
	}
	n := models.Notification{
		ID: bson.NewObjectID(), UserID: e.To, ActorID: e.Actor, Type: e.Type,
		Message: msg, Link: e.Link, CreatedAt: time.Now().UTC(),
	}
	if _, err := s.coll.InsertOne(ctx, n); err != nil {
		slog.Warn("notification not saved", "type", e.Type, "err", err)
		return
	}
	if s.pusher != nil {
		go s.pusher.Push(context.WithoutCancel(parent), e.To, "Pocksyra", msg, e.Link)
	}
}

func (s *Service) actorName(ctx context.Context, id bson.ObjectID) string {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{"_id": id}, options.FindOne().SetProjection(bson.M{"name": 1})).Decode(&u)
	if err != nil || strings.TrimSpace(u.Name) == "" {
		return "Someone"
	}
	return u.Name
}

// View is what the API returns.
type View struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	Link      string    `json:"link,omitempty"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"createdAt"`
}

func view(n models.Notification) View {
	return View{ID: n.ID.Hex(), Type: n.Type, Message: n.Message, Link: n.Link, Read: n.ReadAt != nil, CreatedAt: n.CreatedAt}
}

// List returns my newest notifications and how many are unread overall.
func (s *Service) List(ctx context.Context, me bson.ObjectID, limit int) ([]View, int64, error) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	cur, err := s.coll.Find(ctx, bson.M{"userId": me},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, 0, err
	}
	var ns []models.Notification
	if err := cur.All(ctx, &ns); err != nil {
		return nil, 0, err
	}
	out := make([]View, len(ns))
	for i, n := range ns {
		out[i] = view(n)
	}
	unread, err := s.Unread(ctx, me)
	if err != nil {
		return nil, 0, err
	}
	return out, unread, nil
}

// Unread counts my notifications that haven't been opened.
func (s *Service) Unread(ctx context.Context, me bson.ObjectID) (int64, error) {
	return s.coll.CountDocuments(ctx, bson.M{"userId": me, "readAt": nil})
}

// MarkRead marks one of my notifications as read. Marking one that is already
// read, or that isn't mine, changes nothing.
func (s *Service) MarkRead(ctx context.Context, me, id bson.ObjectID) error {
	_, err := s.coll.UpdateOne(ctx,
		bson.M{"_id": id, "userId": me, "readAt": nil},
		bson.M{"$set": bson.M{"readAt": time.Now().UTC()}})
	return err
}

// MarkAllRead marks everything of mine as read.
func (s *Service) MarkAllRead(ctx context.Context, me bson.ObjectID) error {
	_, err := s.coll.UpdateMany(ctx,
		bson.M{"userId": me, "readAt": nil},
		bson.M{"$set": bson.M{"readAt": time.Now().UTC()}})
	return err
}

var errBadID = errors.New("invalid id")
