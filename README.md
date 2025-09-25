# Translation Quote Platform (Milestone A)

This repo includes Netlify Functions, Supabase schema, and configuration for the 5-step translation quote flow. UI wiring to Next.js/Builder is deferred to a follow-up.

## Stack
- UI: Next.js (App Router) + Builder.io pages/sections (to be added)
- APIs: Netlify Functions (see `netlify/functions/*`)
- DB/Storage: Supabase (Postgres + Storage bucket `orders` private)
- Payments: Stripe (Apple Pay / Google Pay via Checkout)
- Automation: n8n (OCR, LLM, pricing – not in app)
- Embed: WordPress modal launcher + iframe; CORS allow-list includes `cethos.com`

## Local Setup
1. npm i
2. Copy `.env.example` to `.env` and fill values.
3. Create database schema in Supabase: run `database/schema.sql`.
4. Create Supabase Storage bucket: `orders` (private).
5. For dev, this repo serves static files with Express; API routes run on Netlify after deploy. Use Netlify CLI for local function testing if needed.

## Environment Variables
See `.env.example`. Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, N8N_WEBHOOK_URL, BASE_URL. Stripe/Brevo/Twilio optional until enabling features.

## API Routes
- POST /api/quote/create → returns `{quote_id}` (no DB insert; DB insert happens on submit)
- POST /api/upload/sign → returns signed URL + headers to upload directly to Supabase Storage at `orders/{quote_id}/{file_id}-{filename}`
- POST /api/quote/submit → validates, inserts into `customers`, `quote_submissions`, `quote_files`, posts `{quote_id}` to `N8N_WEBHOOK_URL`
- GET  /api/quote/status/:id → `{stage}`: ocr|analysis|pricing|ready|hitl|failed (derived from `quote_submissions.status`)
- GET  /api/delivery/options?quote_id=... → list of delivery choices with availability, reason, fee, eta_date
- POST /api/quote/update-delivery → sets `delivery_option_id` and `delivery_eta_date`
- POST /api/quote/email-link → sends permalink via Brevo
- POST /api/quote/request-hitl → sets `hitl_requested=true`, notifies n8n
- POST /api/checkout/session → creates Stripe Checkout session; returns URL
- POST /api/webhooks/stripe → verifies signature; on success marks paid and inserts `payments`

## Data Model
Implemented exactly as specified in `database/schema.sql`.

## WordPress Embed
- Include a button that opens a modal with an iframe pointing to your hosted app URL.
- Allow CORS for `https://cethos.com` (handled by functions CORS helper).

## Notes
- File accept: .pdf, .jpg, .jpeg, .png, .doc, .docx, .xls, .xlsx. Per-file size guard 10 MB (also server-side via `MAX_UPLOAD_MB`).
- No OCR/LLM/pricing logic is in this code. n8n handles all processing and writes `quote_results` + sets `quote_submissions.status`.
- Delivery ETA excludes weekends. Same-day requires single-page and active qualifier and cutoff rules.
- All display strings should be centralized in UI layer (to be added).

## Deploy on Netlify
- Push to a repo, connect in Netlify.
- Ensure environment variables are set in Netlify dashboard.
- Functions path: `netlify/functions`, redirects configured in `netlify.toml`.

## Troubleshooting
- 401/403 uploading to storage → ensure `orders` bucket exists and signed upload URL is used with returned headers.
- Webhook signature errors → verify `STRIPE_WEBHOOK_SECRET` and send raw body.
- Same-day not showing → verify `same_day_qualifiers` and cutoff env/timezone.
