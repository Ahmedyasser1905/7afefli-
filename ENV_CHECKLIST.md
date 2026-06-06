# Environment Variables Checklist — BarberDZ / Hafefli
# Generated: 2026-06-06 | Task 20 of AI_FIX_PLAN.md

## Backend (Railway)

| Variable                  | Required     | Description                                      |
|---------------------------|--------------|--------------------------------------------------|
| SUPABASE_URL              | ✅ YES       | URL of the Supabase project                      |
| SUPABASE_SERVICE_ROLE_KEY | ✅ YES       | Service role key (bypasses RLS)                  |
| SUPABASE_ANON_KEY         | ✅ YES       | Anon key (for RLS client operations)             |
| JWT_SECRET                | ✅ YES       | JWT secret (can be Supabase JWT secret)          |
| ALLOWED_ORIGINS           | ✅ YES       | CORS allowed origins (comma-separated)           |
| NODE_ENV                  | ✅ YES       | Set to `production` in prod                      |
| CHARGILY_SECRET_KEY       | ✅ YES PROD  | Chargily Pay secret key (enforced in production) |
| TRIAL_DAYS                | ➕ NEW       | Free trial duration in days (default: 90)        |
| PORT                      | Optional     | HTTP port (default: 3000)                        |
| REDIS_URL                 | Optional     | Redis for distributed cache                      |
| SENTRY_DSN                | Optional     | Sentry error monitoring                          |

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
3. **chargily.service.ts**: Switch URL from test → production:
   - From: `https://pay.chargily.net/test/api/v2/checkouts`
   - To:   `https://pay.chargily.net/api/v2/checkouts`
4. **Supabase SQL Editor**: Run `services/api/migrations/run_all_migrations.sql`
5. **Supabase Storage**: Verify "portfolio" bucket exists (private)
