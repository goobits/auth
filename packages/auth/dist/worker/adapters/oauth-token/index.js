import { and, eq } from 'drizzle-orm';

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

// src/adapters/oauth-token/base.ts
var TokenAdapter = class {
};

// src/utils/crypto.ts
var ALGORITHM = "AES-GCM";
var TAG_LENGTH_BYTES = 16;
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

// src/adapters/drizzle-types.ts
function requireColumn(table, column) {
  const found = table[column];
  if (!found) {
    throw new Error(`Missing column '${column}' in drizzle table configuration`);
  }
  return found;
}
function requireCondition(condition) {
  if (!condition) {
    throw new Error("Missing SQL condition");
  }
  return condition;
}

// src/adapters/oauth-token/drizzle.ts
function normalizeOAuthTokens(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
    return null;
  }
  const accessTokenRaw = value["accessToken"];
  const refreshTokenRaw = value["refreshToken"];
  const scopeRaw = value["scope"];
  const accessTokenExpiresAtRaw = value["accessTokenExpiresAt"];
  if (typeof accessTokenRaw !== "string") return null;
  const refreshToken = typeof refreshTokenRaw === "string" || refreshTokenRaw === null ? refreshTokenRaw : null;
  const scope = typeof scopeRaw === "string" || scopeRaw === null ? scopeRaw : null;
  let accessTokenExpiresAt;
  if (typeof accessTokenExpiresAtRaw === "string") {
    accessTokenExpiresAt = accessTokenExpiresAtRaw;
  } else if (accessTokenExpiresAtRaw instanceof Date) {
    accessTokenExpiresAt = accessTokenExpiresAtRaw.toISOString();
  } else {
    accessTokenExpiresAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  return {
    accessToken: accessTokenRaw,
    refreshToken,
    scope,
    accessTokenExpiresAt
  };
}
var DrizzleTokenAdapter = class extends TokenAdapter {
  db;
  tokensTable;
  encryptionKey;
  encrypt;
  constructor(db, options = {}) {
    super();
    if (!options.tokensTable) {
      throw new Error("DrizzleTokenAdapter requires tokensTable option");
    }
    this.db = db;
    this.tokensTable = options.tokensTable;
    this.encryptionKey = options.encryptionKey ?? null;
    this.encrypt = options.encrypt !== false;
    if (this.encrypt && !this.encryptionKey) {
      throw new Error(
        "DrizzleTokenAdapter requires encryptionKey when encryption is enabled"
      );
    }
  }
  getEncryptionKey() {
    if (!this.encryptionKey) {
      throw new Error("Encryption key is required");
    }
    return this.encryptionKey;
  }
  async storeTokens(userId, provider, tokens) {
    const key = this.getEncryptionKey();
    const tokenData = this.encrypt ? await encryptTokens(tokens, key) : JSON.stringify(tokens);
    await this.db.delete(this.tokensTable).where(
      requireCondition(and(
        eq(requireColumn(this.tokensTable, "userId"), userId),
        eq(requireColumn(this.tokensTable, "provider"), provider)
      ))
    );
    await this.db.insert(this.tokensTable).values({
      userId,
      provider,
      tokens: tokenData
    });
  }
  async getTokens(userId, provider) {
    const [row] = await this.db.select().from(this.tokensTable).where(
      requireCondition(and(
        eq(requireColumn(this.tokensTable, "userId"), userId),
        eq(requireColumn(this.tokensTable, "provider"), provider)
      ))
    );
    if (!row) return null;
    const raw = row["tokens"];
    if (typeof raw !== "string") return null;
    if (this.encrypt) {
      const decrypted = await decryptTokens(raw, this.getEncryptionKey());
      return decrypted ? normalizeOAuthTokens(decrypted) : null;
    }
    const parsed = JSON.parse(raw);
    return normalizeOAuthTokens(parsed);
  }
  async refreshTokens(_userId, _provider) {
    throw new Error(
      "refreshTokens not implemented - use provider-specific refresh logic"
    );
  }
  async deleteTokens(userId, provider) {
    await this.db.delete(this.tokensTable).where(
      requireCondition(and(
        eq(requireColumn(this.tokensTable, "userId"), userId),
        eq(requireColumn(this.tokensTable, "provider"), provider)
      ))
    );
  }
};

// src/adapters/oauth-token/cookie.ts
var CookieTokenAdapter = class extends TokenAdapter {
  cookieName;
  encryptionKey;
  secureCookies;
  maxAge;
  _cookies;
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.cookieName - Cookie name for storing tokens
   * @param {string} options.encryptionKey - 32-byte hex encryption key
   * @param {boolean} [options.secureCookies=true] - Use secure cookies
   * @param {number} [options.maxAge=604800] - Cookie max age in seconds (default: 7 days)
   */
  constructor(options = {}) {
    super();
    this.cookieName = options.cookieName || "oauth_tokens";
    this.encryptionKey = options.encryptionKey || "";
    this.secureCookies = options.secureCookies !== false;
    this.maxAge = options.maxAge || 60 * 60 * 24 * 7;
    if (!this.encryptionKey) {
      throw new Error("CookieTokenAdapter requires encryptionKey option");
    }
    this._cookies = null;
  }
  /**
   * Set the cookies object for this adapter
   * @param {import('@sveltejs/kit').Cookies} cookies
   */
  _setCookies(cookies) {
    this._cookies = cookies;
  }
  async storeTokens(userId, provider, tokens) {
    if (!this._cookies) {
      throw new Error("Cookies not set. Call _setCookies() first.");
    }
    const encryptedTokens = await encryptTokens(tokens, this.encryptionKey);
    const cookieName = `${this.cookieName}_${provider}`;
    this._cookies.set(cookieName, encryptedTokens, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "strict",
      path: "/",
      maxAge: this.maxAge
    });
  }
  async getTokens(userId, provider) {
    if (!this._cookies) {
      throw new Error("Cookies not set. Call _setCookies() first.");
    }
    const cookieName = `${this.cookieName}_${provider}`;
    const encryptedTokens = this._cookies.get(cookieName);
    if (!encryptedTokens) return null;
    return await decryptTokens(encryptedTokens, this.encryptionKey);
  }
  async refreshTokens(userId, provider) {
    throw new Error(
      "refreshTokens not implemented - use provider-specific refresh logic"
    );
  }
  async deleteTokens(userId, provider) {
    if (!this._cookies) {
      throw new Error("Cookies not set. Call _setCookies() first.");
    }
    const cookieName = `${this.cookieName}_${provider}`;
    this._cookies.delete(cookieName, { path: "/" });
  }
};

// src/adapters/oauth-token/d1.ts
function isObjectRecord(value) {
  return !!value && typeof value === "object";
}
function parseOAuthTokens(raw) {
  try {
    const data = JSON.parse(raw);
    if (!isObjectRecord(data)) return null;
    const record = data;
    if (typeof record["accessToken"] !== "string") return null;
    if (record["refreshToken"] !== null && typeof record["refreshToken"] !== "string") {
      return null;
    }
    if (record["scope"] !== null && typeof record["scope"] !== "string") return null;
    if (typeof record["accessTokenExpiresAt"] !== "string") return null;
    return {
      accessToken: record["accessToken"],
      refreshToken: record["refreshToken"],
      scope: record["scope"],
      accessTokenExpiresAt: record["accessTokenExpiresAt"]
    };
  } catch {
    return null;
  }
}
var D1TokenAdapter = class extends TokenAdapter {
  db;
  tokensTable;
  encrypt;
  encryptionKey;
  columns;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.tokensTable = options.tokensTable || "oauth_tokens";
    this.encrypt = options.encrypt !== false;
    this.encryptionKey = options.encryptionKey || null;
    this.columns = {
      userId: options.columns?.["userId"] || "user_id",
      provider: options.columns?.["provider"] || "provider",
      tokens: options.columns?.["tokens"] || "tokens"
    };
    if (this.encrypt && !this.encryptionKey) {
      throw new Error(
        "D1TokenAdapter requires encryptionKey when encryption is enabled"
      );
    }
  }
  async storeTokens(userId, provider, tokens) {
    const key = this.encryptionKey ?? "";
    const tokenData = this.encrypt ? await encryptTokens(tokens, key) : JSON.stringify(tokens);
    await this.db.prepare(
      `DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`
    ).bind(userId, provider).run();
    await this.db.prepare(
      `INSERT INTO ${this.tokensTable} (${this.columns.userId}, ${this.columns.provider}, ${this.columns.tokens}) VALUES (?, ?, ?)`
    ).bind(userId, provider, tokenData).run();
  }
  async getTokens(userId, provider) {
    const row = await this.db.prepare(
      `SELECT ${this.columns.tokens} as tokens FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ? LIMIT 1`
    ).bind(userId, provider).first();
    if (!row) return null;
    const key = this.encryptionKey ?? "";
    const tokenValue = row["tokens"];
    if (typeof tokenValue !== "string") return null;
    return this.encrypt ? await decryptTokens(tokenValue, key) : parseOAuthTokens(tokenValue);
  }
  async refreshTokens(userId, provider) {
    const { getLogger: getLogger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    getLogger2().warn?.(
      "refreshTokens not implemented - use provider-specific refresh logic"
    );
    return this.getTokens(userId, provider);
  }
  async deleteTokens(userId, provider) {
    await this.db.prepare(
      `DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.provider} = ?`
    ).bind(userId, provider).run();
  }
};

// src/adapters/oauth-token/kv.ts
var KVTokenAdapter = class extends TokenAdapter {
  namespace;
  encrypt;
  encryptionKey;
  keyPrefix;
  constructor(namespace, options = {}) {
    super();
    this.namespace = namespace;
    this.encrypt = options.encrypt !== false;
    this.encryptionKey = options.encryptionKey || null;
    this.keyPrefix = options.keyPrefix || "oauth_tokens";
    if (this.encrypt && !this.encryptionKey) {
      throw new Error("KVTokenAdapter requires encryptionKey when encryption is enabled");
    }
  }
  _key(userId, provider) {
    return `${this.keyPrefix}:${userId}:${provider}`;
  }
  async storeTokens(userId, provider, tokens) {
    const key = this.encryptionKey;
    const tokenData = this.encrypt ? await encryptTokens(tokens, key) : JSON.stringify(tokens);
    await this.namespace.put(this._key(userId, provider), tokenData);
  }
  async getTokens(userId, provider) {
    const raw = await this.namespace.get(this._key(userId, provider));
    if (!raw) return null;
    const key = this.encryptionKey;
    return this.encrypt ? await decryptTokens(raw, key) : JSON.parse(raw);
  }
  async refreshTokens(userId, provider) {
    throw new Error(
      "refreshTokens not implemented - use provider-specific refresh logic"
    );
  }
  async deleteTokens(userId, provider) {
    await this.namespace.delete(this._key(userId, provider));
  }
};

export { CookieTokenAdapter, D1TokenAdapter, DrizzleTokenAdapter, KVTokenAdapter, TokenAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map