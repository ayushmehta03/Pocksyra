package friends

import (
	"bytes"
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func TestPairIsCanonical(t *testing.T) {
	a := bson.NewObjectID()
	b := bson.NewObjectID()

	low1, high1 := pair(a, b)
	low2, high2 := pair(b, a)

	if low1 != low2 || high1 != high2 {
		t.Fatalf("pair must not depend on argument order: (%s,%s) vs (%s,%s)", low1, high1, low2, high2)
	}
	if bytes.Compare(low1[:], high1[:]) >= 0 {
		t.Fatalf("low must sort before high: %s, %s", low1, high1)
	}
}

func TestPairSameUser(t *testing.T) {
	a := bson.NewObjectID()
	low, high := pair(a, a)
	if low != a || high != a {
		t.Fatal("pair of identical ids should return them unchanged")
	}
}
