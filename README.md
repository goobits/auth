# @goobits/auth

Pluggable authentication system for SvelteKit applications with support for OAuth, sessions, and multiple storage backends.

## Features

- **Pluggable Adapters**: Database, session, and token storage adapters
- **Multiple Backends**: Drizzle ORM, cookie-based, or bring your own
- **OAuth Support**: Google, Apple, and extensible provider system
- **Security First**: Automatic user sanitization, encrypted tokens, secure sessions
- **Type Safe**: Full JSDoc/TypeScript support throughout
- **SvelteKit Native**: Built specifically for SvelteKit with hooks integration
- **Session Management**: Rolling sessions with configurable lifetime and refresh
- **Token Encryption**: AES-256-GCM encryption for OAuth tokens

## Installation

```bash
pnpm add @goobits/auth
```

## Quick Start

### 1. Database-backed Authentication (Recommended)

```javascript
// src/lib/auth/config.js
import { DrizzleSessionAdapter, DrizzleUserAdapter, DrizzleTokenAdapter } from '@goobits/auth/adapters';
import { GoogleProvider } from '@goobits/auth/providers';
import { db } from '$lib/db';
import { users, sessions, oauthTokens } from '$lib/db/schema';

// Create session adapter for managing user sessions
export const sessionAdapter = new DrizzleSessionAdapter(db, {
  sessionsTable: sessions,
  usersTable: users,
  sessionLifetime: 30 * 24 * 60 * 60 * 1000, // 30 days
  refreshThreshold: 15 * 24 * 60 * 60 * 1000, // Refresh when 15 days left
});

// Create user adapter for user operations
export const userAdapter = new DrizzleUserAdapter(db, {
  usersTable: users,
});

// Create token adapter for storing OAuth tokens
export const tokenAdapter = new DrizzleTokenAdapter(db, {
  tokensTable: oauthTokens,
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
});

// Create OAuth providers
export const googleProvider = new GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl: `${process.env.APP_URL}/sign-in/google/callback`,
});
```

### 2. Add Session Validation to Hooks

```javascript
// src/hooks.server.js
import { sessionAdapter } from '$lib/auth/config.js';

export const handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(sessionAdapter.cookieName ?? 'session');

  if (sessionId) {
    const { session, user } = await sessionAdapter.validateSession(sessionId);

    // Refresh session if needed
    if (session?.fresh) {
      sessionAdapter.setSessionCookie(event.cookies, session);
    }

    event.locals.user = user;
    event.locals.session = session;
  } else {
    event.locals.user = null;
    event.locals.session = null;
  }

  return resolve(event);
};
```

### 3. OAuth Login Flow

```javascript
// src/routes/(auth)/sign-in/[provider]/+server.js
import { redirect } from '@sveltejs/kit';
import { createOAuthCookies } from '@goobits/auth/utils';
import { googleProvider } from '$lib/auth/config.js';

export const GET = async ({ cookies, params }) => {
  const providerName = params.provider;

  // Generate OAuth state and code verifier
  const { state, codeVerifier } = createOAuthCookies(cookies, providerName, {
    secure: true,
  });

  // Create authorization URL
  const url = googleProvider.createAuthorizationURL(state, codeVerifier, [
    'openid',
    'profile',
    'email',
  ]);

  throw redirect(302, url);
};
```

```javascript
// src/routes/(auth)/sign-in/[provider]/callback/+server.js
import { redirect } from '@sveltejs/kit';
import { getOAuthCallbackParams, validateOAuthCallback, cleanupOAuthCookies } from '@goobits/auth/utils';
import { googleProvider, sessionAdapter, tokenAdapter } from '$lib/auth/config.js';

export const GET = async ({ cookies, url }) => {
  // Extract and validate callback parameters
  const params = getOAuthCallbackParams(cookies, url, 'google');

  if (!validateOAuthCallback(params)) {
    throw redirect(302, '/sign-in?error=invalid_callback');
  }

  // Exchange code for tokens and get user profile
  const { profile, tokens } = await googleProvider.getUserProfile(
    params.code,
    params.storedCodeVerifier
  );

  // Store OAuth tokens (encrypted)
  await tokenAdapter.storeTokens(userId, 'google', tokens);

  // Create session
  const session = await sessionAdapter.createSession(userId);
  sessionAdapter.setSessionCookie(cookies, session);

  // Cleanup OAuth cookies
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

## API Reference

### Adapters

#### DrizzleSessionAdapter

Manages user sessions with automatic expiration and rolling refresh.

```javascript
import { DrizzleSessionAdapter } from '@goobits/auth/adapters';

const adapter = new DrizzleSessionAdapter(db, {
  sessionsTable: sessions,      // Required: Drizzle table definition
  usersTable: users,             // Required: Drizzle table definition
  sessionLifetime: 2592000000,   // Optional: 30 days (default)
  refreshThreshold: 1296000000,  // Optional: 15 days (default)
  cookieName: 'session',         // Optional: Cookie name (default: 'session')
});
```

**Methods:**

- `createSession(userId: string): Promise<Session>`
  - Creates a new session for the user
  - Returns session object with `id`, `userId`, `expiresAt`

- `validateSession(sessionId: string): Promise<{ session, user }>`
  - Validates session and returns user data
  - Marks session as `fresh` if it needs renewal
  - Returns `{ session: null, user: null }` if expired/invalid

- `invalidateSession(sessionId: string): Promise<void>`
  - Deletes the session from the database

- `setSessionCookie(cookies, session): void`
  - Sets the session cookie with secure attributes

- `deleteSessionCookie(cookies): void`
  - Deletes the session cookie

#### DrizzleUserAdapter

Handles user database operations with automatic password hash sanitization.

```javascript
import { DrizzleUserAdapter } from '@goobits/auth/adapters';

const adapter = new DrizzleUserAdapter(db, {
  usersTable: users,  // Required: Drizzle table definition
});
```

**Methods:**

- `getUserByEmail(email: string): Promise<User | null>`
  - Finds user by email (case-insensitive)
  - Auto-sanitizes password hash from response

- `getUserById(id: string): Promise<User | null>`
  - Finds user by ID
  - Auto-sanitizes password hash from response

- `createUser(data: UserData): Promise<User>`
  - Creates a new user
  - Auto-sanitizes password hash from response

#### DrizzleTokenAdapter

Stores encrypted OAuth tokens with automatic encryption/decryption.

```javascript
import { DrizzleTokenAdapter } from '@goobits/auth/adapters';

const adapter = new DrizzleTokenAdapter(db, {
  tokensTable: oauthTokens,                    // Required: Drizzle table definition
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,  // Required: 32-byte hex key
});
```

**Methods:**

- `storeTokens(userId: string, provider: string, tokens: object): Promise<void>`
  - Stores encrypted OAuth tokens for a user/provider combination
  - Tokens are encrypted using AES-256-GCM before storage

- `getTokens(userId: string, provider: string): Promise<object | null>`
  - Retrieves and decrypts OAuth tokens
  - Returns null if tokens don't exist

- `deleteTokens(userId: string, provider: string): Promise<void>`
  - Deletes stored tokens for a user/provider combination

#### CookieTokenAdapter

Stores tokens in encrypted cookies (stateless, no database required).

```javascript
import { CookieTokenAdapter } from '@goobits/auth/adapters';

const adapter = new CookieTokenAdapter({
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,  // Required: 32-byte hex key
  cookieName: 'oauth_tokens',                        // Optional: default 'oauth_tokens'
});
```

### Providers

#### GoogleProvider

OAuth 2.0 provider for Google authentication.

```javascript
import { GoogleProvider } from '@goobits/auth/providers';

const provider = new GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,          // Required
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,  // Required
  callbackUrl: 'https://example.com/auth/callback', // Required
});
```

**Methods:**

- `createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL`
  - Creates OAuth authorization URL with PKCE
  - Returns URL to redirect user to

- `getUserProfile(code: string, codeVerifier: string): Promise<{ profile, tokens }>`
  - Exchanges authorization code for tokens
  - Returns user profile and OAuth tokens

- `refreshAccessToken(refreshToken: string): Promise<tokens>`
  - Refreshes an expired access token
  - Returns new tokens

#### AppleProvider

OAuth 2.0 provider for Sign in with Apple.

```javascript
import { AppleProvider } from '@goobits/auth/providers';

const provider = new AppleProvider({
  clientId: process.env.APPLE_CLIENT_ID,      // Required: Services ID
  teamId: process.env.APPLE_TEAM_ID,          // Required: Team ID
  keyId: process.env.APPLE_KEY_ID,            // Required: Key ID
  privateKey: process.env.APPLE_PRIVATE_KEY,  // Required: Private key content
  callbackUrl: 'https://example.com/auth/callback',  // Required
});
```

### Utilities

#### OAuth Helpers

```javascript
import {
  createOAuthCookies,
  getOAuthCallbackParams,
  validateOAuthCallback,
  cleanupOAuthCookies,
} from '@goobits/auth/utils';

// Create state and code verifier cookies
const { state, codeVerifier } = createOAuthCookies(cookies, 'google', {
  secure: true,
  maxAge: 600, // 10 minutes
});

// Extract callback parameters
const params = getOAuthCallbackParams(cookies, url, 'google');
// Returns: { code, state, storedState, storedCodeVerifier }

// Validate callback
const isValid = validateOAuthCallback(params);
// Returns: boolean

// Cleanup OAuth cookies after callback
cleanupOAuthCookies(cookies, 'google');
```

#### Token Encryption

```javascript
import { encryptTokens, decryptTokens } from '@goobits/auth/utils';

// Encrypt tokens
const encrypted = encryptTokens(
  { accessToken: 'token', refreshToken: 'refresh' },
  'your-32-byte-encryption-key'
);

// Decrypt tokens
const decrypted = decryptTokens(encrypted, 'your-32-byte-encryption-key');
```

#### User Sanitization

```javascript
import { sanitizeUser } from '@goobits/auth/utils';

// Remove sensitive fields from user object
const safeUser = sanitizeUser(userFromDb);
// Removes: passwordHash, token, any field starting with 'password'
```

## Database Schema

### Required Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  provider TEXT,
  provider_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OAuth tokens table (optional, for token storage)
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  tokens TEXT NOT NULL,  -- Encrypted JSON
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Drizzle Schema Example

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
```

## Environment Variables

```bash
# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

APPLE_CLIENT_ID=your_apple_services_id
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Token Encryption
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=your_64_char_hex_string

# App URL
APP_URL=https://your-app.com
```

## Testing

Unit tests and integration tests are included in the `tests/` directory.

### Running Tests

```bash
# Install test dependencies
pnpm add --save-dev vitest @vitest/ui

# Run unit tests
pnpm test

# Run integration tests (requires test database)
DATABASE_URL=postgresql://localhost/auth_test pnpm test:integration

# Run with UI
pnpm test:ui
```

## Security Considerations

1. **Token Encryption**: Always use a strong 32-byte encryption key for `TOKEN_ENCRYPTION_KEY`
2. **Secure Cookies**: Sessions use `httpOnly`, `sameSite: 'lax'`, and `secure` (in production)
3. **Password Sanitization**: User objects automatically have password hashes removed
4. **PKCE**: OAuth flows use PKCE (Proof Key for Code Exchange) for additional security
5. **Session Expiration**: Sessions expire after configured lifetime and support rolling refresh

## Examples

### Cookie-based Auth (Stateless)

```javascript
import { CookieSessionAdapter } from '@goobits/auth/adapters';

const sessionAdapter = new CookieSessionAdapter({
  encryptionKey: process.env.SESSION_ENCRYPTION_KEY,
  sessionLifetime: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// In hooks.server.js
const { session, user } = await sessionAdapter.validateSession(event.cookies);
```

### Custom Provider

```javascript
import { OAuth2Provider } from '@goobits/auth/providers';

export class GithubProvider extends OAuth2Provider {
  constructor({ clientId, clientSecret, callbackUrl }) {
    super({
      clientId,
      clientSecret,
      callbackUrl,
      authorizeEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
    });
  }

  async getUserProfile(accessToken) {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();

    return {
      id: String(data.id),
      email: data.email,
      name: data.name,
      picture: data.avatar_url,
    };
  }
}
```

## Migration from Lucia

If you're migrating from Lucia Auth:

1. Replace `lucia.createSession` with `sessionAdapter.createSession`
2. Replace `lucia.validateSession` with `sessionAdapter.validateSession`
3. Replace `lucia.invalidateSession` with `sessionAdapter.invalidateSession`
4. Session cookies work the same way
5. User sanitization is automatic (no need for `transform` functions)

## License

MIT

## Contributing

Contributions welcome! Please read the contributing guidelines first.

## Support

- GitHub Issues: https://github.com/goobits/auth/issues
- Documentation: https://docs.goobits.com/auth
