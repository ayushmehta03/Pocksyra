package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ExpenseSplit is one participant's share of an expense, in minor units.
// Value keeps the raw input (basis points, share weight or exact amount) so
// an edit form can be re-populated exactly as the user entered it.
type ExpenseSplit struct {
	UserID bson.ObjectID `bson:"userId"`
	Amount int64         `bson:"amount"`
	Value  int64         `bson:"value,omitempty"`
}

// Expense is the `expenses` collection document. Splits are embedded because
// they are always read and written together with the expense.
type Expense struct {
	ID             bson.ObjectID  `bson:"_id,omitempty"`
	CreatedBy      bson.ObjectID  `bson:"createdBy"`
	PaidBy         bson.ObjectID  `bson:"paidBy"`
	Description    string         `bson:"description"`
	Amount         int64          `bson:"amount"` // minor units
	Currency       string         `bson:"currency"`
	Method         string         `bson:"method"`
	Splits         []ExpenseSplit `bson:"splits"`
	Date           time.Time      `bson:"date"`
	IdempotencyKey string         `bson:"idempotencyKey,omitempty"`
	CreatedAt      time.Time      `bson:"createdAt"`
	UpdatedAt      time.Time      `bson:"updatedAt"`
	DeletedAt      *time.Time     `bson:"deletedAt,omitempty"` // soft delete
}

// Settlement is the `settlements` collection document: From paid To in real
// life (cash, UPI, ...) and wants the debt reduced.
type Settlement struct {
	ID             bson.ObjectID `bson:"_id,omitempty"`
	From           bson.ObjectID `bson:"from"`
	To             bson.ObjectID `bson:"to"`
	Amount         int64         `bson:"amount"`
	Currency       string        `bson:"currency"`
	Note           string        `bson:"note,omitempty"`
	CreatedBy      bson.ObjectID `bson:"createdBy"`
	IdempotencyKey string        `bson:"idempotencyKey,omitempty"`
	CreatedAt      time.Time     `bson:"createdAt"`
}

// Balance is the `balances` collection document: a materialized running total
// for one pair of users in one currency. The pair is stored canonically
// (UserLow < UserHigh by id bytes). Net > 0 means UserHigh owes UserLow,
// Net < 0 means UserLow owes UserHigh.
type Balance struct {
	ID        bson.ObjectID `bson:"_id,omitempty"`
	UserLow   bson.ObjectID `bson:"userLow"`
	UserHigh  bson.ObjectID `bson:"userHigh"`
	Currency  string        `bson:"currency"`
	Net       int64         `bson:"net"`
	UpdatedAt time.Time     `bson:"updatedAt"`
}
