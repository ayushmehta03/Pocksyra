# Pocksyra

Split expenses with friends, without the spreadsheet. Add a bill, choose who shares it, and Pocksyra keeps a running balance with each friend until you settle up.

An installable web app (PWA) with a Go API. Receipts are scanned on your own device, and an optional on-device AI helps read messy bills and writes a short roast of your month. Your receipts and spending are never sent to an AI service.

## Features

- **Google sign-in** only, so there are no passwords to store.
- **Friends** by email request or a shareable invite link.
- **Expenses** with equal, exact, percentage or share-based splits, plus categories, filters, search and a monthly summary.
- **Balances and settle up** with a running balance per friend.
- **Pay with UPI.** Add your UPI ID, and when you owe a friend in INR the app opens your UPI app with the amount filled in (a chooser on Android, Google Pay / PhonePe / Paytm buttons on iPhone, and a QR code to scan on a computer). A payment waits for the friend to confirm it before the balance changes.
- **Notifications.** An in-app bell and inbox, plus optional web push alerts on your device for friend requests, shared expenses and payments. Each kind can be switched off, and a weekly reminder nudges you about balances you owe that haven't moved.
- **Receipt scanning** from a photo or PDF, read locally with OCR.
- **On-device AI** that rescues receipts the rules can't read and writes a grounded monthly roast.
- **PWA** that is installable and has an offline fallback page.

## Tech stack

| Part | What |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Go, Gin |
| Database | MongoDB (replica set, for transactions) |
| Auth | Google OAuth 2.0, JWT in HTTP-only cookies |
| Push | Web Push with VAPID (implemented in Go, no third-party service) |
| OCR | Tesseract.js, pdf.js |
| On-device AI | WebLLM (Qwen2.5 0.5B / 1.5B) |
| Hosting | Vercel (frontend), Railway (API), MongoDB Atlas |