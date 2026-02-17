# Release Notes: Register Anti-Abuse + Verification

## New environment variables

Add these to your environment and rotate secrets periodically:

- `ANTIABUSE_ENABLED=true`
- `ABUSE_MIN_SUBMIT_MS=2500`
- `PUBLIC_TURNSTILE_SITE_KEY=`
- `TURNSTILE_SECRET_KEY=`
- `TURNSTILE_REQUIRED=false`
- `TURNSTILE_FAIL_OPEN=true`
- `TURNSTILE_ENABLE_LOCALHOST=false`
- `REGISTRATION_RATE_LIMIT_PER_IP=12`
- `REGISTRATION_RATE_LIMIT_PER_EMAIL=5`
- `REGISTRATION_RATE_LIMIT_PER_DEVICE=8`
- `REGISTRATION_RATE_LIMIT_PER_ASN=30`
- `REGISTRATION_RATE_LIMIT_WINDOW_MS=3600000`
- `DISPOSABLE_EMAIL_BLOCK_MODE=score` (`off|score|block`)
- `EMAIL_VERIFICATION_WEBHOOK_URL=`

## Cloudflare Turnstile setup

1. Create a Turnstile widget in Cloudflare Dashboard.
2. Add your domains (including local/dev hostnames if needed).
3. Put Site Key in `PUBLIC_TURNSTILE_SITE_KEY`.
4. Put Secret Key in `TURNSTILE_SECRET_KEY`.
5. Keep `TURNSTILE_REQUIRED=false` during initial rollout, then enable after monitoring.

## Rollout checklist

1. Apply DB migration `packages/calendar/migrations/0006_email_verification_tokens.sql`.
2. Deploy with `ANTIABUSE_ENABLED=true`, `TURNSTILE_REQUIRED=false`.
3. Verify `/register` submission flow in dev/prod.
4. Verify `/verify-email` link activation path.
5. Monitor rejection rates and tune limits.
6. Rotate Turnstile secret on schedule or incident.

## OAuth callback checklist

Ensure these exact callback URLs are configured in provider dashboards:

- Google/Auth app redirect: `https://<your-domain>/auth/google/callback`
- Local dev redirect: `http://localhost:3610/auth/google/callback`
- Calendar admin OAuth callback: `https://<your-domain>/api/calendar/oauth-callback`
- Local dev calendar callback: `http://localhost:3610/api/calendar/oauth-callback`

If callbacks mismatch, Google returns `redirect_uri_mismatch` and sign-in fails before app code runs.

## Pre-launch quality gate

Run this exact sequence before each release:

1. `pnpm ci:gate`
2. `pnpm audit:css-vars`
3. `pnpm e2e:sitemap`
4. `pnpm e2e:visual`

## Rollback plan

1. Re-deploy previous successful build via Cloudflare Pages.
2. Re-apply prior secrets set only if env was changed (`pnpm deploy:secrets` with previous encrypted env).
3. Verify auth callback routes and `/calendar/login` flow after rollback.
