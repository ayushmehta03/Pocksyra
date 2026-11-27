package notify

import "testing"

func TestMoney(t *testing.T) {
	cases := []struct {
		minor    int64
		currency string
		want     string
	}{
		{25050, "INR", "₹250.50"},
		{5, "INR", "₹0.05"},
		{100000, "usd", "$1000.00"},
		{1500, "JPY", "JPY 1500"},
		{1234, "CHF", "CHF 12.34"},
		{-250, "INR", "-₹2.50"},
	}
	for _, c := range cases {
		if got := Money(c.minor, c.currency); got != c.want {
			t.Errorf("Money(%d, %q) = %q, want %q", c.minor, c.currency, got, c.want)
		}
	}
}
