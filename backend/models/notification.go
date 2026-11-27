package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// Notification is the `notifications` collection document: one thing that
// happened that the recipient should know about. The text is written when the
// event happens, so it stays readable even if names or amounts change later.
type Notification struct {
	ID      bson.ObjectID `bson:"_id,omitempty"`
	UserID  bson.ObjectID `bson:"userId"` // who gets it
	ActorID bson.ObjectID `bson:"actorId,omitempty"`
	Type    string        `bson:"type"`
	Message string        `bson:"message"`
	Link    string        `bson:"link,omitempty"` // app path to open, e.g. /dashboard/settle

	ReadAt    *time.Time `bson:"readAt,omitempty"`
	CreatedAt time.Time  `bson:"createdAt"`
}
