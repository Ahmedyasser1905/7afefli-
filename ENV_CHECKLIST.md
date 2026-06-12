# Environment Variables Checklist — BarberDZ / 7afefli
# Updated: 2026-06-12 | Production-ready patch

## Backend (Railway)

| Variable                    | Required       | Description                                                       |
|-----------------------------|----------------|-------------------------------------------------------------------|
| SUPABASE_URL                | ✅ YES         | URL of the Supabase project                                       |
| SUPABASE_SERVICE_ROLE_KEY   | ✅ YES         | Service role key (bypasses RLS)                                   |
| SUPABASE_ANON_KEY           | ✅ YES         | Anon key (for RLS client operations)                              |
| JWT_SECRET                  | ✅ YES         | JWT secret (can be Supabase JWT secret)                           |
| ALLOWED_ORIGINS             | ✅ YES         | CORS allowed origins (comma-separated)                            |
| NODE_ENV                    | ✅ YES         | Set to `production` in prod                                       |
| CHARGILY_SECRET_KEY         | ✅ YES PROD    | Chargily Pay secret key (enforced in production)                  |
| TRIAL_DAYS                  | ➕ NEW         | Free trial duration in days (default: 90)                         |
| PAYMENT_SUCCESS_URL         | ➕ NEW (FIX-3) | Deep link after payment success (default: `hafefli://payment/success`) |
| PAYMENT_FAILURE_URL         | ➕ NEW (FIX-3) | Deep link after payment failure (default: `hafefli://payment/failure`) |
| CHARGILY_WEBHOOK_URL        | ➕ NEW (FIX-3) | Webhook URL for Chargily: `https://<api-host>/api/v1/payments/webhook` |
| PORT                        | Optional       | HTTP port (default: 3000)                                         |
| REDIS_URL                   | Optional       | Redis for distributed cache                                       |
| SENTRY_DSN                  | Optional       | Sentry error monitoring                                           |

## Mobile (.env)

| Variable                       | Description                                        |
|--------------------------------|----------------------------------------------------|
| EXPO_PUBLIC_API_URL            | Backend URL (e.g. https://barberdz.up.railway.app) |
| EXPO_PUBLIC_SUPABASE_URL       | Supabase project URL                               |
| EXPO_PUBLIC_SUPABASE_ANON_KEY  | Supabase anon key                                  |

## Admin Web (.env.local)

| Variable                       | Description                                              |
|--------------------------------|----------------------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL       | Supabase project URL                                     |
| NEXT_PUBLIC_SUPABASE_ANON_KEY  | Supabase anon key                                        |
| NEXT_PUBLIC_API_URL            | Backend URL (e.g. https://barberdz.up.railway.app/api/v1)|

## Action Items

1. **Railway**: Add `CHARGILY_SECRET_KEY` (production Chargily key)
2. **Railway**: Add `TRIAL_DAYS=90`
3. **Railway**: Add `PAYMENT_SUCCESS_URL=hafefli://payment/success` _(FIX-3: mobile deep link)_
4. **Railway**: Add `PAYMENT_FAILURE_URL=hafefli://payment/failure` _(FIX-3: mobile deep link)_
5. **Railway**: Add `CHARGILY_WEBHOOK_URL=https://<your-api-host>/api/v1/payments/webhook` _(FIX-3)_
6. **chargily.service.ts**: ✅ Already uses production URL in NODE_ENV=production; test URL otherwise
7. **Supabase SQL Editor**: Run `services/api/migrations/run_all_migrations.sql`
8. **Supabase Storage**: Verify "portfolio" bucket exists (private)
9. **Expo / EAS**: Register `hafefli://` URI scheme in `app.json` for payment deep links _(FIX-3)_

## Notes

- `PAYMENT_SUCCESS_URL` and `PAYMENT_FAILURE_URL` default to `hafefli://payment/...` (mobile deep link)
  which opens the app after a Chargily payment. Override with an HTTPS URL only for web-based flows.
- `CHARGILY_WEBHOOK_URL` enables per-checkout webhook delivery for higher reliability than the
  global Chargily dashboard setting.
