package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

const ProviderGoogle = "google"

type AuthProvider struct {
	Provider   string `bson:"provider"`
	ProviderID string `bson:"providerId,omitempty"`
}

// User is the `users` collection document.
type User struct {
	ID              bson.ObjectID  `bson:"_id,omitempty"`
	Email           string         `bson:"email"`
	Username        string         `bson:"username"`
	Name            string         `bson:"name"`
	AvatarURL       string         `bson:"avatarUrl,omitempty"`
	AuthProviders   []AuthProvider `bson:"authProviders"`
	DefaultCurrency string         `bson:"defaultCurrency"`
	Timezone        string         `bson:"tz"`
	CreatedAt       time.Time      `bson:"createdAt"`
}

// PublicUser is what the API returns. It never contains the password hash.
type PublicUser struct {
	ID              string    `json:"id"`
	Email           string    `json:"email"`
	Username        string    `json:"username"`
	Name            string    `json:"name"`
	AvatarURL       string    `json:"avatarUrl,omitempty"`
	DefaultCurrency string    `json:"defaultCurrency"`
	Timezone        string    `json:"tz"`
	CreatedAt       time.Time `json:"createdAt"`
}

func (u *User) Public() PublicUser {
	return PublicUser{
		ID:              u.ID.Hex(),
		Email:           u.Email,
		Username:        u.Username,
		Name:            u.Name,
		AvatarURL:       u.AvatarURL,
		DefaultCurrency: u.DefaultCurrency,
		Timezone:        u.Timezone,
		CreatedAt:       u.CreatedAt,
	}
}
