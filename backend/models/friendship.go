package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const (
	FriendPending  = "pending"
	FriendAccepted = "accepted"
)

// Friendship is the `friendships` collection document. One document per pair
// of users, stored with the two ids in canonical (sorted) order so the unique
// index on (userLow, userHigh) prevents duplicates in either direction.
type Friendship struct {
	ID          bson.ObjectID `bson:"_id,omitempty"`
	UserLow     bson.ObjectID `bson:"userLow"`
	UserHigh    bson.ObjectID `bson:"userHigh"`
	Status      string        `bson:"status"`
	RequestedBy bson.ObjectID `bson:"requestedBy"`
	CreatedAt   time.Time     `bson:"createdAt"`
	AcceptedAt  *time.Time    `bson:"acceptedAt,omitempty"`
}

// Other returns the other participant of the pair.
func (f Friendship) Other(me bson.ObjectID) bson.ObjectID {
	if f.UserLow == me {
		return f.UserHigh
	}
	return f.UserLow
}

// Invite is the `invites` collection document: a single-use shareable link.
type Invite struct {
	ID        bson.ObjectID  `bson:"_id,omitempty"`
	Token     string         `bson:"token"`
	InviterID bson.ObjectID  `bson:"inviterId"`
	CreatedAt time.Time      `bson:"createdAt"`
	ExpiresAt time.Time      `bson:"expiresAt"` // TTL index
	UsedBy    *bson.ObjectID `bson:"usedBy,omitempty"`
	UsedAt    *time.Time     `bson:"usedAt,omitempty"`
}
