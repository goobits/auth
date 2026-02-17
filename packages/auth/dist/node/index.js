import { redirect, error } from '@sveltejs/kit';
import { OAuth2RequestError, generateState, generateCodeVerifier } from 'arctic';
import { encodeBase64url, decodeBase64url } from '@oslojs/encoding';
import { z } from 'zod';
import { verifyAuthenticationResponse, generateAuthenticationOptions, verifyRegistrationResponse, generateRegistrationOptions } from '@simplewebauthn/server';

var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/utils/logger.ts
function setLogger(logger) {
  if (!logger) {
    activeLoggers = [];
    return;
  }
  if (!activeLoggers.includes(logger)) {
    activeLoggers.push(logger);
  }
}
function getLogger() {
  if (activeLoggers.length === 0) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop
    };
  }
  const forward = (level, args) => {
    for (const logger of activeLoggers) {
      logger[level]?.(...args);
    }
  };
  return {
    debug: (...args) => forward("debug", args),
    info: (...args) => forward("info", args),
    warn: (...args) => forward("warn", args),
    error: (...args) => forward("error", args)
  };
}
var noop, activeLoggers;
var init_logger = __esm({
  "src/utils/logger.ts"() {
    noop = () => {
    };
    activeLoggers = [];
  }
});
function createOAuthCookies(cookies, provider, options = {}) {
  const { secure = true, maxAge = 30 * 60, sameSite = "lax" } = options;
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const cookieOptions = {
    httpOnly: true,
    path: "/",
    secure,
    sameSite,
    maxAge
  };
  cookies.set(`${provider}_oauth_state`, state, cookieOptions);
  cookies.set(`${provider}_oauth_code_verifier`, codeVerifier, {
    ...cookieOptions,
    secure
  });
  return { state, codeVerifier };
}
function cleanupOAuthCookies(cookies, provider) {
  cookies.delete(`${provider}_oauth_state`, { path: "/" });
  cookies.delete(`${provider}_oauth_code_verifier`, { path: "/" });
}
function validateOAuthCallback(params) {
  const { code, state, storedState, storedCodeVerifier } = params;
  return !!(code && storedCodeVerifier && storedState && state === storedState);
}
function getOAuthCallbackParams(cookies, url, provider, overrides = {}) {
  const code = overrides.code ?? url.searchParams.get("code");
  const state = overrides.state ?? url.searchParams.get("state");
  const storedState = cookies.get(`${provider}_oauth_state`) ?? null;
  const storedCodeVerifier = cookies.get(`${provider}_oauth_code_verifier`) ?? null;
  return { code, state, storedState, storedCodeVerifier };
}
async function handleOAuthCallback({
  event,
  provider,
  providerInstance,
  callbacks,
  appleUserData = null,
  overrideParams = null
}) {
  const { cookies, url } = event;
  let override = overrideParams || {};
  if (!overrideParams) {
    try {
      if (event.request.method === "POST") {
        const formData = await event.request.formData();
        override = {
          code: formData.get("code")?.toString() ?? null,
          state: formData.get("state")?.toString() ?? null
        };
      }
    } catch {
    }
  }
  try {
    const params = getOAuthCallbackParams(cookies, url, provider, override);
    if (!validateOAuthCallback(params)) {
      throw new Error("Invalid OAuth callback parameters");
    }
    if (!params.code || !params.storedCodeVerifier) {
      throw new Error("Missing OAuth parameters");
    }
    let profile = null;
    if (provider === "apple" && appleUserData) {
      profile = await providerInstance.getUserProfile(
        params.code,
        params.storedCodeVerifier,
        appleUserData
      );
    } else {
      profile = await providerInstance.getUserProfile(
        params.code,
        params.storedCodeVerifier
      );
    }
    if (!profile?.profile) {
      throw new Error("Invalid provider profile");
    }
    cleanupOAuthCookies(cookies, provider);
    if (callbacks.onAuthenticated) {
      await callbacks.onAuthenticated(profile.profile, profile.tokens);
    }
    return profile;
  } catch (error3) {
    if (callbacks.onError) {
      await callbacks.onError(error3);
    }
    cleanupOAuthCookies(cookies, provider);
    throw error3;
  }
}

// src/handlers/login.ts
function createLoginHandler(config) {
  const {
    providers,
    redirectAfterLogin = "/",
    secureCookies = true,
    isAuthenticated = (locals) => !!locals.user
  } = config;
  return async ({ cookies, params, locals }) => {
    if (isAuthenticated(locals)) {
      throw redirect(302, redirectAfterLogin);
    }
    const providerName = String(params["provider"] ?? "");
    const providerConfig = providers[providerName];
    if (!providerConfig) {
      return new Response("Invalid OAuth provider", { status: 400 });
    }
    const { provider, scopes } = providerConfig;
    const { state, codeVerifier } = createOAuthCookies(
      cookies,
      providerName,
      { secure: secureCookies, sameSite: "lax" }
    );
    const authUrl = provider.createAuthorizationURL(
      state,
      codeVerifier,
      scopes || []
    );
    if (providerName === "apple") {
      authUrl.searchParams.set("response_mode", "form_post");
    }
    throw redirect(302, authUrl);
  };
}
init_logger();

// src/errors/auth.ts
var AuthPrincipalResolutionError = class extends Error {
  code = "AUTH_PRINCIPAL_RESOLUTION_FAILED";
  status;
  constructor(message = "Unable to resolve authenticated principal", status = 401) {
    super(message);
    this.name = "AuthPrincipalResolutionError";
    this.status = status;
  }
};
var AuthAdapterCapabilityError = class extends Error {
  code = "AUTH_ADAPTER_CAPABILITY_UNSUPPORTED";
  status;
  constructor(message = "Adapter capability not supported", status = 501) {
    super(message);
    this.name = "AuthAdapterCapabilityError";
    this.status = status;
  }
};

// src/handlers/callback.ts
function createCallbackHandler(config) {
  const {
    providers,
    redirectAfterLogin = "/",
    isAuthenticated = (locals) => !!locals.user,
    onAuthenticated,
    onError
  } = config;
  const log = getLogger();
  const isStatusError = (value) => typeof value === "object" && value !== null && "status" in value && typeof value.status === "number";
  return async (event) => {
    const { params, locals, url } = event;
    try {
      if (isAuthenticated(locals)) {
        throw redirect(302, redirectAfterLogin);
      }
      const providerName = String(params["provider"] ?? "");
      const providerInstance = providers[providerName];
      if (!providerInstance) {
        throw error(400, "Invalid OAuth provider");
      }
      let appleUserData = null;
      let overrideParams = null;
      if (providerName === "apple" && event.request.method === "POST") {
        const formData = await event.request.formData();
        appleUserData = formData.get("user")?.toString() ?? null;
        overrideParams = {
          code: formData.get("code")?.toString() ?? null,
          state: formData.get("state")?.toString() ?? null
        };
      }
      const callbacks = {
        onAuthenticated: async (userProfile, tokens) => {
          await onAuthenticated(event, userProfile, tokens);
        },
        ...onError ? { onError: async (err) => onError(event, err) } : {}
      };
      await handleOAuthCallback({
        event,
        provider: providerName,
        providerInstance,
        appleUserData,
        overrideParams,
        callbacks
      });
      throw redirect(302, redirectAfterLogin);
    } catch (err) {
      if (err instanceof OAuth2RequestError) {
        throw error(400, "OAuth authentication failed");
      }
      if (isStatusError(err)) {
        throw err;
      }
      if (err instanceof AuthPrincipalResolutionError) {
        throw error(err.status, err.message);
      }
      log.error?.("Authentication error:", err);
      throw error(500, "Authentication system error");
    }
  };
}

// src/handlers/logout.ts
init_logger();
function createLogoutHandler(config) {
  const {
    sessionAdapter,
    redirectAfterLogout = "/",
    getSession = (locals) => locals.session ?? null,
    onLogout
  } = config;
  const log = getLogger();
  return async (event) => {
    try {
      const session = getSession(event.locals);
      if (session) {
        await sessionAdapter.invalidateSession(session.id);
        sessionAdapter.deleteSessionCookie(event.cookies);
      }
      if (onLogout) {
        await onLogout(event);
      }
      throw redirect(302, redirectAfterLogout);
    } catch (error3) {
      if (error3 && typeof error3 === "object" && "status" in error3 && error3.status === 302) {
        throw error3;
      }
      log.error?.("Error during logout:", error3);
      throw redirect(302, redirectAfterLogout);
    }
  };
}

// src/utils/crypto.ts
var SHA_256 = "SHA-256";
async function getWebCrypto() {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error("WebCrypto is required");
}
async function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto === "undefined") {
    throw new Error("crypto.getRandomValues is required");
  }
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
var HEX_STRINGS = new Array(256);
for (let i = 0; i < 256; i++) {
  HEX_STRINGS[i] = i.toString(16).padStart(2, "0");
}
var CHAR_TO_NIBBLE = new Array(127).fill(-1);
"0123456789abcdefABCDEF".split("").forEach((c) => {
  CHAR_TO_NIBBLE[c.charCodeAt(0)] = parseInt(c, 16);
});
function bytesToHex(bytes) {
  const len = bytes.length;
  const hex = new Array(len);
  for (let i = 0; i < len; i++) {
    const byte = bytes[i];
    if (byte === void 0) {
      throw new Error("Invalid byte array");
    }
    const value = HEX_STRINGS[byte];
    if (value === void 0) {
      throw new Error("Invalid byte value");
    }
    hex[i] = value;
  }
  return hex.join("");
}
async function generateRandomUUID() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = await getRandomBytes(16);
  bytes[6] = (bytes[6] ?? 0) & 15 | 64;
  bytes[8] = (bytes[8] ?? 0) & 63 | 128;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function sha256Hex(value) {
  const cryptoImpl = await getWebCrypto();
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await cryptoImpl.subtle.digest(
    SHA_256,
    data
  );
  return bytesToHex(new Uint8Array(digest));
}

// src/utils/magic-link.ts
async function generateMagicLinkToken(bytesLength = 32) {
  const bytes = await getRandomBytes(bytesLength);
  return encodeBase64url(bytes);
}
async function generateOtp(digits = 6) {
  const max = 10 ** digits;
  const bytes = await getRandomBytes(4);
  const b0 = bytes[0] ?? 0;
  const b1 = bytes[1] ?? 0;
  const b2 = bytes[2] ?? 0;
  const b3 = bytes[3] ?? 0;
  const value = (b0 << 24 | b1 << 16 | b2 << 8 | b3) >>> 0;
  const code = value % max;
  return String(code).padStart(digits, "0");
}
async function hashToken(token) {
  return sha256Hex(token);
}

// src/security/rate-limit.ts
var MemoryRateLimitStore = class {
  _data;
  constructor() {
    this._data = /* @__PURE__ */ new Map();
  }
  async get(key) {
    const record = this._data.get(key);
    if (!record) return null;
    if (record.resetAt && Date.now() > record.resetAt) {
      this._data.delete(key);
      return null;
    }
    return record;
  }
  async set(key, value) {
    this._data.set(key, value);
  }
  async delete(key) {
    this._data.delete(key);
  }
};
function createRateLimiter({
  store = new MemoryRateLimitStore(),
  windowMs = 60 * 1e3,
  max = 5,
  keyPrefix = "rl"
} = {}) {
  return async function checkRateLimit(key) {
    const now = Date.now();
    const fullKey = `${keyPrefix}:${key}`;
    const record = await store.get(fullKey);
    if (!record || now >= record.resetAt) {
      const resetAt = now + windowMs;
      const next2 = { count: 1, resetAt };
      await store.set(fullKey, next2, windowMs);
      return { allowed: true, remaining: max - 1, resetAt };
    }
    if (record.count >= max) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }
    const next = { count: record.count + 1, resetAt: record.resetAt };
    await store.set(fullKey, next, record.resetAt - now);
    return { allowed: true, remaining: max - next.count, resetAt: next.resetAt };
  };
}

// src/utils/sanitize.ts
function sanitizeUser(user) {
  if (!user) return null;
  const { password: _password, token: _token, ...safeUser } = user;
  return safeUser;
}
async function parseRequestData(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await request.json().catch(() => ({}));
    if (!data || typeof data !== "object") return {};
    return data;
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  return {};
}
async function parseRequestDataWithSchema(request, schema) {
  const data = await parseRequestData(request);
  const parsed = schema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data;
}
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// src/utils/session-lifecycle.ts
async function ensureSessionAfterLogin(input) {
  const {
    event,
    sessionAdapter,
    userId,
    autoCreateSession = true,
    onLoginMode = "augment"
  } = input;
  if (!userId) {
    throw new AuthPrincipalResolutionError();
  }
  if (autoCreateSession && onLoginMode === "augment") {
    const session = await sessionAdapter.createSession(userId);
    sessionAdapter.setSessionCookie?.(event.cookies, session);
  }
  return userId;
}

// src/utils/redact.ts
var DEFAULT_REDACT_KEYS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "client_secret",
  "clientsecret",
  "verification_token",
  "verificationtoken",
  "totp",
  "otp",
  "passphrase"
];
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function redactObject(input, keys = DEFAULT_REDACT_KEYS) {
  if (!input) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item, keys));
  }
  if (!isPlainObject(input)) return input;
  const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (lowerKeys.has(key.toLowerCase())) {
      output[key] = "[redacted]";
    } else if (isPlainObject(value) || Array.isArray(value)) {
      output[key] = redactObject(value, keys);
    } else {
      output[key] = value;
    }
  }
  return output;
}

// src/security/audit.ts
function auditLog(event, options = {}) {
  const { logger = console, redactKeys = DEFAULT_REDACT_KEYS } = options;
  const safeEvent = redactObject(event, redactKeys);
  logger.info("audit", safeEvent);
}
function auditAuthEvent(event, payload = {}, options = {}) {
  auditLog(
    {
      category: "auth",
      event,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...payload
    },
    options
  );
}

// src/utils/redirect.ts
function isSafeRedirectPath(value) {
  const v = value.trim();
  if (!v) return false;
  if (!v.startsWith("/")) return false;
  if (v.startsWith("//")) return false;
  if (v.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(v)) return false;
  return true;
}

// src/handlers/magic-link.ts
function getRateLimitKey(event, config) {
  if (config?.key) return config.key(event);
  if (event.getClientAddress) return event.getClientAddress();
  if (config?.trustProxyHeader) {
    return event.request.headers.get("x-forwarded-for") || "unknown";
  }
  return "unknown";
}
function createMagicLinkRequestHandler(config) {
  const {
    magicLinkAdapter,
    databaseAdapter,
    sendEmail,
    allowSignup = false,
    expiresInMs = 15 * 60 * 1e3,
    magicLinkPath = "/auth/magic/verify",
    includeOtp = true,
    otpDigits = 6,
    singleUsePerEmail = true,
    secureCookies = true,
    normalizeEmail = (email) => email.trim().toLowerCase(),
    exposeToken = false,
    baseUrl,
    rateLimit,
    getMetadata
  } = config;
  if (!magicLinkAdapter) {
    throw new Error("createMagicLinkRequestHandler requires magicLinkAdapter");
  }
  if (typeof sendEmail !== "function") {
    throw new Error("createMagicLinkRequestHandler requires sendEmail");
  }
  return async (event) => {
    if (rateLimit) {
      await rateLimit(event);
    }
    const data = await parseRequestData(event.request);
    const emailInput = typeof data["email"] === "string" && data["email"] || typeof data["identifier"] === "string" && data["identifier"] || "";
    const email = normalizeEmail(String(emailInput || ""));
    if (!email) {
      return jsonResponse({ ok: false, error: "Email required" }, 400);
    }
    const user = databaseAdapter ? await databaseAdapter.getUserByEmail(email) : null;
    if (!user && !allowSignup) {
      return jsonResponse({ ok: true }, 200);
    }
    if (singleUsePerEmail) {
      await magicLinkAdapter.deleteByEmail(email);
    }
    const token = await generateMagicLinkToken();
    const tokenHash = await hashToken(token);
    const otp = includeOtp ? await generateOtp(otpDigits) : null;
    const otpHash = otp ? await hashToken(otp) : null;
    const expiresAt = new Date(Date.now() + expiresInMs);
    const metadata = typeof getMetadata === "function" ? await getMetadata(event) : {};
    await magicLinkAdapter.createToken({
      userId: user?.id ?? null,
      email,
      tokenHash,
      otpHash,
      expiresAt,
      metadata
    });
    const redirectToRaw = typeof data["redirectTo"] === "string" ? data["redirectTo"] : "";
    const redirectTo = isSafeRedirectPath(redirectToRaw) ? redirectToRaw : "";
    const origin = baseUrl || event.url.origin;
    const url = new URL(magicLinkPath, origin);
    url.searchParams.set("token", token);
    if (redirectTo) {
      url.searchParams.set("redirectTo", redirectTo);
    }
    await sendEmail({
      email,
      link: url.toString(),
      otp,
      token,
      expiresAt,
      user,
      redirectTo,
      secureCookies
    });
    if (exposeToken) {
      return jsonResponse({ ok: true, token, otp });
    }
    return jsonResponse({ ok: true });
  };
}
function createMagicLinkVerifyHandler(config) {
  const {
    magicLinkAdapter,
    databaseAdapter,
    sessionAdapter,
    allowSignup = false,
    createUser,
    onLogin,
    redirectAfterLogin = "/",
    isAuthenticated = (locals) => !!locals.user,
    secureCookies = true,
    normalizeEmail = (email) => email.trim().toLowerCase(),
    verifyRateLimit,
    verifyRateLimitMax = 5,
    verifyRateLimitWindowMs = 10 * 60 * 1e3,
    sanitizeUser: sanitizeUser2 = sanitizeUser,
    autoCreateSession = true,
    onLoginMode = "augment"
  } = config;
  if (!magicLinkAdapter) {
    throw new Error("createMagicLinkVerifyHandler requires magicLinkAdapter");
  }
  if (!sessionAdapter) {
    throw new Error("createMagicLinkVerifyHandler requires sessionAdapter");
  }
  const internalLimiter = typeof verifyRateLimit === "function" ? verifyRateLimit : createRateLimiter({
    windowMs: verifyRateLimitWindowMs,
    max: verifyRateLimitMax,
    keyPrefix: "mlv"
  });
  return async (event) => {
    if (isAuthenticated(event.locals)) {
      throw redirect(302, redirectAfterLogin);
    }
    const data = await parseRequestData(event.request);
    const token = typeof data["token"] === "string" && data["token"] || event.url.searchParams.get("token");
    const otp = typeof data["otp"] === "string" && data["otp"] || typeof data["code"] === "string" && data["code"];
    const emailInput = typeof data["email"] === "string" && data["email"] || event.url.searchParams.get("email") || "";
    const email = normalizeEmail(String(emailInput || ""));
    if (!token && !(otp && email)) {
      return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
    }
    const ipKey = getRateLimitKey(event, config);
    const identifier = email || (token ? await hashToken(token) : "unknown");
    const rateKey = `${identifier}:${ipKey}`;
    const rateResult = await internalLimiter(rateKey);
    if (!rateResult?.allowed) {
      return jsonResponse(
        { ok: false, error: "Too many attempts. Try again later." },
        429
      );
    }
    let record = null;
    if (token) {
      const tokenHash = await hashToken(token);
      record = await magicLinkAdapter.findByTokenHash(tokenHash);
    } else if (otp && email) {
      const otpHash = await hashToken(otp);
      record = await magicLinkAdapter.findByEmailAndOtpHash({
        email,
        otpHash
      });
    }
    if (!record) {
      auditAuthEvent("magic_link.invalid", {
        email,
        hasToken: Boolean(token),
        hasOtp: Boolean(otp)
      });
      return jsonResponse({ ok: false, error: "Invalid magic link" }, 400);
    }
    const expiresAt = record["expiresAt"];
    if (expiresAt && new Date(expiresAt) < /* @__PURE__ */ new Date()) {
      const recordId2 = record["id"];
      if (typeof recordId2 === "string") {
        await magicLinkAdapter.deleteById(recordId2);
      }
      auditAuthEvent("magic_link.expired", {
        email: record["email"] ?? email
      });
      return jsonResponse({ ok: false, error: "Magic link expired" }, 400);
    }
    const recordId = record["id"];
    if (typeof recordId === "string") {
      await magicLinkAdapter.deleteById(recordId);
    }
    let user = null;
    const recordUserId = typeof record["userId"] === "string" ? record["userId"] : null;
    const recordEmail = typeof record["email"] === "string" ? record["email"] : null;
    if (databaseAdapter) {
      if (recordUserId) {
        user = await databaseAdapter.getUserById(recordUserId);
      }
      if (!user && (recordEmail || email)) {
        user = await databaseAdapter.getUserByEmail(recordEmail || email);
      }
    }
    if (!user && allowSignup && databaseAdapter) {
      if (typeof createUser === "function") {
        user = await createUser(recordEmail || email, event);
      } else {
        const signupEmail = recordEmail || email;
        const signupName = signupEmail.split("@")[0] ?? "";
        user = await databaseAdapter.createUser({
          id: signupEmail,
          email: signupEmail,
          name: signupName,
          verified_email: true
        });
      }
    }
    if (user && databaseAdapter && user.emailVerified === false) {
      try {
        await databaseAdapter.updateUser(user.id, { emailVerified: true });
      } catch {
      }
    }
    let userId = user?.id ? String(user.id) : recordUserId;
    if (onLogin) {
      const profileEmail = recordEmail || email;
      const profileName = user?.name || (profileEmail.split("@")[0] ?? "");
      const profile = {
        id: userId || profileEmail,
        email: profileEmail,
        name: profileName
      };
      const hookResult = await onLogin(event, profile, null, user);
      if (hookResult?.userId) userId = String(hookResult.userId);
    }
    try {
      userId = await ensureSessionAfterLogin({
        event,
        sessionAdapter,
        userId,
        autoCreateSession,
        onLoginMode
      });
    } catch (error3) {
      if (error3 instanceof AuthPrincipalResolutionError) {
        return jsonResponse({ ok: false, error: error3.message }, error3.status);
      }
      throw error3;
    }
    if (event.request.method === "GET") {
      throw redirect(302, redirectAfterLogin);
    }
    return jsonResponse({ ok: true, user: sanitizeUser2(user) });
  };
}
function toUint8Array(value) {
  if (!value) return new Uint8Array();
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "string") {
    return decodeBase64url(value);
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return Uint8Array.from(value);
  }
  return new Uint8Array();
}
function encodeCredential(value) {
  return encodeBase64url(toUint8Array(value));
}
var registrationResponseSchema = z.custom(
  (value) => typeof value === "object" && value !== null && typeof value["id"] === "string" && (typeof value["rawId"] === "string" && value["type"] === "public-key" || !("rawId" in value || "type" in value))
);
var authenticationResponseSchema = z.custom(
  (value) => typeof value === "object" && value !== null && typeof value["id"] === "string" && (typeof value["rawId"] === "string" && value["type"] === "public-key" || !("rawId" in value || "type" in value))
);
var registerVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  credential: registrationResponseSchema,
  name: z.string().optional()
});
var loginOptionsRequestSchema = z.object({
  email: z.string().optional()
});
var loginVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  credential: authenticationResponseSchema
});
function toChallengeRecord(value) {
  if (!value) return null;
  const id = value["id"] ?? value["challengeId"];
  const userId = value["userId"];
  const challenge = value["challenge"];
  const type = value["type"];
  const expiresAt = value["expiresAt"];
  if (typeof id !== "string") return null;
  if (userId !== null && userId !== void 0 && typeof userId !== "string") {
    return null;
  }
  if (typeof challenge !== "string") return null;
  if (typeof type !== "string") return null;
  if (typeof expiresAt !== "string" && typeof expiresAt !== "number" && !(expiresAt instanceof Date)) {
    return null;
  }
  return {
    id,
    userId: userId ?? null,
    challenge,
    type,
    expiresAt
  };
}
function toCredentialRecord(value) {
  if (!value) return null;
  const credentialId = value["credentialId"];
  const userId = value["userId"];
  const publicKey = value["publicKey"];
  const counter = value["counter"];
  const transports = value["transports"];
  if (typeof credentialId !== "string") return null;
  if (typeof userId !== "string") return null;
  if (typeof publicKey !== "string") return null;
  if (typeof counter !== "number") return null;
  if (transports !== void 0 && transports !== null && (!Array.isArray(transports) || transports.some((entry) => typeof entry !== "string"))) {
    return null;
  }
  return {
    credentialId,
    userId,
    publicKey,
    counter,
    transports: transports ?? null
  };
}
function credentialDescriptorFromRecord(cred) {
  const id = cred["credentialId"] ?? cred["credential_id"];
  const transports = cred["transports"];
  if (typeof id !== "string") return null;
  if (transports !== void 0 && transports !== null) {
    if (!Array.isArray(transports) || transports.some((entry) => typeof entry !== "string")) {
      return { id };
    }
    const filtered = transports.filter(
      (entry) => entry === "ble" || entry === "cable" || entry === "hybrid" || entry === "internal" || entry === "nfc" || entry === "smart-card" || entry === "usb"
    );
    return filtered.length > 0 ? { id, transports: filtered } : { id };
  }
  return { id };
}
function toAuthenticatorTransports(transports) {
  if (!transports) return void 0;
  const filtered = transports.filter(
    (entry) => entry === "ble" || entry === "cable" || entry === "hybrid" || entry === "internal" || entry === "nfc" || entry === "smart-card" || entry === "usb"
  );
  return filtered.length > 0 ? filtered : void 0;
}
function createWebAuthnRegisterOptionsHandler(config) {
  const {
    webauthnAdapter,
    rpName,
    rpID,
    timeout = 6e4,
    attestationType = "none",
    authenticatorSelection,
    supportedAlgorithmIDs,
    getUser = (event) => event.locals.user ?? null
  } = config;
  if (!rpID || !rpName) {
    throw new Error("createWebAuthnRegisterOptionsHandler requires rpID and rpName");
  }
  return async (event) => {
    const user = await getUser(event);
    if (!user || !user.id) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    const credentials = await webauthnAdapter.listCredentials(user.id);
    const excludeCredentials = credentials.map((cred) => credentialDescriptorFromRecord(cred)).filter(
      (cred) => cred !== null
    );
    const optionsInput = {
      rpID,
      rpName,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.email || String(user.id),
      userDisplayName: user.name || user.email || String(user.id),
      timeout,
      attestationType,
      excludeCredentials
    };
    if (authenticatorSelection) {
      optionsInput.authenticatorSelection = authenticatorSelection;
    }
    if (supportedAlgorithmIDs) {
      optionsInput.supportedAlgorithmIDs = supportedAlgorithmIDs;
    }
    const options = await generateRegistrationOptions(optionsInput);
    const challengeId = await generateRandomUUID();
    const expiresAt = new Date(Date.now() + timeout);
    await webauthnAdapter.createChallenge({
      challengeId,
      userId: user.id,
      challenge: options.challenge,
      type: "registration",
      expiresAt
    });
    return jsonResponse({ options, challengeId });
  };
}
function createWebAuthnRegisterVerifyHandler(config) {
  const {
    webauthnAdapter,
    rpID,
    origin,
    requireUserVerification = false,
    onCredentialCreated
  } = config;
  if (!rpID || !origin) {
    throw new Error("createWebAuthnRegisterVerifyHandler requires rpID and origin");
  }
  return async (event) => {
    const data = await parseRequestDataWithSchema(event.request, registerVerifyRequestSchema);
    if (!data) {
      return jsonResponse({ ok: false, error: "Invalid request" }, 400);
    }
    const { challengeId, credential, name } = data;
    const challengeRaw = await webauthnAdapter.getChallenge(challengeId);
    const challenge = toChallengeRecord(challengeRaw);
    if (!challenge) {
      return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
    }
    if (challenge.type !== "registration") {
      return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
    }
    if (new Date(challenge.expiresAt) < /* @__PURE__ */ new Date()) {
      await webauthnAdapter.deleteChallenge(challengeId);
      return jsonResponse({ ok: false, error: "Challenge expired" }, 400);
    }
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification
    });
    if (!verification.verified || !verification.registrationInfo) {
      return jsonResponse({ ok: false, error: "Registration failed" }, 400);
    }
    const registrationInfoRecord = verification.registrationInfo;
    const regCredentialRecord = typeof registrationInfoRecord["credential"] === "object" && registrationInfoRecord["credential"] !== null ? registrationInfoRecord["credential"] : registrationInfoRecord;
    const credentialIdRaw = regCredentialRecord["id"] ?? regCredentialRecord["credentialID"];
    const publicKeyRaw = regCredentialRecord["publicKey"] ?? regCredentialRecord["credentialPublicKey"];
    const counterRaw = regCredentialRecord["counter"];
    const credentialId = typeof credentialIdRaw === "string" ? credentialIdRaw : encodeCredential(credentialIdRaw);
    const publicKey = encodeCredential(publicKeyRaw);
    const counter = typeof counterRaw === "number" ? counterRaw : 0;
    const userId = challenge.userId;
    if (!userId) {
      return jsonResponse({ ok: false, error: "Challenge user missing" }, 400);
    }
    await webauthnAdapter.createCredential({
      userId,
      credentialId,
      publicKey,
      counter,
      transports: credential.response && "transports" in credential.response ? credential.response.transports ?? null : null,
      name: name ?? null
    });
    await webauthnAdapter.deleteChallenge(challengeId);
    if (onCredentialCreated) {
      await onCredentialCreated({ userId, credentialId, publicKey });
    }
    return jsonResponse({ ok: true, credentialId });
  };
}
function createWebAuthnLoginOptionsHandler(config) {
  const {
    webauthnAdapter,
    databaseAdapter,
    rpID,
    timeout = 6e4,
    userVerification = "preferred"
  } = config;
  if (!rpID) {
    throw new Error("createWebAuthnLoginOptionsHandler requires rpID");
  }
  return async (event) => {
    const data = await parseRequestDataWithSchema(event.request, loginOptionsRequestSchema);
    const email = data?.email ? data.email.toLowerCase() : "";
    let user = null;
    if (email && databaseAdapter) {
      user = await databaseAdapter.getUserByEmail(email);
    }
    let allowCredentials;
    if (user) {
      const credentials = await webauthnAdapter.listCredentials(user.id);
      allowCredentials = credentials.map((cred) => credentialDescriptorFromRecord(cred)).filter(
        (cred) => cred !== null
      );
    }
    const optionsInput = {
      rpID,
      timeout,
      userVerification
    };
    if (allowCredentials) {
      optionsInput.allowCredentials = allowCredentials;
    }
    const options = await generateAuthenticationOptions(optionsInput);
    const challengeId = await generateRandomUUID();
    const expiresAt = new Date(Date.now() + timeout);
    await webauthnAdapter.createChallenge({
      challengeId,
      userId: user?.id ?? null,
      challenge: options.challenge,
      type: "authentication",
      expiresAt
    });
    return jsonResponse({ options, challengeId });
  };
}
function createWebAuthnLoginVerifyHandler(config) {
  const {
    webauthnAdapter,
    databaseAdapter,
    sessionAdapter,
    rpID,
    origin,
    redirectAfterLogin = "/",
    requireUserVerification = false,
    onLogin,
    sanitizeUser: sanitizeUser2 = sanitizeUser,
    autoCreateSession = true,
    onLoginMode = "augment"
  } = config;
  if (!rpID || !origin) {
    throw new Error("createWebAuthnLoginVerifyHandler requires rpID and origin");
  }
  return async (event) => {
    const data = await parseRequestDataWithSchema(event.request, loginVerifyRequestSchema);
    if (!data) {
      return jsonResponse({ ok: false, error: "Invalid request" }, 400);
    }
    const { challengeId, credential } = data;
    const challengeRaw = await webauthnAdapter.getChallenge(challengeId);
    const challenge = toChallengeRecord(challengeRaw);
    if (!challenge) {
      auditAuthEvent("webauthn.challenge_missing", { challengeId });
      return jsonResponse({ ok: false, error: "Challenge not found" }, 400);
    }
    if (challenge.type !== "authentication") {
      auditAuthEvent("webauthn.challenge_invalid_type", { challengeId });
      return jsonResponse({ ok: false, error: "Invalid challenge" }, 400);
    }
    const storedCredentialRaw = await webauthnAdapter.getCredential(credential.id);
    const storedCredential = toCredentialRecord(storedCredentialRaw);
    if (!storedCredential) {
      auditAuthEvent("webauthn.credential_missing", {
        credentialId: credential.id
      });
      return jsonResponse({ ok: false, error: "Credential not found" }, 400);
    }
    const credentialInput = {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(toUint8Array(storedCredential.publicKey)),
      counter: storedCredential.counter
    };
    const transports = toAuthenticatorTransports(storedCredential.transports);
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: transports ? { ...credentialInput, transports } : credentialInput,
      requireUserVerification
    });
    if (!verification.verified) {
      auditAuthEvent("webauthn.authentication_failed", {
        credentialId: credential.id
      });
      return jsonResponse({ ok: false, error: "Authentication failed" }, 400);
    }
    await webauthnAdapter.updateCredential(storedCredential.credentialId, {
      counter: verification.authenticationInfo.newCounter ?? storedCredential.counter
    });
    await webauthnAdapter.deleteChallenge(challengeId);
    const user = databaseAdapter ? await databaseAdapter.getUserById(storedCredential.userId) : null;
    let userId = storedCredential.userId;
    if (onLogin) {
      const profile = {
        id: userId,
        email: user?.email ?? "",
        ...user?.name ? { name: user.name } : {}
      };
      const hookResult = await onLogin(event, profile, null, user);
      if (hookResult?.userId) userId = String(hookResult.userId);
    }
    try {
      userId = await ensureSessionAfterLogin({
        event,
        sessionAdapter,
        userId,
        autoCreateSession,
        onLoginMode
      });
    } catch (error3) {
      if (error3 instanceof AuthPrincipalResolutionError) {
        return jsonResponse({ ok: false, error: error3.message }, error3.status);
      }
      throw error3;
    }
    if (event.request.method === "GET") {
      throw redirect(302, redirectAfterLogin);
    }
    return jsonResponse({ ok: true, user: sanitizeUser2(user) });
  };
}

// src/handlers/sessions.ts
function createSessionListHandler(config) {
  const {
    sessionAdapter,
    isAuthenticated = (locals) => !!locals.user,
    getUser = (locals) => locals.user,
    getSession = (locals) => locals.session ?? null
  } = config;
  if (!sessionAdapter) {
    throw new Error("createSessionListHandler requires sessionAdapter");
  }
  return async (event) => {
    if (!isAuthenticated(event.locals)) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    if (typeof sessionAdapter.listSessions !== "function") {
      return jsonResponse(
        { ok: false, error: "Session listing not supported" },
        501
      );
    }
    const user = getUser(event.locals);
    const current = getSession(event.locals);
    const sessions = await sessionAdapter.listSessions(user.id);
    const normalized = sessions.map((session) => ({
      ...session,
      current: current?.id === session.id
    }));
    return jsonResponse({ ok: true, sessions: normalized });
  };
}
function createSessionRevokeHandler(config) {
  const {
    sessionAdapter,
    isAuthenticated = (locals) => !!locals.user,
    getUser = (locals) => locals.user,
    getSession = (locals) => locals.session ?? null
  } = config;
  if (!sessionAdapter) {
    throw new Error("createSessionRevokeHandler requires sessionAdapter");
  }
  return async (event) => {
    if (!isAuthenticated(event.locals)) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    const isUnsupportedError = (error3) => error3 instanceof AuthAdapterCapabilityError || error3 instanceof Error && (error3.message.includes("not support") || error3.message.includes("not implemented"));
    const data = await parseRequestData(event.request);
    const user = getUser(event.locals);
    const current = getSession(event.locals);
    const sessionId = typeof data["sessionId"] === "string" ? data["sessionId"] : typeof data["id"] === "string" ? data["id"] : "";
    const revokeAll = data["all"] === true || data["all"] === "true" || data["all"] === 1;
    const revokeOthers = data["others"] === true || data["others"] === "true" || data["others"] === 1;
    if (sessionId) {
      if (typeof sessionAdapter.listSessions !== "function") {
        return jsonResponse(
          { ok: false, error: "Session listing not supported" },
          501
        );
      }
      const sessions = await sessionAdapter.listSessions(user.id);
      const ownsSession = sessions.some((session) => session.id === sessionId);
      if (!ownsSession) {
        return jsonResponse({ ok: false, error: "Session not found" }, 404);
      }
      if (typeof sessionAdapter.invalidateSession !== "function") {
        return jsonResponse(
          { ok: false, error: "Session invalidation not supported" },
          501
        );
      }
      try {
        await sessionAdapter.invalidateSession(sessionId);
      } catch (error3) {
        if (isUnsupportedError(error3)) {
          return jsonResponse(
            { ok: false, error: "Session invalidation not supported" },
            501
          );
        }
        return jsonResponse({ ok: false, error: "Failed to revoke session" }, 500);
      }
      if (current?.id === sessionId && sessionAdapter.deleteSessionCookie) {
        sessionAdapter.deleteSessionCookie(event.cookies);
      }
      return jsonResponse({ ok: true });
    }
    if (revokeAll) {
      if (typeof sessionAdapter.invalidateUserSessions !== "function") {
        return jsonResponse(
          { ok: false, error: "Bulk session revocation not supported" },
          501
        );
      }
      try {
        await sessionAdapter.invalidateUserSessions(user.id);
      } catch (error3) {
        if (isUnsupportedError(error3)) {
          return jsonResponse(
            { ok: false, error: "Bulk session revocation not supported" },
            501
          );
        }
        return jsonResponse({ ok: false, error: "Failed to revoke sessions" }, 500);
      }
      if (sessionAdapter.deleteSessionCookie) {
        sessionAdapter.deleteSessionCookie(event.cookies);
      }
      return jsonResponse({ ok: true });
    }
    if (revokeOthers) {
      if (typeof sessionAdapter.listSessions !== "function") {
        return jsonResponse(
          { ok: false, error: "Session listing not supported" },
          501
        );
      }
      const sessions = await sessionAdapter.listSessions(user.id);
      if (typeof sessionAdapter.invalidateSession !== "function") {
        return jsonResponse(
          { ok: false, error: "Session invalidation not supported" },
          501
        );
      }
      try {
        await Promise.all(
          sessions.filter((session) => session.id !== current?.id).map((session) => sessionAdapter.invalidateSession(session.id))
        );
      } catch (error3) {
        if (isUnsupportedError(error3)) {
          return jsonResponse(
            { ok: false, error: "Session invalidation not supported" },
            501
          );
        }
        return jsonResponse({ ok: false, error: "Failed to revoke sessions" }, 500);
      }
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ ok: false, error: "Missing revoke target" }, 400);
  };
}

// src/createAuth.ts
init_logger();

// src/security/csrf.ts
var CSRF_COOKIE_NAME = "csrf-token";
var CSRF_HEADER_NAME = "x-csrf-token";
var MemoryCsrfStore = class {
  _data;
  constructor() {
    this._data = /* @__PURE__ */ new Map();
  }
  async get(key) {
    const record = this._data.get(key);
    if (!record) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      this._data.delete(key);
      return null;
    }
    return record;
  }
  async set(key, value, ttlMs) {
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this._data.set(key, { value, expiresAt });
  }
  async delete(key) {
    this._data.delete(key);
  }
};
function bytesToHex2(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
async function createCsrfToken() {
  const bytes = await getRandomBytes(32);
  return bytesToHex2(bytes);
}
async function issueCsrfToken({
  cookies,
  store,
  ttlMs = 60 * 60 * 1e3,
  cookieName = CSRF_COOKIE_NAME,
  secure = true,
  sameSite = "lax",
  path = "/"
} = {}) {
  if (!cookies) {
    throw new Error("issueCsrfToken requires cookies");
  }
  const token = await createCsrfToken();
  if (store) {
    await store.set(token, true, ttlMs);
  }
  cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite,
    path,
    maxAge: Math.floor(ttlMs / 1e3)
  });
  return token;
}
async function validateCsrfRequest({
  request,
  cookies,
  store,
  headerName = CSRF_HEADER_NAME,
  cookieName = CSRF_COOKIE_NAME,
  checkExpiry = false
} = {}) {
  if (!request || !cookies) {
    throw new Error("validateCsrfRequest requires request and cookies");
  }
  const headerToken = request.headers.get(headerName) || "";
  const cookieToken = cookies.get(cookieName) || "";
  if (!timingSafeEqual(headerToken, cookieToken)) {
    return false;
  }
  if (checkExpiry && store) {
    const record = await store.get(cookieToken);
    if (!record) return false;
  }
  return true;
}

// src/security/events.ts
function createAuthEvent(input) {
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...input
  };
}

// src/security/policy.ts
function jsonError(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
function getClientIp(event, trustProxyHeader) {
  if (event.getClientAddress) return event.getClientAddress();
  if (trustProxyHeader) return event.request.headers.get("x-forwarded-for") ?? "unknown";
  return "unknown";
}
function applySecurityPolicy({
  handler,
  routeId,
  settings
}) {
  const limiter = createRateLimiter({
    windowMs: settings.rateLimit.windowMs,
    max: settings.rateLimit.max,
    keyPrefix: settings.rateLimit.keyPrefix
  });
  return async (event) => {
    const method = event.request.method.toUpperCase();
    const routePolicy = settings.routes[routeId] ?? {};
    const csrfMode = routePolicy.csrf ?? settings.csrf.mode;
    const rateMode = routePolicy.rateLimit ?? settings.rateLimit.mode;
    const auditMode = routePolicy.audit ?? settings.audit.mode;
    const ip = getClientIp(event, settings.rateLimit.trustProxyHeader);
    const emit = async (name, severity, status, message, details) => {
      if (auditMode === "off" || !settings.audit.emitter) return;
      const payload = {
        name,
        severity,
        route: routeId,
        method,
        ip,
        ...status !== void 0 ? { status } : {},
        ...message !== void 0 ? { message } : {},
        ...event.locals.user?.id ? { userId: String(event.locals.user.id) } : { userId: null },
        ...{}
      };
      await settings.audit.emitter(createAuthEvent(payload));
    };
    if (rateMode !== "off") {
      const key = `${routeId}:${ip}`;
      const result = await limiter(key);
      if (!result.allowed) {
        await emit("auth.rate_limited", "warn", 429, "Too many requests");
        return jsonError(429, "Too many requests");
      }
    }
    const isStateChanging = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    if (isStateChanging && csrfMode === "required") {
      const valid = await validateCsrfRequest({
        request: event.request,
        cookies: event.cookies,
        headerName: settings.csrf.headerName,
        cookieName: settings.csrf.cookieName,
        checkExpiry: settings.csrf.checkExpiry,
        ...settings.csrf.store ? { store: settings.csrf.store } : {}
      });
      if (!valid) {
        await emit("auth.csrf_failed", "warn", 403, "Invalid CSRF token");
        return jsonError(403, "Invalid CSRF token");
      }
    }
    await emit("auth.request", "info");
    try {
      const response = await handler(event);
      await emit(
        response.status >= 400 ? "auth.failure" : "auth.success",
        response.status >= 400 ? "warn" : "info",
        response.status
      );
      return response;
    } catch (error3) {
      const message = error3 instanceof Error ? error3.message : "Request failed";
      await emit("auth.failure", "error", 500, message);
      throw error3;
    }
  };
}

// src/security/alerts.ts
var DEFAULT_RULES = [
  { eventName: "auth.failure", max: 10, windowMs: 10 * 60 * 1e3, severity: "warn" },
  { eventName: "auth.rate_limited", max: 20, windowMs: 5 * 60 * 1e3, severity: "warn" },
  { eventName: "auth.csrf_failed", max: 10, windowMs: 10 * 60 * 1e3, severity: "error" }
];
function createSecurityAlertObserver({
  rules = DEFAULT_RULES,
  onAlert
} = {}) {
  const windows = /* @__PURE__ */ new Map();
  return async (event) => {
    for (const rule of rules) {
      if (event.name !== rule.eventName) continue;
      const key = `${rule.eventName}:${rule.windowMs}`;
      const now = Date.now();
      const window = windows.get(key) ?? { timestamps: [] };
      const minTs = now - rule.windowMs;
      window.timestamps = window.timestamps.filter((ts) => ts >= minTs);
      window.timestamps.push(now);
      windows.set(key, window);
      if (window.timestamps.length >= rule.max && onAlert) {
        await onAlert({
          type: "threshold_exceeded",
          eventName: rule.eventName,
          severity: rule.severity,
          count: window.timestamps.length,
          windowMs: rule.windowMs,
          timestamp: new Date(now).toISOString()
        });
        window.timestamps = [];
        windows.set(key, window);
      }
    }
  };
}

// src/security/alerting.ts
var DEFAULT_COOLDOWN_MS = 10 * 60 * 1e3;
var DEFAULT_MAX_PER_HOUR = 10;
function createWebhookAlerter({
  url,
  secret = null,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  maxPerHour = DEFAULT_MAX_PER_HOUR,
  timeoutMs = 5e3
} = {}) {
  const lastSent = /* @__PURE__ */ new Map();
  const sentTimestamps = [];
  return async function sendAlert(payload, alertType = "security_alert") {
    if (!url) return false;
    const now = Date.now();
    const last = lastSent.get(alertType);
    if (last && now - last < cooldownMs) return false;
    const hourAgo = now - 60 * 60 * 1e3;
    while (sentTimestamps.length) {
      const first = sentTimestamps[0];
      if (first === void 0 || first >= hourAgo) break;
      sentTimestamps.shift();
    }
    if (sentTimestamps.length >= maxPerHour) return false;
    const body = JSON.stringify({
      alertType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...payload
    });
    const headers = {
      "Content-Type": "application/json"
    };
    if (secret) {
      const signature = await signPayload(body, secret);
      headers["X-Signature"] = signature;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
      if (!response.ok) return false;
      lastSent.set(alertType, now);
      sentTimestamps.push(now);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
}
async function signPayload(body, secret) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  return toHex(new Uint8Array(sig));
}
function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/createAuth.ts
function validateConfig(config) {
  if (!config.adapters.session) {
    throw new Error("createAuth requires adapters.session");
  }
  if (config.magicLink && !config.adapters.magicLink) {
    throw new Error("createAuth magicLink requires adapters.magicLink");
  }
  if (config.webauthn && !config.adapters.webauthn) {
    throw new Error("createAuth webauthn requires adapters.webauthn");
  }
}
function resolveDefaults(config) {
  return {
    urlConfig: {
      login: config.urls?.login ?? "/auth",
      afterLogin: config.urls?.afterLogin ?? "/",
      afterLogout: config.urls?.afterLogout ?? "/"
    },
    cookieConfig: {
      secure: config.cookies?.secure ?? true
    },
    autoCreateSession: config.autoCreateSession ?? true,
    requireVerifiedEmailForLinking: config.requireVerifiedEmailForLinking ?? true,
    isAuthenticated: config.isAuthenticated ?? ((locals) => !!locals.user)
  };
}
function resolveSecurity(config) {
  const profile = config.profile ?? "secure";
  const secureDefaults = {
    basic: {
      csrf: { mode: "off" },
      rateLimit: { mode: "optional", max: 20, windowMs: 6e4, keyPrefix: "auth" },
      audit: { mode: "optional" }
    },
    secure: {
      csrf: { mode: "optional", checkExpiry: false },
      rateLimit: {
        mode: "required",
        max: 20,
        windowMs: 6e4,
        keyPrefix: "auth",
        trustProxyHeader: false
      },
      audit: { mode: "required" },
      alerts: { enabled: true }
    },
    strict: {
      csrf: { mode: "required", checkExpiry: true },
      rateLimit: {
        mode: "required",
        max: 10,
        windowMs: 6e4,
        keyPrefix: "auth",
        trustProxyHeader: false
      },
      audit: { mode: "required" },
      alerts: { enabled: true }
    }
  };
  const base = secureDefaults[profile];
  const merged = {
    csrf: { ...base.csrf, ...config.security?.csrf },
    rateLimit: { ...base.rateLimit, ...config.security?.rateLimit },
    audit: { ...base.audit, ...config.security?.audit },
    alerts: { ...base.alerts, ...config.security?.alerts }
  };
  const csrfStore = new MemoryCsrfStore();
  const webhookUrl = typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_URL"] : void 0;
  const webhookSecret = typeof process !== "undefined" ? process.env["SECURITY_WEBHOOK_SECRET"] : void 0;
  const alerter = merged.alerts?.enabled === false ? null : createWebhookAlerter({
    url: webhookUrl ?? null,
    secret: webhookSecret ?? null
  });
  const alertObserver = createSecurityAlertObserver({
    onAlert: async (alert) => {
      await merged.alerts?.onAlert?.(alert);
      if (alerter) {
        await alerter({ ...alert }, "auth_threshold");
      }
    }
  });
  const emitter = async (event) => {
    await merged.audit?.emitter?.(event);
    await alertObserver(event);
  };
  return {
    profile,
    csrf: {
      mode: merged.csrf?.mode ?? "optional",
      cookieName: merged.csrf?.cookieName ?? CSRF_COOKIE_NAME,
      headerName: merged.csrf?.headerName ?? CSRF_HEADER_NAME,
      checkExpiry: merged.csrf?.checkExpiry ?? false,
      store: csrfStore
    },
    rateLimit: {
      mode: merged.rateLimit?.mode ?? "optional",
      max: merged.rateLimit?.max ?? 20,
      windowMs: merged.rateLimit?.windowMs ?? 6e4,
      keyPrefix: merged.rateLimit?.keyPrefix ?? "auth",
      trustProxyHeader: merged.rateLimit?.trustProxyHeader ?? false
    },
    audit: {
      mode: merged.audit?.mode ?? "optional",
      emitter
    },
    routes: {
      "oauth.login": { csrf: "off", rateLimit: "optional" },
      "oauth.callback": { csrf: "off", rateLimit: "optional" },
      "auth.logout": { csrf: merged.csrf?.mode ?? "optional" },
      "magic.request": { csrf: merged.csrf?.mode ?? "optional" },
      "magic.verify": { csrf: merged.csrf?.mode ?? "optional" },
      "webauthn.register.options": { csrf: merged.csrf?.mode ?? "optional" },
      "webauthn.register.verify": { csrf: merged.csrf?.mode ?? "optional" },
      "webauthn.login.options": { csrf: merged.csrf?.mode ?? "optional" },
      "webauthn.login.verify": { csrf: merged.csrf?.mode ?? "optional" },
      "sessions.list": { csrf: "off" },
      "sessions.revoke": { csrf: merged.csrf?.mode ?? "optional" }
    }
  };
}
function applyPolicies(handlers, security) {
  const wrapped = {
    ...handlers,
    logout: applySecurityPolicy({
      handler: handlers.logout,
      routeId: "auth.logout",
      settings: security
    })
  };
  if (handlers.login) {
    wrapped.login = applySecurityPolicy({
      handler: handlers.login,
      routeId: "oauth.login",
      settings: security
    });
  }
  if (handlers.callback) {
    wrapped.callback = applySecurityPolicy({
      handler: handlers.callback,
      routeId: "oauth.callback",
      settings: security
    });
  }
  if (handlers.magicLink) {
    wrapped.magicLink = {
      request: applySecurityPolicy({
        handler: handlers.magicLink.request,
        routeId: "magic.request",
        settings: security
      }),
      verify: applySecurityPolicy({
        handler: handlers.magicLink.verify,
        routeId: "magic.verify",
        settings: security
      })
    };
  }
  if (handlers.webauthn) {
    wrapped.webauthn = {
      registerOptions: applySecurityPolicy({
        handler: handlers.webauthn.registerOptions,
        routeId: "webauthn.register.options",
        settings: security
      }),
      registerVerify: applySecurityPolicy({
        handler: handlers.webauthn.registerVerify,
        routeId: "webauthn.register.verify",
        settings: security
      }),
      loginOptions: applySecurityPolicy({
        handler: handlers.webauthn.loginOptions,
        routeId: "webauthn.login.options",
        settings: security
      }),
      loginVerify: applySecurityPolicy({
        handler: handlers.webauthn.loginVerify,
        routeId: "webauthn.login.verify",
        settings: security
      })
    };
  }
  if (handlers.sessions) {
    wrapped.sessions = {
      list: applySecurityPolicy({
        handler: handlers.sessions.list,
        routeId: "sessions.list",
        settings: security
      }),
      revoke: applySecurityPolicy({
        handler: handlers.sessions.revoke,
        routeId: "sessions.revoke",
        settings: security
      })
    };
  }
  return wrapped;
}
function resolveOnLoginUserId(hookResult, fallbackUserId) {
  if (hookResult && typeof hookResult === "object" && hookResult["userId"]) {
    return String(hookResult["userId"]);
  }
  return fallbackUserId;
}
function normalizeMagicLinkConfig(magicLink, globalHooks, defaultSecureCookies) {
  const settings = magicLink.settings ?? {};
  const limits = magicLink.limits ?? {};
  const hooks = magicLink.hooks ?? {};
  const normalized = {
    sendEmail: magicLink.send.email,
    secureCookies: settings.secureCookies ?? defaultSecureCookies,
    ...settings.allowSignup !== void 0 ? { allowSignup: settings.allowSignup } : {},
    ...settings.expiresInMs !== void 0 ? { expiresInMs: settings.expiresInMs } : {},
    ...settings.magicLinkPath !== void 0 ? { magicLinkPath: settings.magicLinkPath } : {},
    ...settings.includeOtp !== void 0 ? { includeOtp: settings.includeOtp } : {},
    ...settings.otpDigits !== void 0 ? { otpDigits: settings.otpDigits } : {},
    ...settings.singleUsePerEmail !== void 0 ? { singleUsePerEmail: settings.singleUsePerEmail } : {},
    ...settings.normalizeEmail !== void 0 ? { normalizeEmail: settings.normalizeEmail } : {},
    ...settings.exposeToken !== void 0 ? { exposeToken: settings.exposeToken } : {},
    ...settings.baseUrl !== void 0 ? { baseUrl: settings.baseUrl } : {},
    ...limits.request !== void 0 ? { rateLimit: limits.request } : {},
    ...limits.verify !== void 0 ? { verifyRateLimit: limits.verify } : {},
    ...limits.verifyMax !== void 0 ? { verifyRateLimitMax: limits.verifyMax } : {},
    ...limits.verifyWindowMs !== void 0 ? { verifyRateLimitWindowMs: limits.verifyWindowMs } : {},
    ...hooks.getMetadata !== void 0 ? { getMetadata: hooks.getMetadata } : {},
    ...hooks.createUser !== void 0 ? { createUser: hooks.createUser } : {},
    ...hooks.sanitizeUser !== void 0 ? { sanitizeUser: hooks.sanitizeUser } : {},
    ...settings.trustProxyHeader !== void 0 ? { trustProxyHeader: settings.trustProxyHeader } : {},
    ...settings.key !== void 0 ? { key: settings.key } : {}
  };
  const onLogin = hooks.onLogin ?? globalHooks?.onLogin;
  return onLogin ? { ...normalized, onLogin } : normalized;
}
function createHandlers(config, defaults, security) {
  const {
    adapters,
    providers = {},
    hooks = {},
    magicLink,
    webauthn,
    sessions,
    sanitizeUser: sanitizeUser2 = (user) => user
  } = config;
  const { urlConfig, cookieConfig, autoCreateSession, requireVerifiedEmailForLinking, isAuthenticated } = defaults;
  const onLoginMode = hooks.onLoginMode ?? "augment";
  getLogger();
  const hasProviders = Object.keys(providers).length > 0;
  let loginHandler;
  let callbackHandler;
  if (hasProviders) {
    loginHandler = createLoginHandler({
      providers,
      redirectAfterLogin: urlConfig.afterLogin,
      secureCookies: cookieConfig.secure,
      isAuthenticated
    });
    const callbackConfig = {
      providers: Object.fromEntries(
        Object.entries(providers).map(
          ([name, providerConfig]) => [name, providerConfig.provider]
        )
      ),
      redirectAfterLogin: urlConfig.afterLogin,
      isAuthenticated,
      onAuthenticated: async (event, profile, tokens) => {
        const providerName = String(event.params["provider"] ?? "");
        let user = null;
        if (adapters.user) {
          try {
            user = await adapters.user.getUserByProviderId(providerName, profile.id);
          } catch {
            user = null;
          }
          const canLinkByEmail = profile.email ? requireVerifiedEmailForLinking ? profile.verified_email === true : true : false;
          if (!user && canLinkByEmail) {
            user = await adapters.user.getUserByEmail(profile.email);
          }
          if (!user) {
            user = await adapters.user.createUser(profile);
          }
          if (user && adapters.user.linkOAuthAccount) {
            try {
              await adapters.user.linkOAuthAccount(user.id, providerName, profile.id);
            } catch {
            }
          }
        }
        let userId = user?.id ? String(user.id) : null;
        if (hooks.onLogin) {
          const hookResult = await hooks.onLogin(event, profile, tokens, user);
          userId = resolveOnLoginUserId(hookResult, userId);
        }
        userId = await ensureSessionAfterLogin({
          event,
          sessionAdapter: adapters.session,
          userId,
          autoCreateSession,
          onLoginMode
        });
        if (adapters.oauthToken) {
          await adapters.oauthToken.storeTokens(userId, providerName, tokens);
        }
      },
      ...hooks.onError ? {
        onError: async (event, error3) => {
          await hooks.onError?.(event, error3);
        }
      } : {}
    };
    callbackHandler = createCallbackHandler(callbackConfig);
  }
  const logoutHandler = createLogoutHandler({
    sessionAdapter: adapters.session,
    redirectAfterLogout: urlConfig.afterLogout,
    getSession: (locals) => locals.session ?? null,
    ...hooks.onLogout ? {
      onLogout: async (event) => {
        await hooks.onLogout?.(event);
      }
    } : {}
  });
  const handleHooks = async ({ event, resolve }) => {
    const method = event.request.method.toUpperCase();
    const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (safeMethod && security.csrf.mode !== "off") {
      const existingToken = event.cookies.get(security.csrf.cookieName);
      if (!existingToken) {
        await issueCsrfToken({
          cookies: event.cookies,
          cookieName: security.csrf.cookieName,
          secure: defaults.cookieConfig.secure,
          ...security.csrf.store ? { store: security.csrf.store } : {}
        });
      }
    }
    const sessionCookieName = adapters.session["cookieName"] ?? "session";
    const sessionId = event.cookies.get(sessionCookieName);
    if (!sessionId) {
      event.locals.session = null;
      event.locals.user = null;
      return resolve(event);
    }
    const { session, user } = await adapters.session.validateSession(sessionId);
    event.locals.session = session;
    event.locals.user = sanitizeUser2(user);
    if (session && user) {
      if (hooks.onSessionValidated) {
        await hooks.onSessionValidated(event, session, user);
      }
      if (session.fresh) {
        adapters.session.setSessionCookie?.(event.cookies, session);
      }
    } else {
      adapters.session.deleteSessionCookie?.(event.cookies);
    }
    return resolve(event);
  };
  const handlers = {
    logout: logoutHandler,
    hooks: handleHooks
  };
  if (loginHandler) handlers.login = loginHandler;
  if (callbackHandler) handlers.callback = callbackHandler;
  if (magicLink) {
    const normalizedMagicLink = normalizeMagicLinkConfig(
      magicLink,
      hooks,
      cookieConfig.secure
    );
    const requestConfig = {
      ...normalizedMagicLink,
      magicLinkAdapter: adapters.magicLink,
      ...adapters.user ? { databaseAdapter: adapters.user } : {}
    };
    const verifyConfig = {
      ...normalizedMagicLink,
      magicLinkAdapter: adapters.magicLink,
      sessionAdapter: adapters.session,
      autoCreateSession,
      onLoginMode,
      redirectAfterLogin: urlConfig.afterLogin,
      isAuthenticated,
      ...normalizedMagicLink["sanitizeUser"] === void 0 ? { sanitizeUser: sanitizeUser2 } : {},
      ...adapters.user ? { databaseAdapter: adapters.user } : {}
    };
    handlers.magicLink = {
      request: createMagicLinkRequestHandler(requestConfig),
      verify: createMagicLinkVerifyHandler(verifyConfig)
    };
  }
  if (webauthn) {
    const attestationType = webauthn.attestation === "indirect" ? "none" : webauthn.attestation;
    const registerOptionsConfig = {
      webauthnAdapter: adapters.webauthn,
      rpID: webauthn.rpID ?? "",
      rpName: webauthn.rpName ?? "Passkey",
      attestationType,
      ...webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {},
      ...webauthn.userVerification ? { userVerification: webauthn.userVerification } : {}
    };
    const registerVerifyConfig = {
      webauthnAdapter: adapters.webauthn,
      rpID: webauthn.rpID ?? "",
      origin: webauthn.origin ?? "",
      requireUserVerification: webauthn.userVerification === "required"
    };
    const loginOptionsConfig = {
      webauthnAdapter: adapters.webauthn,
      rpID: webauthn.rpID ?? "",
      ...webauthn.timeoutMs ? { timeout: webauthn.timeoutMs } : {},
      ...webauthn.userVerification ? { userVerification: webauthn.userVerification } : {},
      ...adapters.user ? { databaseAdapter: adapters.user } : {}
    };
    const loginVerifyConfig = {
      webauthnAdapter: adapters.webauthn,
      sessionAdapter: adapters.session,
      rpID: webauthn.rpID ?? "",
      origin: webauthn.origin ?? "",
      redirectAfterLogin: urlConfig.afterLogin,
      requireUserVerification: webauthn.userVerification === "required",
      autoCreateSession,
      onLoginMode,
      sanitizeUser: sanitizeUser2,
      ...adapters.user ? { databaseAdapter: adapters.user } : {}
    };
    const webauthnOnLogin = webauthn.hooks?.onLogin ?? hooks.onLogin;
    if (webauthnOnLogin) {
      loginVerifyConfig.onLogin = webauthnOnLogin;
    }
    handlers.webauthn = {
      registerOptions: createWebAuthnRegisterOptionsHandler(registerOptionsConfig),
      registerVerify: createWebAuthnRegisterVerifyHandler(registerVerifyConfig),
      loginOptions: createWebAuthnLoginOptionsHandler(loginOptionsConfig),
      loginVerify: createWebAuthnLoginVerifyHandler(loginVerifyConfig)
    };
  }
  if (sessions) {
    handlers.sessions = {
      list: createSessionListHandler({
        ...sessions,
        sessionAdapter: adapters.session,
        isAuthenticated
      }),
      revoke: createSessionRevokeHandler({
        ...sessions,
        sessionAdapter: adapters.session,
        isAuthenticated
      })
    };
  }
  return handlers;
}
function buildRoutes(handlers) {
  return {
    login: () => {
      if (!handlers.login) throw new Error("OAuth login handler not configured");
      return { GET: handlers.login };
    },
    callback: () => {
      if (!handlers.callback) throw new Error("OAuth callback handler not configured");
      return { GET: handlers.callback };
    },
    logout: () => ({ POST: handlers.logout }),
    magicLink: () => {
      if (!handlers.magicLink) throw new Error("Magic link handlers not configured");
      return { POST: handlers.magicLink.request };
    },
    magicLinkVerify: () => {
      if (!handlers.magicLink) throw new Error("Magic link handlers not configured");
      return { GET: handlers.magicLink.verify, POST: handlers.magicLink.verify };
    },
    passkeyRegisterOptions: () => {
      if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
      return { POST: handlers.webauthn.registerOptions };
    },
    passkeyRegisterVerify: () => {
      if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
      return { POST: handlers.webauthn.registerVerify };
    },
    passkeyLoginOptions: () => {
      if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
      return { POST: handlers.webauthn.loginOptions };
    },
    passkeyLoginVerify: () => {
      if (!handlers.webauthn) throw new Error("WebAuthn handlers not configured");
      return { POST: handlers.webauthn.loginVerify };
    },
    sessions: () => {
      if (!handlers.sessions) throw new Error("Session handlers not configured");
      return { GET: handlers.sessions.list, POST: handlers.sessions.revoke };
    }
  };
}
function createUtils(isAuthenticated) {
  return {
    isAuthenticated: (locals) => isAuthenticated(locals),
    getUser: (locals) => locals.user,
    getSession: (locals) => locals.session
  };
}
function createAuth(config) {
  setLogger(config.logger);
  validateConfig(config);
  const defaults = resolveDefaults(config);
  const security = resolveSecurity(config);
  const handlers = applyPolicies(createHandlers(config, defaults, security), security);
  const routes = buildRoutes(handlers);
  const instance = {
    adapters: config.adapters,
    providers: config.providers ?? {},
    urls: defaults.urlConfig,
    cookies: defaults.cookieConfig,
    profile: security.profile,
    security,
    hooks: config.hooks ?? {},
    handlers,
    routes,
    utils: createUtils(defaults.isAuthenticated)
  };
  return instance;
}
function normalizeBasePath(input) {
  const raw = input ?? "/auth";
  const trimmed = raw.endsWith("/") && raw.length > 1 ? raw.slice(0, -1) : raw;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function splitRoutedPath(pathname, basePath) {
  if (!pathname.startsWith(basePath)) return [];
  const rest = pathname.slice(basePath.length);
  const normalized = rest.startsWith("/") ? rest.slice(1) : rest;
  if (!normalized) return [];
  return normalized.split("/").filter((part) => part.length > 0);
}
function hasSessionPrincipal(locals) {
  return !!locals.session && !!locals.user;
}
function resolveUserRoles(user) {
  const roles = [];
  if (typeof user.role === "string" && user.role.length > 0) {
    roles.push(user.role);
  }
  const settings = user.settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const maybeRoles = settings["roles"];
    if (Array.isArray(maybeRoles)) {
      for (const entry of maybeRoles) {
        if (typeof entry === "string" && entry.length > 0) {
          roles.push(entry);
        }
      }
    }
  }
  return Array.from(new Set(roles));
}
var GoobitsAuth = class {
  core;
  routing;
  defaultHandlers;
  constructor(config) {
    const { routing, adapter, adapters, ...rest } = config;
    const resolvedAdapters = adapter ?? adapters;
    if (!resolvedAdapters) {
      throw new Error("GoobitsAuth requires 'adapter' (or legacy 'adapters') configuration");
    }
    const authConfig = {
      ...rest,
      adapters: resolvedAdapters
    };
    this.core = createAuth(authConfig);
    const basePath = normalizeBasePath(routing?.basePath);
    this.routing = {
      basePath,
      signInPath: routing?.signInPath ?? `${basePath}/signin`,
      signOutPath: routing?.signOutPath ?? `${basePath}/signout`
    };
    this.defaultHandlers = this.createHandlers();
  }
  get adapter() {
    return this.core.adapters;
  }
  get providers() {
    return this.core.providers;
  }
  get handlers() {
    return this.defaultHandlers;
  }
  handle() {
    return async ({ event, resolve }) => {
      const baseEvent = event;
      const response = await this.core.handlers.hooks({
        event: baseEvent,
        resolve: async (nextEvent) => {
          const locals2 = nextEvent.locals;
          locals2.auth = hasSessionPrincipal(nextEvent.locals) ? { session: nextEvent.locals.session, user: nextEvent.locals.user } : null;
          return resolve(nextEvent);
        }
      });
      const locals = event.locals;
      if (locals.auth === void 0) {
        locals.auth = hasSessionPrincipal(event.locals) ? { session: event.locals.session, user: event.locals.user } : null;
      }
      return response;
    };
  }
  createHandlers(options) {
    const basePath = normalizeBasePath(options?.basePath ?? this.routing.basePath);
    const dispatch = async (event) => {
      const method = event.request.method.toUpperCase();
      if (method !== "GET" && method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      const segments = splitRoutedPath(event.url.pathname, basePath);
      const target = this.resolveTarget({
        event,
        segments,
        method
      });
      if (!target) {
        return new Response("Not Found", { status: 404 });
      }
      if (target.method !== method) {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return target.handler(event);
    };
    return {
      GET: dispatch,
      POST: dispatch
    };
  }
  async getSession(event) {
    if (hasSessionPrincipal(event.locals)) {
      return {
        session: event.locals.session,
        user: event.locals.user
      };
    }
    const sessionAdapter = this.core.adapters.session;
    const cookieName = sessionAdapter["cookieName"] ?? "session";
    const sessionId = event.cookies.get(cookieName);
    if (!sessionId) {
      return null;
    }
    const { session, user } = await sessionAdapter.validateSession(sessionId);
    event.locals.session = session;
    event.locals.user = user;
    const locals = event.locals;
    locals.auth = session && user ? { session, user } : null;
    return locals.auth;
  }
  async requireUser(event) {
    const principal = await this.getSession(event);
    if (!principal) {
      throw redirect(302, this.routing.signInPath);
    }
    return principal.user;
  }
  async requireRole(event, role, options) {
    const user = await this.requireUser(event);
    const roles = options?.resolveRoles ? options.resolveRoles(user) : resolveUserRoles(user);
    const required = Array.isArray(role) ? role : [role];
    const allowed = required.some((entry) => roles.includes(entry));
    if (!allowed) {
      const emitter = this.core.security.audit.emitter;
      await emitter?.({
        name: "authz.denied",
        severity: "warn",
        route: event.url.pathname,
        method: event.request.method,
        status: 403,
        message: "Missing required role",
        userId: user.id,
        details: {
          requiredRoles: required,
          actorRoles: roles
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      throw error(403, "Forbidden");
    }
    return user;
  }
  resolveTarget(input) {
    const { event, segments, method } = input;
    const handlers = this.core.handlers;
    if (segments.length === 2 && segments[0] === "signin" && method === "GET") {
      const provider = segments[1];
      if (!provider || !handlers.login) return null;
      event.params["provider"] = provider;
      return { method: "GET", handler: handlers.login };
    }
    if (segments.length === 2 && segments[0] === "callback" && method === "GET") {
      const provider = segments[1];
      if (!provider || !handlers.callback) return null;
      event.params["provider"] = provider;
      return { method: "GET", handler: handlers.callback };
    }
    if (segments.length === 1 && (segments[0] === "signout" || segments[0] === "logout")) {
      return { method: "POST", handler: handlers.logout };
    }
    if (segments.length === 1 && segments[0] === "magic-link") {
      if (!handlers.magicLink) return null;
      return { method: "POST", handler: handlers.magicLink.request };
    }
    if (segments.length === 2 && segments[0] === "magic-link" && segments[1] === "verify") {
      if (!handlers.magicLink) return null;
      return { method, handler: handlers.magicLink.verify };
    }
    if (segments.length === 3 && segments[0] === "passkey" && segments[1] === "register") {
      if (!handlers.webauthn) return null;
      if (segments[2] === "options") {
        return { method: "POST", handler: handlers.webauthn.registerOptions };
      }
      if (segments[2] === "verify") {
        return { method: "POST", handler: handlers.webauthn.registerVerify };
      }
    }
    if (segments.length === 3 && segments[0] === "passkey" && segments[1] === "login") {
      if (!handlers.webauthn) return null;
      if (segments[2] === "options") {
        return { method: "POST", handler: handlers.webauthn.loginOptions };
      }
      if (segments[2] === "verify") {
        return { method: "POST", handler: handlers.webauthn.loginVerify };
      }
    }
    if (segments.length === 1 && segments[0] === "sessions") {
      if (!handlers.sessions) return null;
      return method === "GET" ? { method: "GET", handler: handlers.sessions.list } : { method: "POST", handler: handlers.sessions.revoke };
    }
    if (segments.length === 1 && handlers.login && method === "GET") {
      const provider = segments[0];
      if (!provider) return null;
      event.params["provider"] = provider;
      return { method: "GET", handler: handlers.login };
    }
    if (segments.length === 2 && handlers.callback && method === "GET" && segments[1] === "callback") {
      const provider = segments[0];
      if (!provider) return null;
      event.params["provider"] = provider;
      return { method: "GET", handler: handlers.callback };
    }
    return null;
  }
};

export { GoobitsAuth, createAuth };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map