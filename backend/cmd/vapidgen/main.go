// Command vapidgen prints a new VAPID key for web push. Run it once and put
// the private key in the VAPID_PRIVATE_KEY environment variable:
//
//	go run ./cmd/vapidgen
package main

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
)

func main() {
	k, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	enc := base64.RawURLEncoding
	fmt.Println("VAPID_PRIVATE_KEY=" + enc.EncodeToString(k.Bytes()))
	fmt.Println("# public key (the app fetches it from the API, you don't need to set it):")
	fmt.Println("# " + enc.EncodeToString(k.PublicKey().Bytes()))
}
