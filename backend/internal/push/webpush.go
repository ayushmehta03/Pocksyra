// Package push sends Web Push notifications (RFC 8030) with VAPID (RFC 8292)
// and aes128gcm payload encryption (RFC 8291), using only the standard library
// and golang-jwt.
package push

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	recordSize = 4096
	// Push services accept about 4 KB per message; ours are a sentence or two.
	maxPayload = 3000
)

func hmacSHA256(key, msg []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(msg)
	return m.Sum(nil)
}

func decodeB64(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(strings.TrimRight(strings.TrimSpace(s), "="))
}

// encryptPayload builds the encrypted request body for one subscription
// (RFC 8291 section 3). The key pair and salt are parameters so the result can
// be checked against a fixed example.
func encryptPayload(plaintext, uaPublic, authSecret []byte, asPrivate *ecdh.PrivateKey, salt []byte) ([]byte, error) {
	if len(plaintext) > maxPayload {
		return nil, errors.New("push payload is too large")
	}
	uaKey, err := ecdh.P256().NewPublicKey(uaPublic)
	if err != nil {
		return nil, fmt.Errorf("bad subscription key: %w", err)
	}
	secret, err := asPrivate.ECDH(uaKey)
	if err != nil {
		return nil, err
	}
	asPublic := asPrivate.PublicKey().Bytes()

	prkKey := hmacSHA256(authSecret, secret)

	keyInfo := make([]byte, 0, 14+len(uaPublic)+len(asPublic)+1)
	keyInfo = append(keyInfo, "WebPush: info\x00"...)
	keyInfo = append(keyInfo, uaPublic...)
	keyInfo = append(keyInfo, asPublic...)
	keyInfo = append(keyInfo, 0x01)
	ikm := hmacSHA256(prkKey, keyInfo)

	prk := hmacSHA256(salt, ikm)
	cek := hmacSHA256(prk, []byte("Content-Encoding: aes128gcm\x00\x01"))[:16]
	nonce := hmacSHA256(prk, []byte("Content-Encoding: nonce\x00\x01"))[:12]

	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	padded := make([]byte, 0, len(plaintext)+1)
	padded = append(padded, plaintext...)
	padded = append(padded, 0x02) // delimiter marking the last (and only) record
	sealed := gcm.Seal(nil, nonce, padded, nil)

	out := make([]byte, 0, len(salt)+4+1+len(asPublic)+len(sealed))
	out = append(out, salt...)
	out = binary.BigEndian.AppendUint32(out, recordSize)
	out = append(out, byte(len(asPublic)))
	out = append(out, asPublic...)
	out = append(out, sealed...)
	return out, nil
}

// encrypt uses a fresh sender key and salt for every message.
func encrypt(plaintext, uaPublic, authSecret []byte) ([]byte, error) {
	asPrivate, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}
	return encryptPayload(plaintext, uaPublic, authSecret, asPrivate, salt)
}

// vapid holds the server's signing key (RFC 8292).
type vapid struct {
	key     *ecdsa.PrivateKey
	public  string // base64url, uncompressed point; what browsers call applicationServerKey
	subject string
}

func newVAPID(privateB64, subject string) (*vapid, error) {
	d, err := decodeB64(privateB64)
	if err != nil || len(d) != 32 {
		return nil, errors.New("VAPID_PRIVATE_KEY must be a base64url-encoded 32-byte key (generate one with: go run ./cmd/vapidgen)")
	}
	k, err := ecdh.P256().NewPrivateKey(d)
	if err != nil {
		return nil, fmt.Errorf("VAPID_PRIVATE_KEY is not a valid P-256 key: %w", err)
	}
	raw := k.PublicKey().Bytes() // 0x04 || X || Y
	key := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(raw[1:33]),
			Y:     new(big.Int).SetBytes(raw[33:65]),
		},
		D: new(big.Int).SetBytes(d),
	}
	return &vapid{key: key, public: base64.RawURLEncoding.EncodeToString(raw), subject: subject}, nil
}

// authHeader returns the Authorization header for a push to this endpoint.
func (v *vapid) authHeader(endpoint string, now time.Time) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" {
		return "", errors.New("bad push endpoint")
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"aud": u.Scheme + "://" + u.Host,
		"exp": now.Add(12 * time.Hour).Unix(),
		"sub": v.subject,
	})
	signed, err := tok.SignedString(v.key)
	if err != nil {
		return "", err
	}
	return "vapid t=" + signed + ", k=" + v.public, nil
}

// Subscription is what the browser gives us when someone turns notifications on.
type Subscription struct {
	Endpoint string
	P256dh   string // base64url
	Auth     string // base64url
}

// Sender delivers messages to push services.
type Sender struct {
	v      *vapid
	client *http.Client
}

func NewSender(privateB64, subject string) (*Sender, error) {
	v, err := newVAPID(privateB64, subject)
	if err != nil {
		return nil, err
	}
	return &Sender{
		v: v,
		client: &http.Client{
			Timeout: 10 * time.Second,
			// A push service answering with a redirect is not something to follow blindly.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}, nil
}

// PublicKey is the value the browser needs to subscribe (applicationServerKey).
func (s *Sender) PublicKey() string { return s.v.public }

// Send encrypts and delivers one message. gone is true when the push service
// says the subscription no longer exists, so the caller should forget it.
func (s *Sender) Send(ctx context.Context, sub Subscription, payload []byte) (gone bool, err error) {
	uaPublic, err := decodeB64(sub.P256dh)
	if err != nil {
		return false, fmt.Errorf("bad p256dh: %w", err)
	}
	authSecret, err := decodeB64(sub.Auth)
	if err != nil {
		return false, fmt.Errorf("bad auth secret: %w", err)
	}
	body, err := encrypt(payload, uaPublic, authSecret)
	if err != nil {
		return false, err
	}
	authz, err := s.v.authHeader(sub.Endpoint, time.Now())
	if err != nil {
		return false, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", authz)
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("TTL", "86400")
	req.Header.Set("Urgency", "normal")

	resp, err := s.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))

	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return false, nil
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return true, fmt.Errorf("push service says the subscription is gone (%d)", resp.StatusCode)
	default:
		return false, fmt.Errorf("push service answered %d", resp.StatusCode)
	}
}

// Subscriptions are only accepted for the well-known browser push services,
// so the server can't be pointed at an arbitrary address.
var pushHosts = []string{"fcm.googleapis.com", ".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"}

func endpointAllowed(raw string) bool {
	if len(raw) > 1000 {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return false
	}
	if p := u.Port(); p != "" && p != "443" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, h := range pushHosts {
		if strings.HasPrefix(h, ".") {
			if strings.HasSuffix(host, h) {
				return true
			}
		} else if host == h {
			return true
		}
	}
	return false
}
