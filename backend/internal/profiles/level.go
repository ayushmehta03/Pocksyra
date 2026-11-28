// Package profiles builds the profile page a person's friends can see: their
// level, badges and join date. It also suggests people you may know. Levels
// are worked out from what someone has done in the app, never stored, so they
// can't drift from the real data.
package profiles

import "time"

// Experience points for each kind of activity.
const (
	xpPerExpense      = 10 // an expense you added that is shared with someone
	xpPerSettlement   = 20 // a payment between you and a friend that went through
	xpPerFriend       = 15 // an accepted friend
	xpPerQuickConfirm = 10 // confirming a friend's payment within two days
	xpPerDay          = 1  // each day since joining, up to maxDayXP
	maxDayXP          = 90

	// A payment counts as "quickly confirmed" if it was answered within this long.
	quickConfirmWindow = 48 * time.Hour
)

const (
	maxLevel = 10
	// XP needed to reach level n is levelStep * (n-1)^2: 0, 40, 160, 360, 640, ...
	levelStep = 40
)

var titles = [maxLevel]string{
	"Newcomer", "Starter", "Regular", "Settler", "Trusted",
	"Reliable", "Seasoned", "Expert", "Master", "Legend",
}

// Stats is what a person has done. XP never goes down: deleting an expense
// later does not matter much, and nothing here counts late payments against anyone.
type Stats struct {
	Expenses      int64 // shared expenses they added
	Settlements   int64 // payments with a friend that went through
	Friends       int64 // accepted friends
	QuickConfirms int64 // friends' payments they confirmed within two days
	DaysSinceJoin int64
}

// XP adds up the experience points for these stats.
func (s Stats) XP() int64 {
	days := s.DaysSinceJoin
	if days < 0 {
		days = 0
	}
	dayXP := days * xpPerDay
	if dayXP > maxDayXP {
		dayXP = maxDayXP
	}
	return s.Expenses*xpPerExpense +
		s.Settlements*xpPerSettlement +
		s.Friends*xpPerFriend +
		s.QuickConfirms*xpPerQuickConfirm +
		dayXP
}

// Level is where someone stands and how far it is to the next level.
type Level struct {
	Level   int    `json:"level"`
	Title   string `json:"title"`
	XP      int64  `json:"xp"`
	LevelXP int64  `json:"levelXp"` // XP at which this level started
	// NextXP is the XP at which the next level starts; nil at the top level.
	NextXP *int64 `json:"nextLevelXp"`
}

func xpForLevel(n int) int64 {
	return levelStep * int64(n-1) * int64(n-1)
}

// LevelFor turns experience points into a level.
func LevelFor(xp int64) Level {
	if xp < 0 {
		xp = 0
	}
	lvl := 1
	for lvl < maxLevel && xp >= xpForLevel(lvl+1) {
		lvl++
	}
	out := Level{Level: lvl, Title: titles[lvl-1], XP: xp, LevelXP: xpForLevel(lvl)}
	if lvl < maxLevel {
		next := xpForLevel(lvl + 1)
		out.NextXP = &next
	}
	return out
}

// Badge is a small milestone shown on the profile.
type Badge struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Earned      bool   `json:"earned"`
}

// BadgesFor lists every badge, marking the ones these stats have earned.
func BadgesFor(s Stats) []Badge {
	return []Badge{
		{ID: "first_expense", Label: "First split", Description: "Added an expense shared with a friend", Earned: s.Expenses >= 1},
		{ID: "ten_expenses", Label: "Regular splitter", Description: "Added 10 shared expenses", Earned: s.Expenses >= 10},
		{ID: "squared_up", Label: "Squared up", Description: "Settled a balance with a friend", Earned: s.Settlements >= 1},
		{ID: "quick_confirmer", Label: "Quick confirmer", Description: "Confirmed 3 payments within two days", Earned: s.QuickConfirms >= 3},
		{ID: "well_connected", Label: "Well connected", Description: "Has 5 friends on Pocksyra", Earned: s.Friends >= 5},
		{ID: "veteran", Label: "Veteran", Description: "Been here for 30 days", Earned: s.DaysSinceJoin >= 30},
	}
}
