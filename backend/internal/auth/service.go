package auth

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/url"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/ayushmehta03/Pocksyra/backend/config"
	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/models"
)

var (
	ErrInvalidRefresh   = errors.New("invalid refresh token")
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidProfile   = errors.New("invalid profile field")
	ErrEmailNotVerified = errors.New("google email is not verified")
)

type Service struct {
	users    *mongo.Collection
	sessions *mongo.Collection
	cfg      config.Config
}

func NewService(db *mongo.Database, cfg config.Config) *Service {
	return &Service{
		users:    db.Collection(database.CollUsers),
		sessions: db.Collection(database.CollSessions),
		cfg:      cfg,
	}
}

type Tokens struct {
	Access  string
	Refresh string
}

// ---------- Google sign-in ----------

// FindOrCreateGoogleUser resolves a verified Google profile to a user:
//  1. already linked to this Google account -> that user
//  2. same email already registered         -> link Google to it (Google verified the email)
//  3. otherwise                             -> create a new user with a generated username
func (s *Service) FindOrCreateGoogleUser(ctx context.Context, p GoogleProfile) (*models.User, error) {
	if !p.EmailVerified {
		return nil, ErrEmailNotVerified
	}
	email := normalizeEmail(p.Email)

	var u models.User
	err := s.users.FindOne(ctx, bson.M{"authProviders": bson.M{"$elemMatch": bson.M{
		"provider": models.ProviderGoogle, "providerId": p.Sub,
	}}}).Decode(&u)
	if err == nil {
		return &u, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	err = s.users.FindOneAndUpdate(ctx, bson.M{"email": email},
		bson.M{"$push": bson.M{"authProviders": models.AuthProvider{Provider: models.ProviderGoogle, ProviderID: p.Sub}}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&u)
	if err == nil {
		return &u, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	name := strings.TrimSpace(p.Name)
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}
	avatar := ""
	if strings.HasPrefix(p.Picture, "https://") {
		avatar = p.Picture
	}

	for attempt := 0; attempt < 6; attempt++ {
		nu := &models.User{
			Email:           email,
			Username:        candidateUsername(email, attempt),
			Name:            name,
			AvatarURL:       avatar,
			AuthProviders:   []models.AuthProvider{{Provider: models.ProviderGoogle, ProviderID: p.Sub}},
			DefaultCurrency: "INR",
			Timezone:        "Asia/Kolkata",
			CreatedAt:       time.Now().UTC(),
		}
		res, err := s.users.InsertOne(ctx, nu)
		if err == nil {
			nu.ID = res.InsertedID.(bson.ObjectID)
			return nu, nil
		}
		if mongo.IsDuplicateKeyError(err) {
			if strings.Contains(err.Error(), "username") {
				continue // taken, try another suffix
			}
			// Email raced with a concurrent sign-in: use the winner.
			if e := s.users.FindOne(ctx, bson.M{"email": email}).Decode(&u); e == nil {
				return &u, nil
			}
		}
		return nil, err
	}
	return nil, errors.New("could not allocate a username")
}

var nonUsernameChars = regexp.MustCompile(`[^a-z0-9_]+`)

// candidateUsername derives a valid username (^[a-z0-9_]{3,20}$) from the
// email's local part. Attempt 0 is the bare name; later attempts add digits.
func candidateUsername(email string, attempt int) string {
	local := email
	if i := strings.IndexByte(email, '@'); i > 0 {
		local = email[:i]
	}
	base := nonUsernameChars.ReplaceAllString(strings.ToLower(local), "")
	if len(base) < 3 {
		base += "user"
	}
	if len(base) > 14 {
		base = base[:14]
	}
	if attempt == 0 {
		return base
	}
	return fmt.Sprintf("%s%04d", base, rand.IntN(10000))
}

// ---------- Sessions ----------

func (s *Service) GetUser(ctx context.Context, id string) (*models.User, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, ErrUserNotFound
	}
	var u models.User
	err = s.users.FindOne(ctx, bson.M{"_id": oid}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrUserNotFound
	}
	return &u, err
}

// NewSession starts a brand-new token family (a fresh sign-in).
func (s *Service) NewSession(ctx context.Context, u *models.User, userAgent string) (Tokens, error) {
	return s.issue(ctx, u.ID, bson.NewObjectID().Hex(), userAgent)
}

func (s *Service) issue(ctx context.Context, userID bson.ObjectID, family, userAgent string) (Tokens, error) {
	access, err := newAccessToken(s.cfg.JWTSecret, userID.Hex(), s.cfg.AccessTTL)
	if err != nil {
		return Tokens{}, err
	}
	refresh, hash, err := newRefreshToken()
	if err != nil {
		return Tokens{}, err
	}
	now := time.Now().UTC()
	_, err = s.sessions.InsertOne(ctx, models.Session{
		UserID:      userID,
		RefreshHash: hash,
		Family:      family,
		UserAgent:   userAgent,
		CreatedAt:   now,
		ExpiresAt:   now.Add(s.cfg.RefreshTTL),
	})
	if err != nil {
		return Tokens{}, err
	}
	return Tokens{Access: access, Refresh: refresh}, nil
}

// Refresh rotates the refresh token. Reusing an already-rotated token revokes
// the entire family (theft/replay detection).
func (s *Service) Refresh(ctx context.Context, refreshToken, userAgent string) (*models.User, Tokens, error) {
	hash := hashToken(refreshToken)

	var old models.Session
	err := s.sessions.FindOneAndUpdate(ctx,
		bson.M{"refreshHash": hash, "used": false, "expiresAt": bson.M{"$gt": time.Now().UTC()}},
		bson.M{"$set": bson.M{"used": true}},
	).Decode(&old)

	if errors.Is(err, mongo.ErrNoDocuments) {
		var replayed models.Session
		if e := s.sessions.FindOne(ctx, bson.M{"refreshHash": hash, "used": true}).Decode(&replayed); e == nil {
			_, _ = s.sessions.DeleteMany(ctx, bson.M{"family": replayed.Family})
		}
		return nil, Tokens{}, ErrInvalidRefresh
	}
	if err != nil {
		return nil, Tokens{}, err
	}

	u, err := s.GetUser(ctx, old.UserID.Hex())
	if err != nil {
		return nil, Tokens{}, ErrInvalidRefresh
	}
	tokens, err := s.issue(ctx, old.UserID, old.Family, userAgent)
	if err != nil {
		return nil, Tokens{}, err
	}
	return u, tokens, nil
}

// Logout revokes the whole token family of this device. Unknown tokens are a no-op.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	var sess models.Session
	err := s.sessions.FindOne(ctx, bson.M{"refreshHash": hashToken(refreshToken)}).Decode(&sess)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = s.sessions.DeleteMany(ctx, bson.M{"family": sess.Family})
	return err
}

func normalizeEmail(e string) string {
	return strings.ToLower(strings.TrimSpace(e))
}

// ---------- Profile ----------

var currencyRe = regexp.MustCompile(`^[A-Z]{3}$`)

// ProfileUpdate holds optional fields; nil means "leave unchanged".
type ProfileUpdate struct {
	Name            *string
	AvatarURL       *string
	DefaultCurrency *string
	Timezone        *string
}

func (s *Service) UpdateProfile(ctx context.Context, id string, in ProfileUpdate) (*models.User, error) {
	oid, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, ErrUserNotFound
	}

	set := bson.M{}
	if in.Name != nil {
		set["name"] = *in.Name
	}
	if in.AvatarURL != nil {
		if *in.AvatarURL != "" {
			u, err := url.Parse(*in.AvatarURL)
			if err != nil || u.Scheme != "https" || u.Host == "" {
				return nil, fmt.Errorf("%w: avatarUrl must be an https URL", ErrInvalidProfile)
			}
		}
		set["avatarUrl"] = *in.AvatarURL
	}
	if in.DefaultCurrency != nil {
		cur := strings.ToUpper(strings.TrimSpace(*in.DefaultCurrency))
		if !currencyRe.MatchString(cur) {
			return nil, fmt.Errorf("%w: defaultCurrency must be a 3-letter code", ErrInvalidProfile)
		}
		set["defaultCurrency"] = cur
	}
	if in.Timezone != nil {
		if _, err := time.LoadLocation(*in.Timezone); err != nil || *in.Timezone == "" {
			return nil, fmt.Errorf("%w: tz must be a valid IANA zone", ErrInvalidProfile)
		}
		set["tz"] = *in.Timezone
	}
	if len(set) == 0 {
		return s.GetUser(ctx, id)
	}

	var u models.User
	err = s.users.FindOneAndUpdate(ctx, bson.M{"_id": oid}, bson.M{"$set": set},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrUserNotFound
	}
	return &u, err
}
