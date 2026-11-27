package push

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/config"
	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

var ErrInvalid = errors.New("invalid push subscription")

// maxPerUser keeps one account from piling up subscriptions; the oldest go first.
const maxPerUser = 10

type Service struct {
	subs   *mongo.Collection
	sender *Sender // nil when push isn't configured
}

// NewService returns a service that is switched off when VAPID_PRIVATE_KEY is
// not set, so the rest of the app runs fine without push.
func NewService(db *mongo.Database, cfg config.Config) (*Service, error) {
	s := &Service{subs: db.Collection(database.CollPushSubscriptions)}
	if cfg.VAPIDPrivateKey != "" {
		sender, err := NewSender(cfg.VAPIDPrivateKey, cfg.VAPIDSubject)
		if err != nil {
			return nil, err
		}
		s.sender = sender
	}
	return s, nil
}

func (s *Service) Enabled() bool { return s.sender != nil }

func (s *Service) PublicKey() string {
	if s.sender == nil {
		return ""
	}
	return s.sender.PublicKey()
}

// Subscribe saves (or takes over) a subscription for me. The same browser
// signing in as someone else moves its subscription to that account.
func (s *Service) Subscribe(ctx context.Context, me bson.ObjectID, sub Subscription) error {
	if !endpointAllowed(sub.Endpoint) {
		return ErrInvalid
	}
	key, err := decodeB64(sub.P256dh)
	if err != nil || len(key) != 65 {
		return ErrInvalid
	}
	auth, err := decodeB64(sub.Auth)
	if err != nil || len(auth) < 8 || len(auth) > 32 {
		return ErrInvalid
	}

	_, err = s.subs.UpdateOne(ctx,
		bson.M{"endpoint": sub.Endpoint},
		bson.M{
			"$set":         bson.M{"userId": me, "p256dh": sub.P256dh, "auth": sub.Auth},
			"$setOnInsert": bson.M{"createdAt": time.Now().UTC()},
		},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return err
	}
	return s.trim(ctx, me)
}

// trim drops a user's oldest subscriptions beyond the cap.
func (s *Service) trim(ctx context.Context, me bson.ObjectID) error {
	n, err := s.subs.CountDocuments(ctx, bson.M{"userId": me})
	if err != nil || n <= maxPerUser {
		return err
	}
	cur, err := s.subs.Find(ctx, bson.M{"userId": me},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}).SetLimit(n-maxPerUser).SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return err
	}
	var old []models.PushSubscription
	if err := cur.All(ctx, &old); err != nil {
		return err
	}
	ids := make([]bson.ObjectID, len(old))
	for i, o := range old {
		ids[i] = o.ID
	}
	_, err = s.subs.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": ids}})
	return err
}

// Unsubscribe forgets one of my subscriptions.
func (s *Service) Unsubscribe(ctx context.Context, me bson.ObjectID, endpoint string) error {
	_, err := s.subs.DeleteOne(ctx, bson.M{"userId": me, "endpoint": endpoint})
	return err
}

// Push sends a notification to every device a user has subscribed. It is meant
// to run in its own goroutine and never reports failure to the caller: a dead
// subscription is removed, anything else is logged.
func (s *Service) Push(ctx context.Context, user bson.ObjectID, title, body, link string) {
	if s.sender == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancel()

	cur, err := s.subs.Find(ctx, bson.M{"userId": user})
	if err != nil {
		slog.Warn("push: load subscriptions", "err", err)
		return
	}
	var subs []models.PushSubscription
	if err := cur.All(ctx, &subs); err != nil || len(subs) == 0 {
		return
	}
	payload, err := json.Marshal(map[string]string{"title": title, "body": body, "link": link})
	if err != nil {
		return
	}
	for _, sub := range subs {
		gone, err := s.sender.Send(ctx, Subscription{Endpoint: sub.Endpoint, P256dh: sub.P256dh, Auth: sub.Auth}, payload)
		switch {
		case gone:
			_, _ = s.subs.DeleteOne(ctx, bson.M{"_id": sub.ID})
		case err != nil:
			slog.Warn("push: send failed", "err", err)
		}
	}
}
