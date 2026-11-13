# Pocksyra

Split expenses with friends. Next.js 15 PWA (`client/`) + Go/Gin API (`backend/`) + MongoDB.

Receipts are scanned on the device (Tesseract OCR, PDF text), and an optional on-device model
(WebLLM, WebGPU) fills in what the rules miss and writes the monthly roast. Nothing about a receipt
or your spending is sent to a server for that.

## Run locally

```bash
docker compose up -d                      # MongoDB as a single-node replica set on :27018
cd backend && cp .env.example .env        # set JWT_SECRET and the Google OAuth values
go run ./cmd/server                       # API on :8090   (or: air)
cd ../client && cp .env.example .env.local
npm install && npm run dev                # app on :3000
```

Checks: `cd backend && go build ./... && go test ./...` and `cd client && npm run typecheck && npm test`.

## Deploying

- **MongoDB** must be a replica set (Atlas works). The API refuses to start otherwise.
- **API**: set `APP_ENV=production`, `COOKIE_SECURE=true`, a 32+ character `JWT_SECRET`, `MONGO_URI`,
  `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URL` (your https domain) and `FRONTEND_URL`.
  Set `TRUSTED_PROXIES` to your proxy's address if one sits in front.
- **Client**: `API_URL` (the Go API) is read at **build** time, so set it before `npm run build`.
  The browser only talks to the Next.js origin, which forwards `/auth`, `/me` and `/api` to Go.
- Serve everything over **https**: the service worker, install prompt and secure cookies need it.
