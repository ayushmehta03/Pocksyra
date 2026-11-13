# Pocksyra

Split expenses with friends, without the spreadsheet. Add a bill, choose who shares it, and Pocksyra keeps a running balance with each friend until you settle up.

It is an installable web app (PWA) with a Go API behind it. Receipts are scanned on your own device, and an optional on-device AI helps read messy bills and writes a short, grounded roast of your month. Your receipt images and spending are never sent to an AI service.

## Features

- **Google sign-in** only. No passwords to store.
- **Friends** by email request or a shareable invite link.
- **Expenses** with equal, exact, percentage or share-based splits. Splitting is optional, so personal spending can be tracked too.
- **Balances and settle up.** A running balance per friend, and settlements that reverse out what you owe.
- **Categories** with icons, filters, search and a monthly summary.
- **Receipt scanning** from a photo or PDF, read locally with Tesseract OCR (PDFs use their text layer first). Fields the parser is unsure about are highlighted for a quick check.
- **On-device AI** (WebLLM, WebGPU) that rescues receipts the rules can't read and writes the monthly roast. See [On-device AI](#on-device-ai).
- **PWA.** Installable, with an offline fallback page.

## Tech stack

| Part | What |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Go, Gin, MongoDB driver v2 |
| Database | MongoDB (must be a replica set, for transactions) |
| OCR | Tesseract.js, pdf.js |
| On-device AI | `@mlc-ai/web-llm` (Qwen2.5 0.5B / 1.5B) |

## How it works

- **Money** is stored as integer minor units (paise or cents). Splits use the largest-remainder method, so the parts always add up to the total.
- **Balances** are a ledger of net amounts between each pair of people. It is updated in the same MongoDB transaction as the expense or settlement that caused the change, so it cannot drift. A daily job re-checks the ledger against the expenses.
- **Auth** uses HTTP-only cookies (short-lived access token plus refresh token) and a required `X-Requested-With` header as CSRF protection.
- **Same origin.** The browser only talks to the Next.js server, which forwards `/auth`, `/me` and `/api/*` to the Go API. There is no CORS and cookies stay first-party.
- **Idempotent writes.** Creating an expense or settlement accepts an `Idempotency-Key`, so a retried request does not double-count.

## Project structure

```
backend/
  cmd/server/        entry point
  config/            environment configuration
  database/          Mongo connection, indexes, replica-set check
  models/            data models
  routes/            HTTP routes
  internal/
    auth/            Google OAuth, sessions, rate limiting hooks
    friends/         friend requests and invite links
    expenses/        expenses, balances, settlements, reconcile job
    split/           split calculations
    ledger/          pairwise balance maths
    ratelimit/       per-IP limiter
client/
  app/               pages (login, dashboard, expenses, friends, settle, insights, settings)
  components/        UI components
  lib/
    receipt/         OCR, parsing, PDF text, category guess
    llm/             on-device model engine (runs in a web worker)
    insights/        monthly summary, jokes, claim checker
    ...              API client, money and split helpers, hooks
  public/            service worker and offline page
docker-compose.yml   local MongoDB replica set
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Go (the version in `backend/go.mod`)
- Docker (for MongoDB), or a MongoDB Atlas cluster
- A Google OAuth client ([Google Cloud Console](https://console.cloud.google.com/apis/credentials)) with the redirect URI `http://localhost:3000/auth/google/callback`

### 1. Database

```bash
docker compose up -d
```

This starts MongoDB 7 as a single-node replica set, published on host port **27018**.

### 2. Backend

```bash
cd backend
cp .env.example .env     # then fill in JWT_SECRET and the Google values
go run ./cmd/server      # API on http://localhost:8090  (or: air)
```

### 3. Frontend

```bash
cd client
cp .env.example .env.local
npm install
npm run dev              # app on http://localhost:3000
```

Open http://localhost:3000 and sign in with Google.

## Configuration

### Backend (`backend/.env`)

| Variable | Notes |
|---|---|
| `APP_ENV` | `development` or `production` |
| `PORT` | Listen port. Hosting platforms usually set it for you. |
| `MONGO_URI`, `MONGO_DB` | MongoDB connection. Must be a replica set. |
| `JWT_SECRET` | At least 32 characters. `openssl rand -base64 48` |
| `ACCESS_TTL`, `REFRESH_TTL` | Token lifetimes (default 15m / 720h) |
| `COOKIE_SECURE` | `true` in production (https) |
| `COOKIE_DOMAIN` | Leave empty |
| `TRUSTED_PROXIES` | Comma-separated proxy IPs or CIDRs whose `X-Forwarded-For` is trusted. Leave empty unless you know the proxy addresses. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From Google Cloud |
| `GOOGLE_REDIRECT_URL` | `https://<your-domain>/auth/google/callback` |
| `FRONTEND_URL` | Your public frontend URL |

### Frontend (`client/.env.local`)

| Variable | Notes |
|---|---|
| `API_URL` | Where the Go API lives. Read **at build time** by the Next.js rewrites, so set it before `npm run build`. |

## Scripts

```bash
# client
npm run dev          # development server
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
npm test             # unit tests (parser, OCR maths, PDF lines, AI checks, insights)

# backend
go build ./...
go test ./...
```

## Deployment

The frontend and the API deploy separately.

**1. Database.** Create a MongoDB Atlas cluster (replica set by default) and allow your host's network access. The API refuses to start against a standalone MongoDB.

**2. API (for example on Railway or Render).**

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `go build -o server ./cmd/server` |
| Start command | `./server` |
| Health check | `/health` |

Set the backend environment variables above (`APP_ENV=production`, `COOKIE_SECURE=true`, and so on) and generate a public domain.

**3. Frontend (for example on Vercel).** Set the root directory to `client`, add `API_URL=https://<your-api-domain>` (no trailing slash), and deploy.

**4. Connect them.** Set `FRONTEND_URL` and `GOOGLE_REDIRECT_URL` on the API to your frontend URL, and add the redirect URL and the frontend origin in your Google OAuth client.

Serve everything over https. The service worker, installing the app and secure cookies all need it.

## PWA

- Manifest at `/manifest.webmanifest`, with 192, 512 and maskable icons generated at build time.
- A small service worker caches the app shell and static files and shows an offline page when there is no connection. It never caches `/auth`, `/api` or `/me`.
- It is registered only in production builds.

## On-device AI

The AI runs entirely in the browser with WebGPU (Chrome or Edge on a recent computer, and some recent phones). On first use it downloads a model once (about 400 MB on low-memory devices, about 1.1 GB otherwise) and then works offline.

- **Receipts:** if the rules can't find a total, merchant or date, the model tries. Any value it returns is kept only if it actually appears in the OCR text.
- **Monthly roast:** all numbers are computed by plain code first. The model only words short jokes about those facts, and each joke is checked against them. A joke that uses a number, merchant, day or claim that isn't in your data is replaced by a hand-written one.
- Without WebGPU, everything still works. You just get the plain versions.

Add `?model=lite` or `?model=full` to a page URL to force the smaller or larger model while testing.

## Privacy

- Receipt files are read on your device and are not uploaded.
- The AI model runs on your device. Your spending data is not sent to any AI service.
- Only expense, friend and balance data you enter is stored, in your own MongoDB.

## Status and limitations

- Totals and the roast cover one currency at a time (the most common one in the period).
- The summary and filters on the expenses page work on the expenses already loaded. Use "Load more" for older ones.
- Offline use covers the app shell and the offline page, not live data.
