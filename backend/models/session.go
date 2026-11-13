package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Session is the `sessions` collection document. One document per issued
// refresh token. Only a SHA-256 hash of the token is stored.
//
// Rotation: every refresh marks the presented session Used and inserts a new
// one in the same Family. Presenting a Used token again means it was stolen
// or replayed, so the whole family is revoked.
type Session struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	UserID      bson.ObjectID `bson:"userId"`
	RefreshHash string        `bson:"refreshHash"`
	Family      string        `bson:"family"`
	Used        bool          `bson:"used"`
	UserAgent   string        `bson:"userAgent,omitempty"`
	CreatedAt   time.Time     `bson:"createdAt"`
	ExpiresAt   time.Time     `bson:"expiresAt"` // TTL index
}
