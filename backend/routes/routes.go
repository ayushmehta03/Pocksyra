package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
	"github.com/ayushmehta03/Pocksyra/backend/internal/expenses"
	"github.com/ayushmehta03/Pocksyra/backend/internal/friends"
	"github.com/ayushmehta03/Pocksyra/backend/internal/notify"
	"github.com/ayushmehta03/Pocksyra/backend/internal/profiles"
	"github.com/ayushmehta03/Pocksyra/backend/internal/push"
)

type Deps struct {
	Auth     *auth.Handler
	Friends  *friends.Handler
	Expenses *expenses.Handler
	Notify   *notify.Handler
	Push     *push.Handler
	Profiles *profiles.Handler
}

func Setup(r *gin.Engine, d Deps) {
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := r.Group("/", auth.RequireCustomHeader())

	ag := api.Group("/auth")
	{
		ag.GET("/google", d.Auth.LimitByIP(), d.Auth.GoogleStart)
		ag.GET("/google/callback", d.Auth.LimitByIP(), d.Auth.GoogleCallback)
		ag.POST("/refresh", d.Auth.Refresh)
		ag.POST("/logout", d.Auth.Logout)
	}

	protected := api.Group("/", d.Auth.RequireAuth())
	{
		protected.GET("/me", d.Auth.Me)
		protected.PATCH("/me", d.Auth.UpdateMe)

		protected.GET("/friends", d.Friends.List)
		protected.GET("/friends/suggestions", d.Profiles.Suggestions)
		protected.GET("/profiles/:id", d.Profiles.Get)
		protected.POST("/friends/requests", d.Friends.SendRequest)
		protected.POST("/friends/requests/:id/accept", d.Friends.Accept)
		protected.POST("/friends/requests/:id/decline", d.Friends.Decline)
		protected.DELETE("/friends/:id", d.Friends.Remove)

		protected.POST("/invites", d.Friends.CreateInvite)
		protected.GET("/invites/:token", d.Friends.PreviewInvite)
		protected.POST("/invites/:token/accept", d.Friends.AcceptInvite)

		protected.GET("/expenses", d.Expenses.List)
		protected.POST("/expenses", d.Expenses.Create)
		protected.GET("/expenses/:id", d.Expenses.Get)
		protected.PATCH("/expenses/:id", d.Expenses.Update)
		protected.DELETE("/expenses/:id", d.Expenses.Delete)

		protected.GET("/balances", d.Expenses.Balances)
		protected.GET("/settlements", d.Expenses.ListSettlements)
		protected.POST("/settlements", d.Expenses.CreateSettlement)
		protected.POST("/settlements/:id/confirm", d.Expenses.ConfirmSettlement)
		protected.POST("/settlements/:id/decline", d.Expenses.DeclineSettlement)
		protected.POST("/settlements/:id/cancel", d.Expenses.CancelSettlement)

		protected.GET("/notifications", d.Notify.List)
		protected.GET("/notifications/unread", d.Notify.Unread)
		protected.PATCH("/notifications", d.Notify.MarkAllRead)
		protected.POST("/notifications/:id/read", d.Notify.MarkRead)
		protected.GET("/notifications/preferences", d.Notify.GetPreferences)
		protected.PUT("/notifications/preferences", d.Notify.SetPreferences)

		protected.GET("/push/key", d.Push.Key)
		protected.POST("/push/subscribe", d.Push.Subscribe)
		protected.POST("/push/unsubscribe", d.Push.Unsubscribe)
	}
}
