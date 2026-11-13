package split

import (
	"errors"
	"testing"
)

func ids(vals ...int64) []Input {
	names := []string{"a", "b", "c", "d"}
	in := make([]Input, len(vals))
	for i, v := range vals {
		in[i] = Input{UserID: names[i], Value: v}
	}
	return in
}

func amounts(s []Share) []int64 {
	out := make([]int64, len(s))
	for i, x := range s {
		out[i] = x.Amount
	}
	return out
}

func equalSlices(a, b []int64) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestCompute(t *testing.T) {
	tests := []struct {
		name   string
		total  int64
		method string
		in     []Input
		want   []int64
	}{
		{"equal divides evenly", 900, Equal, ids(0, 0, 0), []int64{300, 300, 300}},
		{"equal gives the leftover paisa to the first", 1000, Equal, ids(0, 0, 0), []int64{334, 333, 333}},
		{"equal two ways odd total", 101, Equal, ids(0, 0), []int64{51, 50}},
		{"equal with one person", 777, Equal, ids(0), []int64{777}},
		{"exact amounts", 1000, Exact, ids(250, 750), []int64{250, 750}},
		{"exact allows a zero share", 500, Exact, ids(0, 500), []int64{0, 500}},
		{"percent 50/30/20", 1000, Percent, ids(5000, 3000, 2000), []int64{500, 300, 200}},
		{"percent thirds spread the remainder", 100, Percent, ids(3333, 3333, 3334), []int64{33, 33, 34}},
		{"shares 2:1", 900, Shares, ids(2, 1), []int64{600, 300}},
		{"shares 1:1:1 on 10", 10, Shares, ids(1, 1, 1), []int64{4, 3, 3}},
		{"largest remainder beats order", 10, Shares, ids(1, 1, 3), []int64{2, 2, 6}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Compute(tc.total, tc.method, tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !equalSlices(amounts(got), tc.want) {
				t.Fatalf("got %v, want %v", amounts(got), tc.want)
			}
			var sum int64
			for _, s := range got {
				sum += s.Amount
			}
			if sum != tc.total {
				t.Fatalf("shares sum to %d, want %d", sum, tc.total)
			}
		})
	}
}

func TestComputeErrors(t *testing.T) {
	tests := []struct {
		name   string
		total  int64
		method string
		in     []Input
		want   error
	}{
		{"zero total", 0, Equal, ids(0), ErrBadTotal},
		{"negative total", -5, Equal, ids(0), ErrBadTotal},
		{"no participants", 100, Equal, nil, ErrNoParticipants},
		{"unknown method", 100, "weird", ids(0), ErrBadMethod},
		{"duplicate participant", 100, Equal, []Input{{UserID: "a"}, {UserID: "a"}}, ErrDuplicate},
		{"exact sum too low", 1000, Exact, ids(100, 100), ErrSumMismatch},
		{"exact negative", 100, Exact, ids(-1, 101), ErrBadValue},
		{"percent not 100", 1000, Percent, ids(5000, 4000), ErrSumMismatch},
		{"percent zero weight", 1000, Percent, ids(10000, 0), ErrBadValue},
		{"shares zero weight", 100, Shares, ids(1, 0), ErrBadValue},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Compute(tc.total, tc.method, tc.in)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

// Property check: for many totals and weightings the shares always add up
// exactly and no one is off by more than one minor unit from their exact share.
func TestAllocateAlwaysSumsAndStaysFair(t *testing.T) {
	for total := int64(1); total <= 500; total++ {
		for _, w := range [][]int64{{1, 1, 1}, {1, 2, 3}, {7, 7, 1, 5}, {1}} {
			got, err := Compute(total, Shares, ids(w...))
			if err != nil {
				t.Fatal(err)
			}
			var wsum, sum int64
			for _, x := range w {
				wsum += x
			}
			for i, s := range got {
				sum += s.Amount
				exact := total * w[i] // compare s.Amount*wsum with exact within one unit
				diff := s.Amount*wsum - exact
				if diff < -wsum || diff > wsum {
					t.Fatalf("total=%d w=%v share %d too far from exact", total, w, i)
				}
			}
			if sum != total {
				t.Fatalf("total=%d w=%v sums to %d", total, w, sum)
			}
		}
	}
}
