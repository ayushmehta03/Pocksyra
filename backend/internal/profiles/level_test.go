package profiles

import "testing"

func TestXP(t *testing.T) {
	s := Stats{Expenses: 3, Settlements: 2, Friends: 4, QuickConfirms: 1, DaysSinceJoin: 10}
	// 3*10 + 2*20 + 4*15 + 1*10 + 10 = 150
	if got := s.XP(); got != 150 {
		t.Errorf("XP() = %d, want 150", got)
	}
}

func TestXPCapsDaysAndIgnoresNegative(t *testing.T) {
	if got := (Stats{DaysSinceJoin: 5000}).XP(); got != maxDayXP {
		t.Errorf("a very old account should earn at most %d XP from age, got %d", maxDayXP, got)
	}
	if got := (Stats{DaysSinceJoin: -3}).XP(); got != 0 {
		t.Errorf("negative days should earn nothing, got %d", got)
	}
}

func TestLevelFor(t *testing.T) {
	cases := []struct {
		xp   int64
		want int
	}{
		{-5, 1}, {0, 1}, {39, 1}, {40, 2}, {159, 2}, {160, 3}, {359, 3}, {360, 4},
		{3239, 9}, {3240, 10}, {1_000_000, 10},
	}
	for _, tc := range cases {
		if got := LevelFor(tc.xp).Level; got != tc.want {
			t.Errorf("LevelFor(%d).Level = %d, want %d", tc.xp, got, tc.want)
		}
	}
}

func TestLevelProgressBounds(t *testing.T) {
	l := LevelFor(100)
	if l.Level != 2 || l.LevelXP != 40 || l.NextXP == nil || *l.NextXP != 160 {
		t.Errorf("unexpected level info %+v", l)
	}
	if l.Title != "Starter" {
		t.Errorf("title = %q, want Starter", l.Title)
	}

	top := LevelFor(99999)
	if top.NextXP != nil {
		t.Error("the top level has no next level")
	}
	if top.Title != "Legend" {
		t.Errorf("top title = %q, want Legend", top.Title)
	}
	if LevelFor(-1).XP != 0 {
		t.Error("negative XP should be treated as 0")
	}
}

func TestEveryLevelHasATitle(t *testing.T) {
	for i, title := range titles {
		if title == "" {
			t.Errorf("level %d has no title", i+1)
		}
	}
}

func TestBadges(t *testing.T) {
	none := BadgesFor(Stats{})
	for _, b := range none {
		if b.Earned {
			t.Errorf("a new account should not have %q", b.ID)
		}
	}

	got := map[string]bool{}
	for _, b := range BadgesFor(Stats{Expenses: 10, Settlements: 1, Friends: 5, QuickConfirms: 2, DaysSinceJoin: 30}) {
		got[b.ID] = b.Earned
	}
	want := map[string]bool{
		"first_expense": true, "ten_expenses": true, "squared_up": true,
		"quick_confirmer": false, "well_connected": true, "veteran": true,
	}
	for id, w := range want {
		if got[id] != w {
			t.Errorf("badge %q earned = %v, want %v", id, got[id], w)
		}
	}
	if len(got) != len(want) {
		t.Errorf("expected %d badges, got %d", len(want), len(got))
	}
}
