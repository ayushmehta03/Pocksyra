package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
)

type Deps struct {
	Auth *auth.Handler
}

func Setup(r *gin.Engine, d Deps) {
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := r.Group("/", auth.RequireCustomHeader())

	ag := api.Group("/auth")
	{
		ag.POST("/signup", d.Auth.Signup)
		ag.POST("/login", d.Auth.Login)
		ag.POST("/refresh", d.Auth.Refresh)
		ag.POST("/logout", d.Auth.Logout)
	}

	protected := api.Group("/", d.Auth.RequireAuth())
	{
		protected.GET("/me", d.Auth.Me)
	}
}
