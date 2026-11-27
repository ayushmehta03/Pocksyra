package notify

import (
	"fmt"
	"strings"
)

var symbols = map[string]string{"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "AED": "AED ", "SGD": "S$", "AUD": "A$", "CAD": "C$"}

// Currencies with no minor unit.
var zeroDecimal = map[string]bool{"JPY": true, "KRW": true, "VND": true, "CLP": true, "ISK": true, "UGX": true, "XOF": true, "XAF": true, "PYG": true, "RWF": true}

// Money formats an amount in minor units for a notification, e.g. 25050 INR -> "₹250.50".
func Money(minor int64, currency string) string {
	cur := strings.ToUpper(currency)
	sym, ok := symbols[cur]
	if !ok {
		sym = cur + " "
	}
	neg := ""
	if minor < 0 {
		neg, minor = "-", -minor
	}
	if zeroDecimal[cur] {
		return fmt.Sprintf("%s%s%d", neg, sym, minor)
	}
	return fmt.Sprintf("%s%s%d.%02d", neg, sym, minor/100, minor%100)
}
