import { redirect, error } from '@sveltejs/kit';
import { OAuth2RequestError, generateState, generateCodeVerifier } from 'arctic';
import { encodeBase64url, decodeBase64url } from '@oslojs/encoding';
import { z } from 'zod';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/utils/logger.ts
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

// src/utils/crypto.ts
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
var SHA_256, HEX_STRINGS, CHAR_TO_NIBBLE;
var init_crypto = __esm({
  "src/utils/crypto.ts"() {
    SHA_256 = "SHA-256";
    HEX_STRINGS = new Array(256);
    for (let i = 0; i < 256; i++) {
      HEX_STRINGS[i] = i.toString(16).padStart(2, "0");
    }
    CHAR_TO_NIBBLE = new Array(127).fill(-1);
    "0123456789abcdefABCDEF".split("").forEach((c) => {
      CHAR_TO_NIBBLE[c.charCodeAt(0)] = parseInt(c, 16);
    });
  }
});

// src/adapters/verification-token/base.ts
var init_base = __esm({
  "src/adapters/verification-token/base.ts"() {
  }
});

// src/utils/tokens.ts
var tokens_exports = {};
__export(tokens_exports, {
  VERIFICATION_TOKEN_TYPES: () => VERIFICATION_TOKEN_TYPES,
  consumeVerificationToken: () => consumeVerificationToken,
  createVerificationToken: () => createVerificationToken,
  getUserForVerificationToken: () => getUserForVerificationToken
});
async function createVerificationToken({
  adapter,
  userId,
  type,
  expiresInMs = DEFAULT_TOKEN_EXPIRATION_MS
}) {
  const tokenValue = await generateRandomUUID();
  const tokenHash = await sha256Hex(tokenValue);
  const expiresAt = new Date(Date.now() + expiresInMs);
  await adapter.deleteByUserAndType({ userId, type });
  await adapter.create({
    userId,
    type,
    token: tokenHash,
    expiresAt
  });
  return tokenValue;
}
async function consumeVerificationToken({
  adapter,
  token,
  type,
  sanitizeUser: sanitizeUser2 = (user) => user
}) {
  const tokenHash = await sha256Hex(token);
  let record = await adapter.findByToken({ token: tokenHash, type });
  if (!record) {
    record = await adapter.findByToken({ token, type });
  }
  if (!record) {
    return null;
  }
  await adapter.deleteById(record.token.id);
  if (record.token.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return sanitizeUser2(record.user);
}
async function getUserForVerificationToken({
  adapter,
  token,
  type,
  sanitizeUser: sanitizeUser2 = (user) => user
}) {
  const tokenHash = await sha256Hex(token);
  let record = await adapter.findByToken({ token: tokenHash, type });
  if (!record) {
    record = await adapter.findByToken({ token, type });
  }
  if (!record) {
    return null;
  }
  if (record.token.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return sanitizeUser2(record.user);
}
var DEFAULT_TOKEN_EXPIRATION_MS, VERIFICATION_TOKEN_TYPES;
var init_tokens = __esm({
  "src/utils/tokens.ts"() {
    init_crypto();
    init_base();
    DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1e3;
    VERIFICATION_TOKEN_TYPES = {
      EMAIL_VERIFICATION: "email_verification",
      PASSWORD_RESET: "password_reset",
      EMAIL_UPDATE: "email_update"
    };
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
  } catch (error2) {
    if (callbacks.onError) {
      await callbacks.onError(error2);
    }
    cleanupOAuthCookies(cookies, provider);
    throw error2;
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
    } catch (error2) {
      if (error2 && typeof error2 === "object" && "status" in error2 && error2.status === 302) {
        throw error2;
      }
      log.error?.("Error during logout:", error2);
      throw redirect(302, redirectAfterLogout);
    }
  };
}
function createLogoutAction(config) {
  const handler = createLogoutHandler(config);
  return {
    default: handler
  };
}

// src/utils/sanitize.ts
function sanitizeUser(user) {
  if (!user) return null;
  const { password: _password, token: _token, ...safeUser } = user;
  return safeUser;
}

// src/handlers/signup.ts
init_logger();
function getRateLimitKey(event, rateLimit) {
  if (rateLimit?.key) return rateLimit.key(event);
  if (event.getClientAddress) return event.getClientAddress();
  if (rateLimit?.trustProxyHeader) {
    return event.request.headers.get("x-forwarded-for") || "unknown";
  }
  return "unknown";
}
function createSignupHandler(config) {
  const {
    credentialsProvider,
    userAdapter,
    sessionAdapter,
    verificationTokenAdapter,
    onSignup,
    sendVerificationEmail,
    csrf,
    rateLimit,
    redirectTo = "/",
    autoLogin = true,
    sanitizeUser: sanitizeUser2 = sanitizeUser,
    fields,
    metadataFields,
    getSignupMetadata
  } = config;
  const log = getLogger();
  return async (event) => {
    if (csrf?.validate) {
      const valid = await csrf.validate(event);
      if (!valid) {
        return {
          error: csrf.errorMessage || "Invalid CSRF token",
          success: false
        };
      }
    }
    if (rateLimit?.check) {
      const key = getRateLimitKey(event, rateLimit);
      const result = await rateLimit.check(key);
      if (!result?.allowed) {
        return {
          error: "Too many attempts. Try again later.",
          success: false
        };
      }
    }
    const formData = await event.request.formData();
    const emailFieldName = fields?.email ?? "email";
    const passwordFieldName = fields?.password ?? "password";
    const nameFieldName = fields?.name ?? "name";
    const email = formData.get(emailFieldName)?.toString();
    const password = formData.get(passwordFieldName)?.toString();
    const name = formData.get(nameFieldName)?.toString();
    if (!email || !password) {
      return {
        error: "Email and password are required",
        success: false
      };
    }
    try {
      const existingUser = await userAdapter.getUserByEmail(email);
      if (existingUser) {
        return {
          error: "An account with this email already exists",
          success: false
        };
      }
      const signUpInput = {
        email,
        password,
        userAdapter
      };
      if (name) signUpInput.name = name;
      if (metadataFields?.length) {
        signUpInput.metadata = {};
        for (const field of metadataFields) {
          const value = formData.get(field);
          if (typeof value === "string" && value.trim().length > 0) {
            signUpInput.metadata[field] = value;
          }
        }
      }
      if (getSignupMetadata) {
        const extra = await getSignupMetadata(formData);
        signUpInput.metadata = {
          ...signUpInput.metadata ?? {},
          ...extra
        };
      }
      const user = await credentialsProvider.signUp(signUpInput);
      const safeUser = sanitizeUser2(user);
      if (onSignup) {
        await onSignup(safeUser);
      }
      if (verificationTokenAdapter && sendVerificationEmail) {
        try {
          const { createVerificationToken: createVerificationToken2, VERIFICATION_TOKEN_TYPES: VERIFICATION_TOKEN_TYPES2 } = await Promise.resolve().then(() => (init_tokens(), tokens_exports));
          const token = await createVerificationToken2({
            adapter: verificationTokenAdapter,
            userId: user.id,
            type: VERIFICATION_TOKEN_TYPES2.EMAIL_VERIFICATION
          });
          await sendVerificationEmail(user.email, token);
        } catch (emailError) {
          log.error?.(
            "[Signup] Failed to send verification email:",
            emailError
          );
        }
      }
      if (autoLogin && sessionAdapter) {
        const session = await sessionAdapter.createSession(user.id);
        sessionAdapter.setSessionCookie(event.cookies, session);
      }
      if (redirectTo) {
        throw redirect(303, redirectTo);
      }
      return {
        success: true,
        user: safeUser
      };
    } catch (error2) {
      log.error?.("[Signup] Error:", error2);
      if (error2 && typeof error2 === "object" && "status" in error2 && (error2.status === 302 || error2.status === 303)) {
        throw error2;
      }
      return {
        error: (error2 instanceof Error ? error2.message : void 0) || "An error occurred during signup",
        success: false
      };
    }
  };
}
init_logger();
function getRateLimitKey2(event, rateLimit) {
  if (rateLimit?.key) return rateLimit.key(event);
  if (event.getClientAddress) return event.getClientAddress();
  if (rateLimit?.trustProxyHeader) {
    return event.request.headers.get("x-forwarded-for") || "unknown";
  }
  return "unknown";
}
function createSigninHandler(config) {
  const {
    credentialsProvider,
    userAdapter,
    sessionAdapter,
    onSignin,
    csrf,
    rateLimit,
    redirectTo = "/",
    sanitizeUser: sanitizeUser2 = sanitizeUser,
    fields,
    identifierField,
    allowBoth
  } = config;
  const log = getLogger();
  return async (event) => {
    if (csrf?.validate) {
      const valid = await csrf.validate(event);
      if (!valid) {
        return {
          error: csrf.errorMessage || "Invalid CSRF token",
          success: false
        };
      }
    }
    if (rateLimit?.check) {
      const key = getRateLimitKey2(event, rateLimit);
      const result = await rateLimit.check(key);
      if (!result?.allowed) {
        return {
          error: "Too many attempts. Try again later.",
          success: false
        };
      }
    }
    const formData = await event.request.formData();
    const identifierFieldName = fields?.identifier ?? identifierField ?? fields?.email ?? "email";
    const emailFieldName = fields?.email ?? "email";
    const passwordFieldName = fields?.password ?? "password";
    const rememberFieldName = fields?.remember ?? "remember";
    const identifier = formData.get(identifierFieldName)?.toString();
    const email = formData.get(emailFieldName)?.toString();
    const password = formData.get(passwordFieldName)?.toString();
    const remember = formData.get(rememberFieldName)?.toString() === "on" || formData.get(rememberFieldName)?.toString() === "true";
    if (!identifier && !email || !password) {
      return {
        error: "Email and password are required",
        success: false
      };
    }
    try {
      const authInput = {
        password,
        userAdapter
      };
      if (email) authInput.email = email;
      if (identifier) authInput.identifier = identifier;
      if (identifierField) authInput.identifierField = identifierField;
      if (allowBoth !== void 0) authInput.allowBoth = allowBoth;
      const { user, valid } = await credentialsProvider.authenticate(authInput);
      if (!valid || !user) {
        return {
          error: "Invalid email or password",
          success: false
        };
      }
      const safeUser = sanitizeUser2(user);
      if (onSignin) {
        await onSignin(safeUser);
      }
      const session = await sessionAdapter.createSession(user.id, {
        rememberMe: remember,
        ip: event.getClientAddress?.(),
        userAgent: event.request.headers.get("user-agent") ?? void 0
      });
      sessionAdapter.setSessionCookie(event.cookies, session);
      if (redirectTo) {
        throw redirect(303, redirectTo);
      }
      return {
        success: true,
        user: safeUser
      };
    } catch (error2) {
      log.error?.("[Signin] Error:", error2);
      if (error2 && typeof error2 === "object" && "status" in error2 && (error2.status === 302 || error2.status === 303)) {
        throw error2;
      }
      return {
        error: (error2 instanceof Error ? error2.message : void 0) || "An error occurred during signin",
        success: false
      };
    }
  };
}

// src/handlers/password-reset.ts
init_logger();
function createPasswordResetRequestHandler(config) {
  const {
    userAdapter,
    verificationTokenAdapter,
    sendPasswordResetEmail,
    csrf,
    rateLimit
  } = config;
  const log = getLogger();
  return async (event) => {
    if (csrf?.validate) {
      const valid = await csrf.validate(event);
      if (!valid) {
        return {
          error: csrf.errorMessage || "Invalid CSRF token",
          success: false
        };
      }
    }
    if (rateLimit?.check) {
      const key = rateLimit.key ? rateLimit.key(event) : event.getClientAddress ? event.getClientAddress() : rateLimit?.trustProxyHeader ? event.request.headers.get("x-forwarded-for") || "unknown" : "unknown";
      const result = await rateLimit.check(key);
      if (!result?.allowed) {
        return {
          error: "Too many attempts. Try again later.",
          success: false
        };
      }
    }
    const formData = await event.request.formData();
    const email = formData.get("email")?.toString();
    if (!email) {
      return {
        error: "Email is required",
        success: false
      };
    }
    try {
      const user = await userAdapter.getUserByEmail(email);
      if (!user) {
        return {
          success: true,
          message: "If an account exists with this email, a password reset link has been sent"
        };
      }
      const { createVerificationToken: createVerificationToken2, VERIFICATION_TOKEN_TYPES: VERIFICATION_TOKEN_TYPES2 } = await Promise.resolve().then(() => (init_tokens(), tokens_exports));
      const token = await createVerificationToken2({
        adapter: verificationTokenAdapter,
        userId: user.id,
        type: VERIFICATION_TOKEN_TYPES2.PASSWORD_RESET
      });
      await sendPasswordResetEmail(user.email, token);
      return {
        success: true,
        message: "If an account exists with this email, a password reset link has been sent"
      };
    } catch (error2) {
      log.error?.("[Password Reset Request] Error:", error2);
      return {
        error: "An error occurred while processing your request",
        success: false
      };
    }
  };
}
function createPasswordResetConfirmHandler(config) {
  const {
    credentialsProvider,
    userAdapter,
    verificationTokenAdapter,
    sessionAdapter,
    redirectTo = "/sign-in"
  } = config;
  const log = getLogger();
  return async (event) => {
    const formData = await event.request.formData();
    const token = formData.get("token")?.toString();
    const newPassword = formData.get("password")?.toString();
    if (!token || !newPassword) {
      return {
        error: "Token and new password are required",
        success: false
      };
    }
    try {
      const { consumeVerificationToken: consumeVerificationToken2, VERIFICATION_TOKEN_TYPES: VERIFICATION_TOKEN_TYPES2 } = await Promise.resolve().then(() => (init_tokens(), tokens_exports));
      const user = await consumeVerificationToken2({
        adapter: verificationTokenAdapter,
        token,
        type: VERIFICATION_TOKEN_TYPES2.PASSWORD_RESET
      });
      if (!user) {
        return {
          error: "Invalid or expired reset token",
          success: false
        };
      }
      await credentialsProvider.updatePassword({
        userId: user.id,
        newPassword,
        userAdapter
      });
      if (sessionAdapter?.invalidateUserSessions) {
        try {
          await sessionAdapter.invalidateUserSessions(user.id);
        } catch {
        }
      }
      return {
        success: true,
        message: "Password has been reset successfully",
        redirectTo
      };
    } catch (error2) {
      log.error?.("[Password Reset Confirm] Error:", error2);
      return {
        error: (error2 instanceof Error ? error2.message : void 0) || "An error occurred while resetting password",
        success: false
      };
    }
  };
}

// src/mfa/totp.ts
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[value << 5 - bits & 31];
  }
  return output;
}
function fromBase32(input) {
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      output.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}
async function hmacSha1(keyBytes, messageBytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    messageBytes
  );
  return new Uint8Array(sig);
}
function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = num & 255;
    num = Math.floor(num / 256);
  }
  return bytes;
}
function generateSecret({ length = 20 } = {}) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toBase32(bytes);
}
function createOtpAuthURL({
  secret = "",
  label = "",
  issuer = "",
  digits = 6,
  period = 30
} = {}) {
  const params = new URLSearchParams({
    secret,
    issuer,
    digits: String(digits),
    period: String(period)
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
async function generateTOTP({
  secret = "",
  time = Date.now(),
  digits = 6,
  period = 30
} = {}) {
  if (!secret) {
    throw new Error("TOTP secret is required");
  }
  const counter = Math.floor(time / 1e3 / period);
  const counterBytes = intToBytes(counter);
  const keyBytes = fromBase32(secret);
  const hash = await hmacSha1(keyBytes, counterBytes);
  const last = hash[hash.length - 1] ?? 0;
  const offset = last & 15;
  const code = ((hash[offset] ?? 0) & 127) << 24 | ((hash[offset + 1] ?? 0) & 255) << 16 | ((hash[offset + 2] ?? 0) & 255) << 8 | (hash[offset + 3] ?? 0) & 255;
  const otp = (code % 10 ** digits).toString().padStart(digits, "0");
  return otp;
}
async function verifyTOTP({
  secret = "",
  token = "",
  digits = 6,
  period = 30,
  window = 1,
  time = Date.now()
} = {}) {
  if (!secret || !token) return false;
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const t = time + errorWindow * period * 1e3;
    const candidate = await generateTOTP({ secret, time: t, digits, period });
    if (candidate === token) return true;
  }
  return false;
}

// src/mfa/backup-codes.ts
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length = 10) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}
function generateBackupCodes({
  count = 10,
  length = 10
} = {}) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(randomCode(length));
  }
  return codes;
}
async function sha256Hex2(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashBackupCodes(codes) {
  return Promise.all(codes.map((c) => sha256Hex2(c)));
}
async function verifyBackupCode({
  code,
  hashedCodes
}) {
  if (!code || !hashedCodes?.length) return { valid: false };
  const hash = await sha256Hex2(code);
  const idx = hashedCodes.indexOf(hash);
  if (idx === -1) return { valid: false };
  return { valid: true, hash, index: idx };
}

// src/handlers/mfa.ts
function createMfaEnrollHandler(config) {
  const { getUserId, store, issuer, label } = config;
  return async (event) => {
    const userId = getUserId(event.locals);
    if (!userId) return { success: false, error: "Unauthorized" };
    const secret = generateSecret();
    const otpLabel = label ? label(userId, event.locals) : String(userId);
    const otpInput = {
      secret,
      label: otpLabel
    };
    if (issuer) otpInput.issuer = issuer;
    const otpauthUrl = createOtpAuthURL(otpInput);
    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);
    await store.setSecret(userId, secret);
    await store.setBackupCodes(userId, hashedCodes);
    return { success: true, secret, otpauthUrl, backupCodes };
  };
}
function createMfaVerifyHandler(config) {
  const { getUserId, store } = config;
  return async (event) => {
    const userId = getUserId(event.locals);
    if (!userId) return { success: false, error: "Unauthorized" };
    const formData = await event.request.formData();
    const token = formData.get("token")?.toString();
    const secret = await store.getSecret(userId);
    const verifyInput = { secret };
    if (token) verifyInput.token = token;
    const valid = await verifyTOTP(verifyInput);
    if (!valid) return { success: false, error: "Invalid code" };
    await store.enableMfa(userId);
    return { success: true };
  };
}
function createMfaDisableHandler(config) {
  const { getUserId, store } = config;
  return async (event) => {
    const userId = getUserId(event.locals);
    if (!userId) return { success: false, error: "Unauthorized" };
    await store.disableMfa(userId);
    return { success: true };
  };
}
function createMfaBackupCodeHandler(config) {
  const { getUserId, store } = config;
  return async (event) => {
    const userId = getUserId(event.locals);
    if (!userId) return { success: false, error: "Unauthorized" };
    const formData = await event.request.formData();
    const code = formData.get("code")?.toString();
    const hashedCodes = await store.getBackupCodes(userId);
    const result = await verifyBackupCode({ code: code ?? "", hashedCodes });
    if (!result.valid) return { success: false, error: "Invalid backup code" };
    if (!result.hash) return { success: false, error: "Invalid backup code" };
    await store.consumeBackupCode(userId, result.hash);
    return { success: true };
  };
}

// src/utils/magic-link.ts
init_crypto();
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
function getRateLimitKey3(event, config) {
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
    const ipKey = getRateLimitKey3(event, config);
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
    } catch (error2) {
      if (error2 instanceof AuthPrincipalResolutionError) {
        return jsonResponse({ ok: false, error: error2.message }, error2.status);
      }
      throw error2;
    }
    if (event.request.method === "GET") {
      throw redirect(302, redirectAfterLogin);
    }
    return jsonResponse({ ok: true, user: sanitizeUser2(user) });
  };
}

// src/handlers/webauthn.ts
init_crypto();
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
    userVerification = "preferred",
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
    } catch (error2) {
      if (error2 instanceof AuthPrincipalResolutionError) {
        return jsonResponse({ ok: false, error: error2.message }, error2.status);
      }
      throw error2;
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
    const isUnsupportedError = (error2) => error2 instanceof AuthAdapterCapabilityError || error2 instanceof Error && (error2.message.includes("not support") || error2.message.includes("not implemented"));
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
      } catch (error2) {
        if (isUnsupportedError(error2)) {
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
      } catch (error2) {
        if (isUnsupportedError(error2)) {
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
      } catch (error2) {
        if (isUnsupportedError(error2)) {
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

export { createCallbackHandler, createLoginHandler, createLogoutAction, createLogoutHandler, createMagicLinkRequestHandler, createMagicLinkVerifyHandler, createMfaBackupCodeHandler, createMfaDisableHandler, createMfaEnrollHandler, createMfaVerifyHandler, createPasswordResetConfirmHandler, createPasswordResetRequestHandler, createSessionListHandler, createSessionRevokeHandler, createSigninHandler, createSignupHandler, createWebAuthnLoginOptionsHandler, createWebAuthnLoginVerifyHandler, createWebAuthnRegisterOptionsHandler, createWebAuthnRegisterVerifyHandler };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map