package push

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func b64(t *testing.T, s string) []byte {
	t.Helper()
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// Fixed throwaway inputs (not secrets) and the output of an independent
// implementation of RFC 8291 written in Python with the cryptography package.
const (
	vecUAPrivate = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA"
	vecUAPublic  = "BFFcPW6545a5BNP-yn9U_c0MwemXvzddylFa0KbDtANfRTa-OlDzGPv5pUdZAqIhUCvvDVfgjFOyzApW8X2fk1Q"
	vecASPrivate = "ZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5_gIGCg4Q"
	vecSalt      = "ycrLzM3Oz9DR0tPU1dbX2A"
	vecAuth      = "HyAhIiMkJSYnKCkqKywtLg"
	vecPlaintext = `{"title":"Pocksyra","body":"Ravi sent you a friend request","link":"/dashboard/friends"}`
	vecOutput    = "ycrLzM3Oz9DR0tPU1dbX2AAAEABBBCVO5tG60cdM4v0orFKaFmr0lQoOPaC8U9lr9A3OOOvn31k38R6GnUU3KaIi9j5wnQdAuXVE4UFrHlpAGzhfuVCRUQd-kcDDu-Wv0n6MJcEcfJpJVUqKIJGdXydjlRTPq3PtFrUU7Xhc0GhE_QUnT3ZE8V7xmzV_UnmkY_RMbFrI9yzT_1FiGILB3DjbIlLreFRsdbXTwjY-G7CUk6eXZDvSBMgYPoOFRlI"
)

func TestEncryptPayloadKnownAnswer(t *testing.T) {
	asPrivate, err := ecdh.P256().NewPrivateKey(b64(t, vecASPrivate))
	if err != nil {
		t.Fatal(err)
	}
	got, err := encryptPayload([]byte(vecPlaintext), b64(t, vecUAPublic), b64(t, vecAuth), asPrivate, b64(t, vecSalt))
	if err != nil {
		t.Fatal(err)
	}
	if enc := base64.RawURLEncoding.EncodeToString(got); enc != vecOutput {
		t.Fatalf("encrypted body differs from the reference\n got: %s\nwant: %s", enc, vecOutput)
	}
}

// decrypt is the receiving side (the browser): it only knows its own private
// key and auth secret and reads the sender's public key from the header.
func decrypt(t *testing.T, body, uaPrivateRaw, authSecret []byte) []byte {
	t.Helper()
	salt := body[:16]
	if rs := binary.BigEndian.Uint32(body[16:20]); rs != recordSize {
		t.Fatalf("record size %d", rs)
	}
	idLen := int(body[20])
	asPublic := body[21 : 21+idLen]
	ciphertext := body[21+idLen:]

	uaPrivate, err := ecdh.P256().NewPrivateKey(uaPrivateRaw)
	if err != nil {
		t.Fatal(err)
	}
	asKey, err := ecdh.P256().NewPublicKey(asPublic)
	if err != nil {
		t.Fatal(err)
	}
	secret, err := uaPrivate.ECDH(asKey)
	if err != nil {
		t.Fatal(err)
	}
	uaPublic := uaPrivate.PublicKey().Bytes()

	keyInfo := append([]byte("WebPush: info\x00"), uaPublic...)
	keyInfo = append(keyInfo, asPublic...)
	keyInfo = append(keyInfo, 0x01)
	ikm := hmacSHA256(hmacSHA256(authSecret, secret), keyInfo)
	prk := hmacSHA256(salt, ikm)
	cek := hmacSHA256(prk, []byte("Content-Encoding: aes128gcm\x00\x01"))[:16]
	nonce := hmacSHA256(prk, []byte("Content-Encoding: nonce\x00\x01"))[:12]

	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	padded, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		t.Fatalf("browser could not decrypt: %v", err)
	}
	if padded[len(padded)-1] != 0x02 {
		t.Fatalf("missing last-record delimiter")
	}
	return padded[:len(padded)-1]
}

func TestEncryptRoundTrip(t *testing.T) {
	uaPrivate, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	authSecret := make([]byte, 16)
	if _, err := rand.Read(authSecret); err != nil {
		t.Fatal(err)
	}
	msg := []byte(`{"title":"Pocksyra","body":"hello ₹250.00"}`)

	body, err := encrypt(msg, uaPrivate.PublicKey().Bytes(), authSecret)
	if err != nil {
		t.Fatal(err)
	}
	if got := decrypt(t, body, uaPrivate.Bytes(), authSecret); string(got) != string(msg) {
		t.Fatalf("round trip gave %q", got)
	}
}

func TestEncryptRejectsBadInput(t *testing.T) {
	uaPrivate, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	if _, err := encrypt(make([]byte, maxPayload+1), uaPrivate.PublicKey().Bytes(), auth); err == nil {
		t.Error("an oversized payload should be rejected")
	}
	if _, err := encrypt([]byte("x"), []byte("not a key"), auth); err == nil {
		t.Error("a malformed subscription key should be rejected")
	}
}

func TestVAPIDHeader(t *testing.T) {
	k, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	v, err := newVAPID(base64.RawURLEncoding.EncodeToString(k.Bytes()), "https://example.com")
	if err != nil {
		t.Fatal(err)
	}
	if v.public != base64.RawURLEncoding.EncodeToString(k.PublicKey().Bytes()) {
		t.Fatal("public key does not match the private key")
	}

	header, err := v.authHeader("https://fcm.googleapis.com/fcm/send/abc", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	rest, ok := strings.CutPrefix(header, "vapid t=")
	if !ok {
		t.Fatalf("unexpected header %q", header)
	}
	token, key, ok := strings.Cut(rest, ", k=")
	if !ok || key != v.public {
		t.Fatalf("header must carry the public key, got %q", header)
	}

	parsed, err := jwt.Parse(token, func(*jwt.Token) (any, error) { return &v.key.PublicKey, nil }, jwt.WithValidMethods([]string{"ES256"}))
	if err != nil || !parsed.Valid {
		t.Fatalf("token does not verify: %v", err)
	}
	claims := parsed.Claims.(jwt.MapClaims)
	if claims["aud"] != "https://fcm.googleapis.com" || claims["sub"] != "https://example.com" {
		t.Errorf("unexpected claims %v", claims)
	}
}

func TestNewVAPIDRejectsBadKeys(t *testing.T) {
	for _, bad := range []string{"", "not-base64!!", "AAAA"} {
		if _, err := newVAPID(bad, "https://example.com"); err == nil {
			t.Errorf("key %q should be rejected", bad)
		}
	}
}

func TestEndpointAllowed(t *testing.T) {
	ok := []string{
		"https://fcm.googleapis.com/fcm/send/abc",
		"https://updates.push.services.mozilla.com/wpush/v2/abc",
		"https://web.push.apple.com/abc",
		"https://par02p.notify.windows.com/w/?token=abc",
	}
	bad := []string{
		"http://fcm.googleapis.com/fcm/send/abc",
		"https://evil.example.com/x",
		"https://fcm.googleapis.com.evil.com/x",
		"https://169.254.169.254/latest/meta-data",
		"https://localhost/x",
		"https://user@fcm.googleapis.com/x",
		"https://fcm.googleapis.com:8443/x",
		"",
	}
	for _, u := range ok {
		if !endpointAllowed(u) {
			t.Errorf("%s should be allowed", u)
		}
	}
	for _, u := range bad {
		if endpointAllowed(u) {
			t.Errorf("%s should be rejected", u)
		}
	}
}
