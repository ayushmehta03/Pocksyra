package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"github.com/ayushmehta03/Pocksyra/backend/config"
)

const (
	flowCookie  = "oauth_flow" // "<state>.<pkce verifier>", short-lived, HttpOnly
	userinfoURL = "https://openidconnect.googleapis.com/v1/userinfo"
)

// GoogleProfile is the subset of Google's userinfo response we use.
type GoogleProfile struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func newOAuthConfig(cfg config.Config) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

// GoogleStart begins the authorization-code + PKCE flow.
func (h *Handler) GoogleStart(c *gin.Context) {
	state, err := randomToken(24)
	if err != nil {
		serverError(c, err)
		return
	}
	verifier := oauth2.GenerateVerifier()

	c.SetSameSite(http.SameSiteLaxMode) // Lax: sent on the top-level redirect back from Google
	c.SetCookie(flowCookie, state+"."+verifier, 600, "/auth", h.cfg.CookieDomain, h.cfg.CookieSecure, true)

	authURL := h.oauth.AuthCodeURL(state,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)
	c.Redirect(http.StatusFound, authURL)
}

// GoogleCallback finishes the flow, creates the session and sends the browser to the app.
func (h *Handler) GoogleCallback(c *gin.Context) {
	flow, err := c.Cookie(flowCookie)
	h.clearFlowCookie(c)
	parts := strings.SplitN(flow, ".", 2)
	if err != nil || len(parts) != 2 {
		h.loginRedirect(c, "oauth_failed")
		return
	}
	state, verifier := parts[0], parts[1]

	if subtle.ConstantTimeCompare([]byte(state), []byte(c.Query("state"))) != 1 {
		h.loginRedirect(c, "oauth_failed")
		return
	}
	if c.Query("error") != "" {
		h.loginRedirect(c, "access_denied") // user cancelled / declined
		return
	}
	code := c.Query("code")
	if code == "" {
		h.loginRedirect(c, "oauth_failed")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()
	ctx = context.WithValue(ctx, oauth2.HTTPClient, &http.Client{Timeout: 10 * time.Second})

	tok, err := h.oauth.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		_ = c.Error(err)
		h.loginRedirect(c, "oauth_failed")
		return
	}

	profile, err := fetchProfile(ctx, h.oauth, tok)
	if err != nil {
		_ = c.Error(err)
		h.loginRedirect(c, "oauth_failed")
		return
	}

	user, err := h.svc.FindOrCreateGoogleUser(ctx, profile)
	if errors.Is(err, ErrEmailNotVerified) {
		h.loginRedirect(c, "email_unverified")
		return
	}
	if err != nil {
		_ = c.Error(err)
		h.loginRedirect(c, "oauth_failed")
		return
	}

	tokens, err := h.svc.NewSession(ctx, user, c.Request.UserAgent())
	if err != nil {
		_ = c.Error(err)
		h.loginRedirect(c, "oauth_failed")
		return
	}
	h.setAuthCookies(c, tokens)
	c.Redirect(http.StatusFound, h.cfg.FrontendURL+"/dashboard")
}

func fetchProfile(ctx context.Context, conf *oauth2.Config, tok *oauth2.Token) (GoogleProfile, error) {
	var p GoogleProfile
	resp, err := conf.Client(ctx, tok).Get(userinfoURL)
	if err != nil {
		return p, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return p, errors.New("google userinfo returned " + resp.Status)
	}
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return p, err
	}
	if p.Sub == "" || p.Email == "" {
		return p, errors.New("google profile missing sub or email")
	}
	return p, nil
}

func (h *Handler) loginRedirect(c *gin.Context, code string) {
	c.Redirect(http.StatusFound, h.cfg.FrontendURL+"/login?error="+url.QueryEscape(code))
}

func (h *Handler) clearFlowCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(flowCookie, "", -1, "/auth", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
