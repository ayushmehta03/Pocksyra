package auth

import (
	"errors"
	"regexp"
	"strings"
)

// A UPI ID (VPA) is "<handle>@<psp>", for example "ayush.m@okhdfcbank".
// The handle is 2-64 characters of letters, digits, dot, dash or underscore;
// the PSP part is letters and digits and starts with a letter.
var upiRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$`)

var errInvalidUPI = errors.New("upiId must look like name@bank, e.g. ayush@okhdfcbank")

// NormalizeUPI trims and lowercases a UPI ID and checks its shape. An empty
// input is valid and means "remove the saved UPI ID".
func NormalizeUPI(raw string) (string, error) {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return "", nil
	}
	if !upiRe.MatchString(v) {
		return "", errInvalidUPI
	}
	return v, nil
}
