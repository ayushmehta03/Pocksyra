package auth

import "testing"

func TestNormalizeUPI(t *testing.T) {
	valid := []struct{ in, want string }{
		{"ayush@okhdfcbank", "ayush@okhdfcbank"},
		{"  Ayush.M@YBL  ", "ayush.m@ybl"},
		{"9876543210@paytm", "9876543210@paytm"},
		{"first_last-1@oksbi", "first_last-1@oksbi"},
		{"", ""},
		{"   ", ""},
	}
	for _, c := range valid {
		got, err := NormalizeUPI(c.in)
		if err != nil || got != c.want {
			t.Errorf("NormalizeUPI(%q) = %q, %v; want %q", c.in, got, err, c.want)
		}
	}

	invalid := []string{"ayush", "@ybl", "a@ybl", "ayush@", "ayush@1bank", "ayush @ybl", "ay ush@ybl", "ayush@yb.l", "a@@ybl", "ayush@ybl@ybl"}
	for _, in := range invalid {
		if got, err := NormalizeUPI(in); err == nil {
			t.Errorf("NormalizeUPI(%q) = %q; want an error", in, got)
		}
	}
}
