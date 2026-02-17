import { argon2id, argon2Verify } from 'hash-wasm';
import { generateState, generateCodeVerifier } from 'arctic';

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
var logger_exports = {};
__export(logger_exports, {
  getLogger: () => getLogger,
  setLogger: () => setLogger
});
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

// src/utils/crypto.ts
var ALGORITHM = "AES-GCM";
var TAG_LENGTH_BYTES = 16;
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
function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) {
    throw new Error("Encryption key must be a hex string");
  }
  const len = hex.length / 2;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const high = CHAR_TO_NIBBLE[hex.charCodeAt(i * 2)];
    const low = CHAR_TO_NIBBLE[hex.charCodeAt(i * 2 + 1)];
    if (high === -1 || low === -1 || high === void 0 || low === void 0) {
      throw new Error("Encryption key must be a hex string");
    }
    bytes[i] = high << 4 | low;
  }
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
function validateEncryptionKey(encryptionKey) {
  const keyBytes = hexToBytes(encryptionKey);
  if (keyBytes.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (64 hex chars)");
  }
  return keyBytes;
}
async function encryptTokens(tokens, encryptionKey) {
  if (!encryptionKey) {
    throw new Error("Encryption key is required");
  }
  try {
    const cryptoImpl = await getWebCrypto();
    const keyBytes = validateEncryptionKey(encryptionKey);
    const iv = await getRandomBytes(12);
    const plaintext = new TextEncoder().encode(JSON.stringify(tokens));
    const key = await cryptoImpl.subtle.importKey(
      "raw",
      keyBytes,
      { name: ALGORITHM },
      false,
      ["encrypt"]
    );
    const cipherBuffer = await cryptoImpl.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      plaintext
    );
    const cipherBytes = new Uint8Array(cipherBuffer);
    const data = cipherBytes.slice(0, cipherBytes.length - TAG_LENGTH_BYTES);
    const tag = cipherBytes.slice(cipherBytes.length - TAG_LENGTH_BYTES);
    return JSON.stringify({
      iv: bytesToHex(iv),
      data: bytesToHex(data),
      tag: bytesToHex(tag)
    });
  } catch (error) {
    const { getLogger: getLogger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    getLogger2().error?.("Token encryption error:", error);
    throw error;
  }
}
async function decryptTokens(encryptedData, encryptionKey) {
  if (!encryptedData) return null;
  if (!encryptionKey) {
    throw new Error("Encryption key is required");
  }
  try {
    const cryptoImpl = await getWebCrypto();
    const keyBytes = validateEncryptionKey(encryptionKey);
    const { iv, data, tag } = JSON.parse(encryptedData);
    const ivBytes = hexToBytes(iv);
    const dataBytes = hexToBytes(data);
    const tagBytes = hexToBytes(tag);
    const cipherBytes = new Uint8Array(dataBytes.length + tagBytes.length);
    cipherBytes.set(dataBytes, 0);
    cipherBytes.set(tagBytes, dataBytes.length);
    const key = await cryptoImpl.subtle.importKey(
      "raw",
      keyBytes,
      { name: ALGORITHM },
      false,
      ["decrypt"]
    );
    const plainBuffer = await cryptoImpl.subtle.decrypt(
      { name: ALGORITHM, iv: ivBytes },
      key,
      cipherBytes
    );
    return JSON.parse(new TextDecoder().decode(plainBuffer));
  } catch (error) {
    const { getLogger: getLogger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    getLogger2().error?.("Token decryption error:", error);
    return null;
  }
}
async function generateEncryptionKey() {
  const bytes = await getRandomBytes(32);
  return bytesToHex(bytes);
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

// src/utils/sanitize.ts
function sanitizeUser(user) {
  if (!user) return null;
  const { password: _password, token: _token, ...safeUser } = user;
  return safeUser;
}
var DEFAULTS = {
  memorySize: 12288,
  // KiB (12 MiB)
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16
};
async function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = new Uint8Array(DEFAULTS.saltLength);
  globalThis.crypto.getRandomValues(salt);
  return await argon2id({
    password,
    salt,
    iterations: DEFAULTS.iterations,
    memorySize: DEFAULTS.memorySize,
    parallelism: DEFAULTS.parallelism,
    hashLength: DEFAULTS.hashLength,
    outputType: "encoded"
  });
}
async function verifyPassword(storedHash, password) {
  if (!storedHash || !password) return false;
  try {
    return await argon2Verify({
      password,
      hash: storedHash
    });
  } catch (error) {
    const { getLogger: getLogger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    getLogger2().error?.("Password verification error:", error);
    return false;
  }
}
function validatePasswordStrength(password) {
  const errors = [];
  if (!password) {
    errors.push("Password is required");
    return { valid: false, errors };
  }
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  return { valid: errors.length === 0, errors };
}
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
  } catch (error) {
    if (callbacks.onError) {
      await callbacks.onError(error);
    }
    cleanupOAuthCookies(cookies, provider);
    throw error;
  }
}

// src/adapters/verification-token/base.ts
var VerificationTokenAdapter = class {
};

// src/utils/tokens.ts
var DEFAULT_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1e3;
var VERIFICATION_TOKEN_TYPES = {
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
  EMAIL_UPDATE: "email_update"
};
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

export { DEFAULT_REDACT_KEYS, MemoryRateLimitStore, VERIFICATION_TOKEN_TYPES, VerificationTokenAdapter, cleanupOAuthCookies, consumeVerificationToken, createOAuthCookies, createRateLimiter, createVerificationToken, decryptTokens, encryptTokens, generateEncryptionKey, getOAuthCallbackParams, getUserForVerificationToken, handleOAuthCallback, hashPassword, isSafeRedirectPath, redactObject, sanitizeUser, validateOAuthCallback, validatePasswordStrength, verifyPassword };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map