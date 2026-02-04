# Quickstart

This is the only place with setup + code examples.

## 1) Server config

```js
// src/lib/auth/server.js
import { createAuth } from "@goobits/auth";
import {
  DrizzleSessionAdapter,
  DrizzleUserAdapter,
  DrizzleMagicLinkAdapter,
  DrizzleWebAuthnAdapter,
} from "@goobits/auth/adapters";
import { GoogleProvider, AppleProvider } from "@goobits/auth/providers";
import { db } from "$lib/db";
import {
  users,
  sessions,
  magicLinkTokens,
  webauthnCredentials,
  webauthnChallenges,
} from "$lib/db/schema";

export const auth = createAuth({
  adapters: {
    session: new DrizzleSessionAdapter(db, {
      sessionsTable: sessions,
      usersTable: users,
    }),
    database: new DrizzleUserAdapter(db, { usersTable: users }),
    magicLink: new DrizzleMagicLinkAdapter(db, { tokensTable: magicLinkTokens }),
    webauthn: new DrizzleWebAuthnAdapter(db, {
      credentialsTable: webauthnCredentials,
      challengesTable: webauthnChallenges,
    }),
  },
  providers: {
    google: {
      provider: new GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: `${process.env.APP_URL}/auth/google/callback`,
      }),
      scopes: ["openid", "profile", "email"],
    },
    apple: {
      provider: new AppleProvider({
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY,
        callbackUrl: `${process.env.APP_URL}/auth/apple/callback`,
      }),
    },
  },
  magicLink: {
    allowSignup: true,
    magicLinkPath: "/auth/magic/verify",
    sendEmail: async ({ email, link, otp }) => {
      // send email with your provider
    },
  },
  webauthn: {
    rpID: "localhost",
    rpName: "Your App",
    origin: "http://localhost:5173",
  },
  sessions: {},
});
```

## 2) Hooks

```js
// src/hooks.server.js
import { auth } from "$lib/auth/server";
export const handle = auth.handlers.hooks;
```

## 3) Routes (DRY)

```js
// src/routes/auth/magic/+server.js
import { auth } from "$lib/auth/server";
export const POST = auth.routes.magicLink().POST;
```

```js
// src/routes/auth/magic/verify/+server.js
import { auth } from "$lib/auth/server";
export const GET = auth.routes.magicLinkVerify().GET;
export const POST = auth.routes.magicLinkVerify().POST;
```

```js
// src/routes/auth/passkey/register/options/+server.js
import { auth } from "$lib/auth/server";
export const POST = auth.routes.passkeyRegisterOptions().POST;
```

```js
// src/routes/auth/passkey/register/verify/+server.js
import { auth } from "$lib/auth/server";
export const POST = auth.routes.passkeyRegisterVerify().POST;
```

```js
// src/routes/auth/passkey/login/options/+server.js
import { auth } from "$lib/auth/server";
export const POST = auth.routes.passkeyLoginOptions().POST;
```

```js
// src/routes/auth/passkey/login/verify/+server.js
import { auth } from "$lib/auth/server";
export const POST = auth.routes.passkeyLoginVerify().POST;
```

```js
// src/routes/auth/sessions/+server.js
import { auth } from "$lib/auth/server";
export const GET = auth.routes.sessions().GET;
export const POST = auth.routes.sessions().POST;
```

```js
// src/routes/auth/[provider]/+server.js
import { auth } from "$lib/auth/server";
export const GET = auth.routes.login().GET;
```

```js
// src/routes/auth/[provider]/callback/+server.js
import { auth } from "$lib/auth/server";
export const GET = auth.routes.callback().GET;
```

## 4) Client SDK

```js
// src/lib/auth/client.js
import { createAuthClient } from "@goobits/auth/client";

export const authClient = createAuthClient({
  baseUrl: "",
  endpoints: {
    magicLinkRequest: "/auth/magic",
    magicLinkVerify: "/auth/magic/verify",
    passkeyRegisterOptions: "/auth/passkey/register/options",
    passkeyRegisterVerify: "/auth/passkey/register/verify",
    passkeyLoginOptions: "/auth/passkey/login/options",
    passkeyLoginVerify: "/auth/passkey/login/verify",
    sessions: "/auth/sessions",
  },
});

// OAuth redirect
// authClient.loginWithOAuth("google");

// Magic link
// await authClient.sendMagicLink({ email });
// await authClient.verifyMagicLink({ email, otp });

// Passkeys
// await authClient.registerPasskey({ name: "MacBook" });
// await authClient.loginWithPasskey({ email });

// Sessions
// await authClient.listSessions();
// await authClient.revokeSession({ others: true });
```

## 5) UI helpers (optional)

```svelte
<script>
  import { AuthGate, SessionManager } from "@goobits/auth/ui";
  import "@goobits/auth/ui/theme.css";
</script>

<AuthGate let:user>
  <p>Welcome {user.email}</p>
</AuthGate>

<SessionManager listEndpoint="/auth/sessions" revokeEndpoint="/auth/sessions" />
```

## Schema

Use `docs/schema.md` for the SQL tables.
