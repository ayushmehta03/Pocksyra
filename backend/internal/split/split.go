// Package split turns "who owes what" rules into exact per-person amounts.
// All money is integer minor units (paise/cents); no floats are ever used.
package split

import (
	"errors"
	"fmt"
	"sort"
)

const (
	Equal   = "equal"   // everyone pays the same share
	Exact   = "exact"   // Value is an exact amount in minor units
	Percent = "percent" // Value is basis points; all must add up to 10000
	Shares  = "shares"  // Value is a relative weight (e.g. 2 shares vs 1)
)

const BasisPoints = 10000

var (
	ErrNoParticipants = errors.New("at least one participant is required")
	ErrBadTotal       = errors.New("total must be greater than zero")
	ErrBadMethod      = errors.New("unknown split method")
	ErrDuplicate      = errors.New("a participant appears more than once")
	ErrBadValue       = errors.New("split values must be positive")
	ErrSumMismatch    = errors.New("split values do not add up")
)

// Input is one participant's rule. Value is ignored for Equal.
type Input struct {
	UserID string
	Value  int64
}

// Share is one participant's final amount owed, in minor units.
type Share struct {
	UserID string
	Amount int64
}

// Compute divides total among the participants. The returned amounts always
// sum to exactly total, in the same order as the input.
func Compute(total int64, method string, in []Input) ([]Share, error) {
	if total <= 0 {
		return nil, ErrBadTotal
	}
	if len(in) == 0 {
		return nil, ErrNoParticipants
	}
	seen := make(map[string]struct{}, len(in))
	for _, p := range in {
		if _, dup := seen[p.UserID]; dup {
			return nil, ErrDuplicate
		}
		seen[p.UserID] = struct{}{}
	}

	switch method {
	case Equal:
		weights := make([]int64, len(in))
		for i := range weights {
			weights[i] = 1
		}
		return allocate(total, in, weights), nil

	case Exact:
		var sum int64
		out := make([]Share, len(in))
		for i, p := range in {
			if p.Value < 0 {
				return nil, ErrBadValue
			}
			sum += p.Value
			out[i] = Share{UserID: p.UserID, Amount: p.Value}
		}
		if sum != total {
			return nil, fmt.Errorf("%w: amounts add up to %d, expected %d", ErrSumMismatch, sum, total)
		}
		return out, nil

	case Percent:
		weights, sum, err := weightsOf(in)
		if err != nil {
			return nil, err
		}
		if sum != BasisPoints {
			return nil, fmt.Errorf("%w: percentages add up to %d basis points, expected %d", ErrSumMismatch, sum, BasisPoints)
		}
		return allocate(total, in, weights), nil

	case Shares:
		weights, _, err := weightsOf(in)
		if err != nil {
			return nil, err
		}
		return allocate(total, in, weights), nil
	}
	return nil, ErrBadMethod
}

func weightsOf(in []Input) ([]int64, int64, error) {
	weights := make([]int64, len(in))
	var sum int64
	for i, p := range in {
		if p.Value <= 0 {
			return nil, 0, ErrBadValue
		}
		weights[i] = p.Value
		sum += p.Value
	}
	return weights, sum, nil
}

// allocate splits total proportionally to weights using the largest remainder
// method: everyone gets the floor of their exact share, then the leftover
// minor units go one each to those with the biggest fractional remainders
// (ties go to the earlier participant, so results are deterministic).
func allocate(total int64, in []Input, weights []int64) []Share {
	var wsum int64
	for _, w := range weights {
		wsum += w
	}
	out := make([]Share, len(in))
	rem := make([]int64, len(in)) // remainder numerators, all over wsum
	var given int64
	for i, p := range in {
		// total*w can't overflow for realistic amounts (total < ~9e12 minor units
		// with weights <= 10000); callers cap total well below that.
		q := total * weights[i] / wsum
		out[i] = Share{UserID: p.UserID, Amount: q}
		rem[i] = total * weights[i] % wsum
		given += q
	}
	left := total - given
	order := make([]int, len(in))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool { return rem[order[a]] > rem[order[b]] })
	for k := int64(0); k < left; k++ {
		out[order[k]].Amount++
	}
	return out
}
