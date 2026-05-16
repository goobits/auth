# Security Policy

## Reporting

Please report security issues privately to the maintainers before public disclosure.

Include:

- affected version/commit
- reproduction steps
- expected vs observed behavior
- impact assessment

## Support Window

- Latest minor release: full support.
- Previous minor release: best-effort critical fixes.

## Secrets and Rotation

Recommended rotation cadence:

- OAuth client secrets: every 90 days or after incident.
- token encryption keys: every 90 days with a documented rollover plan.
- webhook signing secrets: every 90 days.

## Hard Requirements for Production

1. HTTPS enforced at edge/app layer.
2. Secure cookies enabled.
3. Security headers configured (HSTS, CSP, X-Frame-Options or equivalent).
4. Dependency + secret scanning in CI.
