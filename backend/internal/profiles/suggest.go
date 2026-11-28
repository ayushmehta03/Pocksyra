package profiles

import (
	"bytes"
	"sort"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/ayushmehta03/Pocksyra/backend/models"
)

// countMutual counts, for every person who is a friend of one of my friends,
// how many of my friends they share with me. `friends` is the set of my
// accepted friends; `excluded` holds everyone who must not be suggested (me,
// my friends, and anyone I already have a pending request with). Each element
// of `ofFriends` is an accepted friendship that has at least one of my friends in it.
func countMutual(ofFriends []models.Friendship, friends, excluded map[bson.ObjectID]bool) map[bson.ObjectID]int {
	counts := map[bson.ObjectID]int{}
	for _, f := range ofFriends {
		lowIsFriend, highIsFriend := friends[f.UserLow], friends[f.UserHigh]
		if lowIsFriend == highIsFriend {
			continue // both are my friends already, or neither is: nothing to suggest
		}
		candidate := f.UserHigh
		if highIsFriend {
			candidate = f.UserLow
		}
		if excluded[candidate] {
			continue
		}
		counts[candidate]++
	}
	return counts
}

// rank orders candidates by shared friends, most first, then by id so the
// order is the same every time, and keeps the first `limit`.
func rank(counts map[bson.ObjectID]int, limit int) []bson.ObjectID {
	ids := make([]bson.ObjectID, 0, len(counts))
	for id := range counts {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		if counts[ids[i]] != counts[ids[j]] {
			return counts[ids[i]] > counts[ids[j]]
		}
		return bytes.Compare(ids[i][:], ids[j][:]) < 0
	})
	if limit >= 0 && len(ids) > limit {
		ids = ids[:limit]
	}
	return ids
}
