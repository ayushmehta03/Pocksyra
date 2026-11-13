package database

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

const (
	CollUsers    = "users"
	CollSessions = "sessions"

	CollFriendships = "friendships"
	CollInvites     = "invites"

	CollExpenses    = "expenses"
	CollSettlements = "settlements"
	CollBalances    = "balances"
)

func Connect(ctx context.Context, uri string) (*mongo.Client, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, readpref.Primary()); err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}
	return client, nil
}

// EnsureIndexes is idempotent; safe to call on every boot.
func EnsureIndexes(ctx context.Context, db *mongo.Database) error {
	_, err := db.Collection(CollUsers).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	if err != nil {
		return err
	}

	_, err = db.Collection(CollSessions).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "refreshHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "family", Value: 1}}},
		{Keys: bson.D{{Key: "userId", Value: 1}}},
		// TTL: Mongo deletes the doc once expiresAt passes.
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	if err != nil {
		return err
	}

	_, err = db.Collection(CollFriendships).Indexes().CreateMany(ctx, []mongo.IndexModel{
		// One document per pair, whichever direction the request went.
		{
			Keys:    bson.D{{Key: "userLow", Value: 1}, {Key: "userHigh", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		// "all my friendships by status" from either side of the pair.
		{Keys: bson.D{{Key: "userLow", Value: 1}, {Key: "status", Value: 1}}},
		{Keys: bson.D{{Key: "userHigh", Value: 1}, {Key: "status", Value: 1}}},
	})
	if err != nil {
		return err
	}

	_, err = db.Collection(CollInvites).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "token", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "inviterId", Value: 1}}},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	})
	if err != nil {
		return err
	}

	// Idempotency: the same (creator, key) can only ever create one document.
	// Partial so documents without a key don't collide on a missing field.
	idem := func(unique bson.D) mongo.IndexModel {
		return mongo.IndexModel{
			Keys: unique,
			Options: options.Index().SetUnique(true).SetPartialFilterExpression(
				bson.D{{Key: "idempotencyKey", Value: bson.D{{Key: "$type", Value: "string"}}}}),
		}
	}
	_, err = db.Collection(CollExpenses).Indexes().CreateMany(ctx, []mongo.IndexModel{
		idem(bson.D{{Key: "createdBy", Value: 1}, {Key: "idempotencyKey", Value: 1}}),
		{Keys: bson.D{{Key: "paidBy", Value: 1}, {Key: "date", Value: -1}}},
		{Keys: bson.D{{Key: "splits.userId", Value: 1}, {Key: "date", Value: -1}}},
	})
	if err != nil {
		return err
	}

	_, err = db.Collection(CollSettlements).Indexes().CreateMany(ctx, []mongo.IndexModel{
		idem(bson.D{{Key: "createdBy", Value: 1}, {Key: "idempotencyKey", Value: 1}}),
		{Keys: bson.D{{Key: "from", Value: 1}, {Key: "createdAt", Value: -1}}},
		{Keys: bson.D{{Key: "to", Value: 1}, {Key: "createdAt", Value: -1}}},
	})
	if err != nil {
		return err
	}

	_, err = db.Collection(CollBalances).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "userLow", Value: 1}, {Key: "userHigh", Value: 1}, {Key: "currency", Value: 1}},
			Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "userHigh", Value: 1}}},
	})
	return err
}
