package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // embed tz database so tz validation works in slim containers

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/ayushmehta03/Pocksyra/backend/config"
	"github.com/ayushmehta03/Pocksyra/backend/database"
	"github.com/ayushmehta03/Pocksyra/backend/internal/auth"
	"github.com/ayushmehta03/Pocksyra/backend/routes"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	_ = godotenv.Load() // optional .env for local dev
	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, err := database.Connect(ctx, cfg.MongoURI)
	if err != nil {
		log.Error("mongo connect", "err", err)
		os.Exit(1)
	}
	defer client.Disconnect(context.Background())

	db := client.Database(cfg.MongoDB)
	if err := database.EnsureIndexes(ctx, db); err != nil {
		log.Error("ensure indexes", "err", err)
		os.Exit(1)
	}

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Error("trusted proxies", "err", err)
		os.Exit(1)
	}
	r.Use(gin.Logger(), gin.Recovery())

	authSvc := auth.NewService(db, cfg)
	routes.Setup(r, routes.Deps{Auth: auth.NewHandler(authSvc, cfg)})

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Info("api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
