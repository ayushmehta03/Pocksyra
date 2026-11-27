package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// PushSubscription is the `push_subscriptions` collection document: one
// browser or installed app that agreed to receive push notifications for a user.
type PushSubscription struct {
	ID        bson.ObjectID `bson:"_id,omitempty"`
	UserID    bson.ObjectID `bson:"userId"`
	Endpoint  string        `bson:"endpoint"` // where the push service wants messages sent; unique
	P256dh    string        `bson:"p256dh"`   // the browser's public key (base64url)
	Auth      string        `bson:"auth"`     // the browser's auth secret (base64url)
	CreatedAt time.Time     `bson:"createdAt"`
}
