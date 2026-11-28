package profiles

import (
	"testing"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// ids returns n ids that increase with their position, so low/high pairs are predictable.
func ids(n int) []bson.ObjectID {
	out := make([]bson.ObjectID, n)
	for i := range out {
		out[i][11] = byte(i + 1)
	}
	return out
}

func friendship(a, b bson.ObjectID) models.Friendship {
	if string(a[:]) > string(b[:]) {
		a, b = b, a
	}
	return models.Friendship{UserLow: a, UserHigh: b, Status: models.FriendAccepted}
}

func TestCountMutual(t *testing.T) {
	p := ids(6)
	me, f1, f2, x, y, z := p[0], p[1], p[2], p[3], p[4], p[5]
	friends := map[bson.ObjectID]bool{f1: true, f2: true}
	// z already has a pending request with me.
	excluded := map[bson.ObjectID]bool{me: true, f1: true, f2: true, z: true}

	// x knows f1 and f2; y knows only f1; f1 and f2 know each other (nobody to
	// suggest); f2 knows me; z is excluded.
	ofFriends := []models.Friendship{
		friendship(f1, x),
		friendship(f2, x),
		friendship(f1, y),
		friendship(f1, f2),
		friendship(f2, me),
		friendship(f1, z),
	}
	got := countMutual(ofFriends, friends, excluded)

	if len(got) != 2 || got[x] != 2 || got[y] != 1 {
		t.Errorf("unexpected counts %v", got)
	}
}

func TestRankOrdersByMutualThenId(t *testing.T) {
	p := ids(4)
	a, b, c, d := p[0], p[1], p[2], p[3]
	counts := map[bson.ObjectID]int{a: 1, b: 3, c: 3, d: 2}

	got := rank(counts, 10)
	// Three shared friends first (b before c by id), then two, then one.
	want := []bson.ObjectID{b, c, d, a}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("position %d: got %v, want %v", i, got[i], want[i])
		}
	}

	if top := rank(counts, 2); len(top) != 2 || top[0] != b || top[1] != c {
		t.Errorf("limit 2 gave %v", top)
	}
	if none := rank(map[bson.ObjectID]int{}, 5); len(none) != 0 {
		t.Errorf("no candidates should give none, got %v", none)
	}
}
