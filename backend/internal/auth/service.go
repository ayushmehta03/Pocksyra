package auth

import (
	"context"
	"errors"
	"fmt"
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
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrUsernameTaken      = errors.New("username already taken")
	ErrInvalidUsername    = errors.New("username must be 3-20 chars: a-z, 0-9, underscore")
	ErrInvalidRefresh     = errors.New("invalid refresh token")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidProfile     = errors.New("invalid profile field")
)

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

// dummyHash is verified against when the email is unknown so login timing
// doesn't reveal which emails exist.
var dummyHash, _ = HashPassword("pocksyra-dummy-password")

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

type SignupInput struct {
	Email    string
	Username string
	Name     string
	Password string
}

type Tokens struct {
	Access  string
	Refresh string
}

func (s *Service) Signup(ctx context.Context, in SignupInput) (*models.User, error) {
	email := normalizeEmail(in.Email)
	username := strings.ToLower(strings.TrimSpace(in.Username))
	if !usernameRe.MatchString(username) {
		return nil, ErrInvalidUsername
	}

	hash, err := HashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	u := &models.User{
		Email:           email,
		Username:        username,
		Name:            strings.TrimSpace(in.Name),
		AuthProviders:   []models.AuthProvider{{Provider: models.ProviderPassword}},
		PasswordHash:    hash,
		DefaultCurrency: "INR",
		Timezone:        "Asia/Kolkata",
		CreatedAt:       time.Now().UTC(),
	}

	res, err := s.users.InsertOne(ctx, u)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			if strings.Contains(err.Error(), "username") {
				return nil, ErrUsernameTaken
			}
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	u.ID = res.InsertedID.(bson.ObjectID)
	return u, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (*models.User, error) {
	var u models.User
	err := s.users.FindOne(ctx, bson.M{"email": normalizeEmail(email)}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		_, _ = VerifyPassword(password, dummyHash)
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	// Google-only accounts have no password hash.
	if u.PasswordHash == "" {
		_, _ = VerifyPassword(password, dummyHash)
		return nil, ErrInvalidCredentials
	}
	ok, err := VerifyPassword(password, u.PasswordHash)
	if err != nil || !ok {
		return nil, ErrInvalidCredentials
	}
	return &u, nil
}

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

// NewSession starts a brand-new token family (login/signup).
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
