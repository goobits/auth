# @goobits/auth

Pluggable authentication for SvelteKit. OAuth, email/password, sessions, MFA, passkeys — with Drizzle, Cloudflare D1, or bring your own backend.

```bash
pnpm add @goobits/auth
```

## What's Included

OAuth (Google, Apple, extensible) · Local auth (Argon2id) · Sessions (rolling, configurable) · Email verification & password reset · Token encryption (AES-256-GCM) · MFA (TOTP + backup codes) · Rate limiting · Magic links + OTP · Passkeys (WebAuthn) · Session management UI

## Docs

- `docs/quickstart.md` — setup, routes, client SDK
- `docs/schema.md` — all SQL
- `docs/public-api.md` — entry points
- `docs/migrations/vnext-breaking.md` — breaking API migration notes
- `docs/security-contract.md` — security policy and production contract

## Production Guarantees

- `hooks.onLogin` resolves identity only. Session issuance is framework-managed by default.
- If `hooks.onLogin` is set, a session is still created when a principal is resolved.
- If no principal can be resolved after login (`OAuth`, `Magic Link`, `WebAuthn`), auth fails explicitly.
- For advanced flows, set `hooks.onLoginMode = "manual"` to disable automatic session creation.

## Session Adapter Capability Matrix

- `list + revoke by id + revoke others`: requires `listSessions` and `invalidateSession`.
- `revoke all`: requires `invalidateUserSessions`.
- Unsupported capability paths return `501` responses instead of uncaught server errors.

## Production Checklist

- Set `cookies.secure = true` in production.
- Configure `magicLink.settings.trustProxyHeader` only behind a trusted proxy.
- Rotate token encryption keys with an operational key-rotation policy.
- Keep `rateLimit` and `verifyRateLimit` enabled for magic links.
- Monitor auth audit events via `auditAuthEvent` or your logger pipeline.

## Easy Secure Setup

```ts
import { GoobitsAuth } from "@goobits/auth";
import { drizzleAdapter } from "@goobits/auth/adapters/drizzle";

export const auth = new GoobitsAuth({
  profile: "secure",
  adapter: drizzleAdapter(db, {
    schema,
    oauthTokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? null,
  }),
  providers: { google: { provider: googleProvider } },
  security: {
    alerts: { enabled: true },
  },
});
```

- `profile: "secure"` enables rate limiting and audit policy wiring.
- `profile: "strict"` additionally enforces CSRF checks on state-changing auth routes.
- For the full zero-plumbing setup (`auth.handle()` + catch-all `auth.handlers`), see `docs/quickstart.md`.

---

## Quick Start

### 1. Configure Adapters

```javascript
// src/lib/auth/config.js
import { DrizzleSessionAdapter, DrizzleUserAdapter, DrizzleTokenAdapter } from '@goobits/auth/adapters';
import { GoogleProvider } from '@goobits/auth/providers';
import { db } from '$lib/db';
import { users, sessions, oauthTokens } from '$lib/db/schema';

export const sessionAdapter = new DrizzleSessionAdapter(db, {
  sessionsTable: sessions,
  usersTable: users,
  sessionLifetime: 30 * 24 * 60 * 60 * 1000,  // 30 days
  refreshThreshold: 15 * 24 * 60 * 60 * 1000,  // refresh at 15 days
});

export const userAdapter = new DrizzleUserAdapter(db, { usersTable: users });

export const tokenAdapter = new DrizzleTokenAdapter(db, {
  tokensTable: oauthTokens,
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
});

export const googleProvider = new GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl: `${process.env.APP_URL}/sign-in/google/callback`,
});
```

**Using Cloudflare D1?** Swap in the D1 adapters:

```javascript
import { D1SessionAdapter, D1UserAdapter, D1TokenAdapter } from '@goobits/auth/adapters';

export const sessionAdapter = new D1SessionAdapter(env.DB, {
  sessionsTable: 'sessions',
  usersTable: 'users',
});
export const userAdapter = new D1UserAdapter(env.DB, {
  usersTable: 'users',
  oauthAccountsTable: 'oauth_accounts',
});
export const tokenAdapter = new D1TokenAdapter(env.DB, {
  tokensTable: 'oauth_tokens',
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
});
```

### 2. Hook Up Sessions

```javascript
// src/hooks.server.js
import { sessionAdapter } from '$lib/auth/config.js';

export const handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(sessionAdapter.cookieName ?? 'session');

  if (sessionId) {
    const { session, user } = await sessionAdapter.validateSession(sessionId);
    if (session?.fresh) sessionAdapter.setSessionCookie(event.cookies, session);
    event.locals.user = user;
    event.locals.session = session;
  } else {
    event.locals.user = null;
    event.locals.session = null;
  }

  return resolve(event);
};
```

### 3. OAuth Flow

**Redirect to provider:**

```javascript
// src/routes/(auth)/sign-in/[provider]/+server.js
import { redirect } from '@sveltejs/kit';
import { createOAuthCookies } from '@goobits/auth/utils';
import { googleProvider } from '$lib/auth/config.js';

export const GET = async ({ cookies, params }) => {
  const { state, codeVerifier } = createOAuthCookies(cookies, params.provider, { secure: true });
  const url = googleProvider.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
  throw redirect(302, url);
};
```

**Handle callback:**

```javascript
// src/routes/(auth)/sign-in/[provider]/callback/+server.js
import { redirect } from '@sveltejs/kit';
import { getOAuthCallbackParams, validateOAuthCallback, cleanupOAuthCookies } from '@goobits/auth/utils';
import { googleProvider, sessionAdapter, tokenAdapter } from '$lib/auth/config.js';

export const GET = async ({ cookies, url }) => {
  const params = getOAuthCallbackParams(cookies, url, 'google');
  if (!validateOAuthCallback(params)) throw redirect(302, '/sign-in?error=invalid_callback');

  const { profile, tokens } = await googleProvider.getUserProfile(params.code, params.storedCodeVerifier);
  await tokenAdapter.storeTokens(userId, 'google', tokens);

  const session = await sessionAdapter.createSession(userId);
  sessionAdapter.setSessionCookie(cookies, session);
  cleanupOAuthCookies(cookies, 'google');

  throw redirect(302, '/dashboard');
};
```

### 4. Sign Out

```javascript
// src/routes/(auth)/sign-out/+page.server.js
import { redirect } from '@sveltejs/kit';
import { sessionAdapter } from '$lib/auth/config.js';

export const actions = {
  default: async ({ locals, cookies }) => {
    if (locals.session) {
      await sessionAdapter.invalidateSession(locals.session.id);
      sessionAdapter.deleteSessionCookie(cookies);
    }
    throw redirect(302, '/sign-in');
  }
};
```

---

## Local Auth (Email/Password)

### Setup

```javascript
// src/lib/auth/config.js
import { CredentialsProvider } from '@goobits/auth/providers';
import { DrizzleSessionAdapter, DrizzleUserAdapter, DrizzleVerificationTokenAdapter } from '@goobits/auth/adapters';
import { validatePasswordStrength } from '@goobits/auth/utils';
import { db } from '$lib/db';
import { users, sessions, verificationTokens } from '$lib/db/schema';

export const userAdapter = new DrizzleUserAdapter(db, { usersTable: users });
export const sessionAdapter = new DrizzleSessionAdapter(db, { sessionsTable: sessions, usersTable: users });
export const verificationTokenAdapter = new DrizzleVerificationTokenAdapter(db, {
  tokensTable: verificationTokens,
  usersTable: users,
});
export const credentialsProvider = new CredentialsProvider({
  validatePassword: validatePasswordStrength,
});
```

### Signup

```javascript
// src/routes/(auth)/sign-up/+page.server.js
import { hashPassword } from '@goobits/auth/utils';
import { sessionAdapter, userAdapter, createUserVerificationToken, VERIFICATION_TOKEN_TYPES } from '$lib/auth/config.js';
import { sendVerificationEmail } from '$lib/emails';
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');

    const existingUser = await userAdapter.getUserByEmail(email);
    if (existingUser) return { error: 'Email already in use' };

    const passwordHash = await hashPassword(password);
    const user = await userAdapter.createUser(
      { email, name, verified_email: false },
      { password: passwordHash, provider: 'email' }
    );

    const session = await sessionAdapter.createSession(user.id);
    sessionAdapter.setSessionCookie(cookies, session);

    const token = await createUserVerificationToken({
      userId: user.id,
      type: VERIFICATION_TOKEN_TYPES.EMAIL_VERIFICATION,
    });
    await sendVerificationEmail(email, token);

    throw redirect(303, '/dashboard');
  }
};
```

### Signin

```javascript
// src/routes/(auth)/sign-in/+page.server.js
import { verifyPassword } from '@goobits/auth/utils';
import { sessionAdapter, userAdapter } from '$lib/auth/config.js';
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    const user = await userAdapter.getUserWithPasswordHash(email);
    if (!user || !user.password) return { error: 'Invalid email or password' };

    const valid = await verifyPassword(user.password, password);
    if (!valid) return { error: 'Invalid email or password' };

    const session = await sessionAdapter.createSession(user.id);
    sessionAdapter.setSessionCookie(cookies, session);
    throw redirect(303, '/dashboard');
  }
};
```

### Password Reset

**Request reset** — always returns success (don't reveal whether the email exists):

```javascript
// src/routes/(auth)/password/reset/+page.server.js
import { userAdapter, createUserVerificationToken, VERIFICATION_TOKEN_TYPES } from '$lib/auth/config.js';
import { sendPasswordResetEmail } from '$lib/emails';

export const actions = {
  default: async ({ request }) => {
    const email = (await request.formData()).get('email');
    const user = await userAdapter.getUserByEmail(email);
    if (!user) return { success: true };

    const token = await createUserVerificationToken({
      userId: user.id,
      type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
    });
    await sendPasswordResetEmail(email, token);
    return { success: true };
  }
};
```

**Confirm reset:**

```javascript
// src/routes/(auth)/password/reset/[token]/+page.server.js
import { hashPassword } from '@goobits/auth/utils';
import { userAdapter, consumeUserVerificationToken, VERIFICATION_TOKEN_TYPES } from '$lib/auth/config.js';
import { redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ params, request }) => {
    const newPassword = (await request.formData()).get('password');

    const user = await consumeUserVerificationToken({
      token: params.token,
      type: VERIFICATION_TOKEN_TYPES.PASSWORD_RESET,
    });
    if (!user) return { error: 'Invalid or expired token' };

    await userAdapter.updateUser(user.id, { password: await hashPassword(newPassword) });
    throw redirect(303, '/sign-in?reset=success');
  }
};
```

---

## API Reference

### Adapters

#### DrizzleSessionAdapter

```javascript
const adapter = new DrizzleSessionAdapter(db, {
  sessionsTable,                    // required
  usersTable,                       // required
  sessionLifetime: 2592000000,      // 30 days (default)
  refreshThreshold: 1296000000,     // 15 days (default)
  cookieName: 'session',            // default
});
```

| Method | Returns |
|---|---|
| `createSession(userId)` | `Session` with `id`, `userId`, `expiresAt` |
| `validateSession(sessionId)` | `{ session, user }` — session is `null` if invalid, `fresh` if needs renewal |
| `invalidateSession(sessionId)` | `void` |
| `setSessionCookie(cookies, session)` | `void` |
| `deleteSessionCookie(cookies)` | `void` |

#### DrizzleUserAdapter

```javascript
const adapter = new DrizzleUserAdapter(db, { usersTable });
```

| Method | Returns |
|---|---|
| `getUserByEmail(email)` | `User \| null` (sanitized, no password hash) |
| `getUserById(id)` | `User \| null` (sanitized) |
| `createUser(data)` | `User` (sanitized) |

#### DrizzleTokenAdapter

```javascript
const adapter = new DrizzleTokenAdapter(db, {
  tokensTable,
  encryptionKey,  // 32-byte hex key
});
```

| Method | Returns |
|---|---|
| `storeTokens(userId, provider, tokens)` | `void` — encrypts with AES-256-GCM |
| `getTokens(userId, provider)` | `object \| null` — auto-decrypts |
| `deleteTokens(userId, provider)` | `void` |

#### CookieTokenAdapter

Stateless token storage in encrypted cookies — no database needed.

```javascript
const adapter = new CookieTokenAdapter({
  encryptionKey,                    // 32-byte hex key
  cookieName: 'oauth_tokens',      // default
});
```

#### DrizzleVerificationTokenAdapter

```javascript
const adapter = new DrizzleVerificationTokenAdapter(db, { tokensTable, usersTable });
```

| Method | Returns |
|---|---|
| `createToken({ userId, type, expiresInMs? })` | `string` — token (default: 1hr expiry) |
| `consumeToken({ token, type })` | `User \| null` — one-time use, auto-deletes |
| `deleteUserTokens({ userId, type })` | `void` |

### Providers

#### GoogleProvider / AppleProvider

```javascript
import { GoogleProvider } from '@goobits/auth/providers';

const google = new GoogleProvider({ clientId, clientSecret, callbackUrl });
```

| Method | Description |
|---|---|
| `createAuthorizationURL(state, codeVerifier, scopes)` | Returns auth URL with PKCE |
| `getUserProfile(code, codeVerifier)` | Returns `{ profile, tokens }` |
| `refreshAccessToken(refreshToken)` | Returns new tokens |

Apple works the same way but takes `teamId`, `keyId`, and `privateKey` instead of `clientSecret`.

#### CredentialsProvider

```javascript
const provider = new CredentialsProvider({ validatePassword? });
```

| Method | Description |
|---|---|
| `authenticate({ email, password, userAdapter })` | Returns `{ user, valid }` |
| `signUp({ email, password, name, metadata, userAdapter })` | Returns `User` |
| `updatePassword({ userId, newPassword, userAdapter })` | Returns `User` |
| `changePassword({ email, currentPassword, newPassword, userAdapter })` | Returns `{ user, valid }` |

#### Custom Providers

```javascript
import { OAuth2Provider } from '@goobits/auth/providers';

export class GithubProvider extends OAuth2Provider {
  constructor({ clientId, clientSecret, callbackUrl }) {
    super({ clientId, clientSecret, callbackUrl,
      authorizeEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
    });
  }

  async getUserProfile(accessToken) {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return { id: String(data.id), email: data.email, name: data.name, picture: data.avatar_url };
  }
}
```

### Utilities

```javascript
import { hashPassword, verifyPassword, validatePasswordStrength } from '@goobits/auth/utils';
import { createOAuthCookies, getOAuthCallbackParams, validateOAuthCallback, cleanupOAuthCookies } from '@goobits/auth/utils';
import { encryptTokens, decryptTokens } from '@goobits/auth/utils';
import { sanitizeUser } from '@goobits/auth/utils';
```

### Security (Cloudflare-ready)

```javascript
import { issueCsrfToken, validateCsrfRequest, createRateLimiter, MemoryRateLimitStore } from '@goobits/auth/security';

const rateLimit = createRateLimiter({ store: new MemoryRateLimitStore(), windowMs: 60_000, max: 5 });
const csrfToken = await issueCsrfToken({ cookies });
const ok = await validateCsrfRequest({ request, cookies });
```

### MFA

```javascript
import { generateSecret, createOtpAuthURL, verifyTOTP } from '@goobits/auth/mfa';
import { generateBackupCodes, hashBackupCodes } from '@goobits/auth/mfa';
```

### UI Components

```svelte
<script>
  import { BackupCodesModal, AuthNotification } from '@goobits/auth/ui';
  import '@goobits/auth/ui/theme.css';
</script>
```

### Pre-built Handlers

Drop-in route handlers if you don't need customization:

```javascript
import { createSignupHandler, createSigninHandler, createPasswordResetRequestHandler, createPasswordResetConfirmHandler } from '@goobits/auth/handlers';

// Each returns a request handler you can export directly
export const POST = createSignupHandler({ userAdapter, sessionAdapter, verificationTokenAdapter?, validatePassword?, onSuccess? });
export const POST = createSigninHandler({ userAdapter, sessionAdapter, onSuccess? });
export const POST = createPasswordResetRequestHandler({ userAdapter, verificationTokenAdapter, sendEmail });
export const POST = createPasswordResetConfirmHandler({ userAdapter, verificationTokenAdapter, validatePassword?, onSuccess? });
```

---

## Database Schema

### SQL

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  provider TEXT,
  provider_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: for OAuth token storage
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  tokens TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optional: for email verification / password reset
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Drizzle

```javascript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  provider: text('provider'),
  providerId: text('provider_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  tokens: text('tokens').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  type: text('type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Environment Variables

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=your_64_char_hex_string

APP_URL=https://your-app.com
```

## Security Notes

- **Tokens**: AES-256-GCM encrypted at rest
- **Cookies**: `httpOnly`, `sameSite: lax`, `secure` in production
- **Passwords**: Argon2id hashed, automatically stripped from user objects
- **OAuth**: PKCE on all flows
- **Sessions**: Auto-expire + rolling refresh

## Migrating from Lucia

| Lucia | @goobits/auth |
|---|---|
| `lucia.createSession` | `sessionAdapter.createSession` |
| `lucia.validateSession` | `sessionAdapter.validateSession` |
| `lucia.invalidateSession` | `sessionAdapter.invalidateSession` |

Session cookies and user sanitization work out of the box — no `transform` functions needed.

## Testing

```bash
pnpm test                    # unit tests
pnpm test:integration        # needs DATABASE_URL
pnpm test:ui                 # vitest UI
```

## License

MIT
