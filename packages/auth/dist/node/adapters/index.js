import { encodeBase64url } from '@oslojs/encoding';
import { eq, and } from 'drizzle-orm';

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

// src/adapters/session/base.ts
var SessionAdapter = class {
};
function toUser(row) {
  if (!row) return null;
  const id = row["id"];
  const email = row["email"];
  const name = row["name"];
  const avatar = row["avatar"] ?? null;
  const emailVerified = row["emailVerified"] ?? row["email_verified"] ?? false;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof email !== "string") return null;
  if (typeof name !== "string") return null;
  if (avatar !== null && typeof avatar !== "string") return null;
  if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
    return null;
  }
  return {
    id: String(id),
    email,
    name,
    avatar,
    emailVerified: Boolean(emailVerified)
  };
}
function toSession(row) {
  if (!row) return null;
  const id = row["id"];
  const userId = row["userId"] ?? row["user_id"];
  const expiresAt = row["expiresAt"] ?? row["expires_at"];
  if (typeof id !== "string") return null;
  if (typeof userId !== "string" && typeof userId !== "number") return null;
  if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
  const expiresDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) return null;
  return {
    id,
    userId: String(userId),
    expiresAt: expiresDate
  };
}
function pickSessionMetadata(metadata) {
  const values = {};
  for (const [key, value] of Object.entries(metadata)) {
    values[key] = value;
  }
  return values;
}
var DrizzleSessionAdapter = class extends SessionAdapter {
  db;
  sessionsTable;
  usersTable;
  sessionLifetime;
  sessionRefreshThreshold;
  cookieName;
  secureCookies;
  sanitizeUser;
  constructor(db, options = {}) {
    super();
    if (!options.sessionsTable || !options.usersTable) {
      throw new Error(
        "DrizzleSessionAdapter requires sessionsTable and usersTable options"
      );
    }
    this.db = db;
    this.sessionsTable = options.sessionsTable;
    this.usersTable = options.usersTable;
    this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1e3;
    this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2;
    this.cookieName = options.cookieName || "session";
    this.secureCookies = options.secureCookies !== false;
    this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
  }
  _defaultSanitizeUser(user) {
    return user;
  }
  _generateSessionId() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return encodeBase64url(bytes);
  }
  async createSession(userId, metadata = {}) {
    const sessionId = this._generateSessionId();
    const expiresAt = new Date(Date.now() + this.sessionLifetime);
    await this.db.insert(this.sessionsTable).values({
      id: sessionId,
      userId,
      expiresAt,
      ...pickSessionMetadata(metadata)
    });
    return { id: sessionId, userId, expiresAt };
  }
  async validateSession(sessionId) {
    const [result] = await this.db.select({
      user: this.usersTable,
      session: this.sessionsTable
    }).from(this.sessionsTable).innerJoin(this.usersTable, eq(this.sessionsTable.userId, this.usersTable.id)).where(eq(this.sessionsTable.id, sessionId));
    if (!result) return { session: null, user: null };
    const session = toSession(result["session"] ?? null);
    if (!session) return { session: null, user: null };
    if (Date.now() >= session.expiresAt.getTime()) {
      await this.db.delete(this.sessionsTable).where(eq(this.sessionsTable.id, sessionId));
      return { session: null, user: null };
    }
    const shouldRefresh = Date.now() >= session.expiresAt.getTime() - this.sessionRefreshThreshold;
    if (shouldRefresh) {
      session.expiresAt = new Date(Date.now() + this.sessionLifetime);
      session.fresh = true;
      await this.db.update(this.sessionsTable).set({ expiresAt: session.expiresAt }).where(eq(this.sessionsTable.id, sessionId));
    }
    return {
      session,
      user: this.sanitizeUser(toUser(result["user"] ?? null))
    };
  }
  async invalidateSession(sessionId) {
    await this.db.delete(this.sessionsTable).where(eq(this.sessionsTable.id, sessionId));
  }
  async invalidateUserSessions(userId) {
    await this.db.delete(this.sessionsTable).where(eq(this.sessionsTable.userId, userId));
  }
  async listSessions(userId) {
    const rows = await this.db.select().from(this.sessionsTable).where(eq(this.sessionsTable.userId, userId));
    const sessions = [];
    for (const row of rows) {
      const session = toSession(row);
      if (session) sessions.push(session);
    }
    return sessions;
  }
  setSessionCookie(cookies, session) {
    cookies.set(this.cookieName, session.id, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt
    });
  }
  deleteSessionCookie(cookies) {
    cookies.delete(this.cookieName, {
      path: "/"
    });
  }
};
var CookieSessionAdapter = class extends SessionAdapter {
  cookieName;
  secureCookies;
  sessionLifetime;
  _sessions;
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.cookieName='session'] - Session cookie name
   * @param {boolean} [options.secureCookies=true] - Use secure cookies
   * @param {number} [options.sessionLifetime=2592000000] - Session lifetime in ms (default: 30 days)
   */
  constructor(options = {}) {
    super();
    this.cookieName = options.cookieName || "session";
    this.secureCookies = options.secureCookies !== false;
    this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1e3;
    this._sessions = /* @__PURE__ */ new Map();
  }
  /**
   * Generate cryptographically secure session ID
   * @returns {string}
   * @private
   */
  _generateSessionId() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return encodeBase64url(bytes);
  }
  async createSession(userId, metadata = {}) {
    const sessionId = this._generateSessionId();
    const expiresAt = new Date(Date.now() + this.sessionLifetime);
    const session = {
      id: sessionId,
      userId,
      expiresAt,
      ...metadata
    };
    this._sessions.set(sessionId, session);
    return session;
  }
  async validateSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return { session: null, user: null };
    }
    if (Date.now() >= session.expiresAt.getTime()) {
      this._sessions.delete(sessionId);
      return { session: null, user: null };
    }
    return { session, user: null };
  }
  async invalidateSession(sessionId) {
    this._sessions.delete(sessionId);
  }
  async invalidateUserSessions(userId) {
    for (const [sessionId, session] of this._sessions.entries()) {
      if (session.userId === userId) {
        this._sessions.delete(sessionId);
      }
    }
  }
  async listSessions(userId) {
    const sessions = [];
    for (const session of this._sessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
    return sessions;
  }
  setSessionCookie(cookies, session) {
    cookies.set(this.cookieName, session.id, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt
    });
  }
  deleteSessionCookie(cookies) {
    cookies.delete(this.cookieName, {
      path: "/"
    });
  }
};
var D1SessionAdapter = class extends SessionAdapter {
  db;
  sessionsTable;
  usersTable;
  sessionLifetime;
  sessionRefreshThreshold;
  cookieName;
  secureCookies;
  sanitizeUser;
  columns;
  userColumns;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.sessionsTable = options.sessionsTable || "sessions";
    this.usersTable = options.usersTable || "users";
    this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1e3;
    this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2;
    this.cookieName = options.cookieName || "session";
    this.secureCookies = options.secureCookies !== false;
    this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
    this.columns = {
      sessionId: options.columns?.sessionId || "id",
      userId: options.columns?.userId || "user_id",
      expiresAt: options.columns?.expiresAt || "expires_at",
      createdAt: options.columns?.createdAt || null,
      lastActiveAt: options.columns?.lastActiveAt || null,
      ip: options.columns?.ip || null,
      userAgent: options.columns?.userAgent || null
    };
    this.userColumns = {
      id: options.userColumns?.id || "id",
      email: options.userColumns?.email || "email",
      name: options.userColumns?.name || "name",
      avatar: options.userColumns?.avatar || "avatar",
      password: options.userColumns?.password || "password",
      emailVerified: options.userColumns?.emailVerified || "email_verified",
      role: options.userColumns?.role || "role",
      settings: options.userColumns?.settings || "settings",
      createdAt: options.userColumns?.createdAt || "created_at",
      updatedAt: options.userColumns?.updatedAt || "updated_at"
    };
  }
  _defaultSanitizeUser(user) {
    return user;
  }
  _generateSessionId() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return encodeBase64url(bytes);
  }
  _coerceDbId(id) {
    return /^\d+$/.test(id) ? Number(id) : id;
  }
  async createSession(userId, metadata = {}) {
    const sessionId = this._generateSessionId();
    const expiresAt = new Date(Date.now() + this.sessionLifetime);
    const sql = `INSERT INTO ${this.sessionsTable} (${this.columns.sessionId}, ${this.columns.userId}, ${this.columns.expiresAt}) VALUES (?, ?, ?)`;
    await this.db.prepare(sql).bind(sessionId, this._coerceDbId(userId), expiresAt.toISOString()).run();
    return { id: sessionId, userId, expiresAt, ...metadata };
  }
  async validateSession(sessionId) {
    const sql = `SELECT s.${this.columns.sessionId} as session_id, s.${this.columns.userId} as user_id, s.${this.columns.expiresAt} as expires_at, u.*
		FROM ${this.sessionsTable} s
		JOIN ${this.usersTable} u ON s.${this.columns.userId} = u.${this.userColumns.id}
		WHERE s.${this.columns.sessionId} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(sessionId).first();
    if (!row) return { session: null, user: null };
    const expiresAtRaw = row["expires_at"];
    if (typeof expiresAtRaw !== "string") return { session: null, user: null };
    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) return { session: null, user: null };
    if (Date.now() >= expiresAt.getTime()) {
      await this.db.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`).bind(sessionId).run();
      return { session: null, user: null };
    }
    const shouldRefresh = Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold;
    let fresh = false;
    let newExpiresAt = expiresAt;
    if (shouldRefresh) {
      newExpiresAt = new Date(Date.now() + this.sessionLifetime);
      await this.db.prepare(
        `UPDATE ${this.sessionsTable} SET ${this.columns.expiresAt} = ? WHERE ${this.columns.sessionId} = ?`
      ).bind(newExpiresAt.toISOString(), sessionId).run();
      fresh = true;
    }
    const user = this.sanitizeUser(this._mapUserRow(row));
    const userIdRaw = row["user_id"];
    if (typeof userIdRaw !== "string" && typeof userIdRaw !== "number") {
      return { session: null, user: null };
    }
    return {
      session: {
        id: sessionId,
        userId: String(userIdRaw),
        expiresAt: newExpiresAt,
        fresh
      },
      user
    };
  }
  _mapUserRow(row) {
    const id = row[this.userColumns["id"]] ?? row["id"];
    const email = row[this.userColumns["email"]] ?? row["email"];
    const name = row[this.userColumns["name"]] ?? row["name"];
    const avatar = row[this.userColumns["avatar"]] ?? row["avatar"];
    const emailVerified = row[this.userColumns.emailVerified] ?? row["email_verified"];
    const role = row[this.userColumns.role] ?? row["role"];
    const settings = row[this.userColumns.settings] ?? row["settings"];
    const createdAt = row[this.userColumns.createdAt] ?? row["created_at"];
    const updatedAt = row[this.userColumns.updatedAt] ?? row["updated_at"];
    if (typeof id !== "string" && typeof id !== "number") return null;
    if (typeof email !== "string") return null;
    if (typeof name !== "string") return null;
    if (avatar !== null && typeof avatar !== "string") return null;
    if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
      return null;
    }
    if (role !== null && role !== void 0 && typeof role !== "string") return null;
    if (settings !== null && settings !== void 0 && typeof settings !== "string") return null;
    if (createdAt !== null && createdAt !== void 0 && typeof createdAt !== "string") return null;
    if (updatedAt !== null && updatedAt !== void 0 && typeof updatedAt !== "string") return null;
    let parsedSettings;
    if (typeof settings === "string" && settings.trim().length > 0) {
      try {
        const decoded = JSON.parse(settings);
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
          parsedSettings = decoded;
        }
      } catch {
      }
    }
    const createdAtDate = typeof createdAt === "string" && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt) : void 0;
    const updatedAtDate = typeof updatedAt === "string" && !Number.isNaN(new Date(updatedAt).getTime()) ? new Date(updatedAt) : void 0;
    return {
      id: String(id),
      email,
      name,
      avatar,
      emailVerified: Boolean(emailVerified),
      ...typeof role === "string" ? { role } : {},
      ...parsedSettings ? { settings: parsedSettings } : {},
      ...createdAtDate ? { createdAt: createdAtDate } : {},
      ...updatedAtDate ? { updatedAt: updatedAtDate } : {}
    };
  }
  async invalidateSession(sessionId) {
    await this.db.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.sessionId} = ?`).bind(sessionId).run();
  }
  async invalidateUserSessions(userId) {
    await this.db.prepare(`DELETE FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`).bind(this._coerceDbId(userId)).run();
  }
  async listSessions(userId) {
    const columns = [
      this.columns.sessionId,
      this.columns.userId,
      this.columns.expiresAt,
      this.columns.createdAt,
      this.columns.lastActiveAt,
      this.columns.ip,
      this.columns.userAgent
    ];
    const unique = [...new Set(columns.filter(Boolean))];
    const sql = `SELECT ${unique.join(", ")} FROM ${this.sessionsTable} WHERE ${this.columns.userId} = ?`;
    const result = await this.db.prepare(sql).bind(this._coerceDbId(userId)).all();
    const sessions = [];
    for (const row of result?.results ?? []) {
      const id = row[this.columns.sessionId] ?? row["id"];
      const uid = row[this.columns.userId] ?? row["user_id"];
      const expiresRaw = row[this.columns["expiresAt"]] ?? row["expires_at"] ?? row["expiresAt"];
      if (typeof id !== "string" && typeof id !== "number" || typeof uid !== "string" && typeof uid !== "number" || typeof expiresRaw !== "string") {
        continue;
      }
      const expiresAt = new Date(expiresRaw);
      if (Number.isNaN(expiresAt.getTime())) continue;
      sessions.push({
        id: String(id),
        userId: String(uid),
        expiresAt
      });
    }
    return sessions;
  }
  setSessionCookie(cookies, session) {
    cookies.set(this.cookieName, session.id, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt
    });
  }
  deleteSessionCookie(cookies) {
    cookies.delete(this.cookieName, {
      path: "/"
    });
  }
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

// src/adapters/database/base.ts
var UserAdapter = class {
};

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

// src/adapters/database/drizzle.ts
function toUser2(row) {
  if (!row) return null;
  const id = row["id"];
  const email = row["email"];
  const name = row["name"];
  const avatar = row["avatar"] ?? null;
  const emailVerified = row["emailVerified"] ?? row["email_verified"] ?? false;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof email !== "string") return null;
  if (typeof name !== "string") return null;
  if (avatar !== null && typeof avatar !== "string") return null;
  if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
    return null;
  }
  return {
    id: String(id),
    email,
    name,
    avatar,
    emailVerified: Boolean(emailVerified)
  };
}
function toDrizzleRow(values) {
  return values;
}
var DrizzleUserAdapter = class extends UserAdapter {
  db;
  usersTable;
  oauthAccountsTable;
  sanitizeUser;
  constructor(db, options = {}) {
    super();
    if (!options.usersTable) {
      throw new Error("DrizzleUserAdapter requires usersTable option");
    }
    this.db = db;
    this.usersTable = options.usersTable;
    this.oauthAccountsTable = options.oauthAccountsTable ?? null;
    this.sanitizeUser = options.sanitizeUser ?? this._defaultSanitizeUser;
  }
  _defaultSanitizeUser(user) {
    return user;
  }
  async createUser(profile, metadata = {}) {
    const userData = {
      email: profile.email,
      name: profile.name ?? profile.email,
      avatar: profile.picture ?? null,
      emailVerified: Boolean(profile.verified_email),
      ...metadata
    };
    await this.db.insert(this.usersTable).values(toDrizzleRow(userData));
    const user = await this.getUserByEmail(profile.email);
    if (!user) throw new Error("Created user not found");
    return user;
  }
  async getUserById(id) {
    const [row] = await this.db.select().from(this.usersTable).where(eq(this.usersTable.id, id));
    return this.sanitizeUser(toUser2(row ?? null));
  }
  async getUserByEmail(email) {
    const [row] = await this.db.select().from(this.usersTable).where(eq(this.usersTable.email, email));
    return this.sanitizeUser(toUser2(row ?? null));
  }
  async getUserByProviderId(provider, providerId) {
    if (!this.oauthAccountsTable) {
      throw new Error(
        "OAuth accounts table not configured. Set oauthAccountsTable in adapter options."
      );
    }
    const [result] = await this.db.select({ user: this.usersTable }).from(this.oauthAccountsTable).innerJoin(
      this.usersTable,
      eq(this.oauthAccountsTable.userId, this.usersTable.id)
    ).where(requireCondition(
      and(
        eq(this.oauthAccountsTable.provider, provider),
        eq(this.oauthAccountsTable.providerAccountId, providerId)
      )
    ));
    return this.sanitizeUser(toUser2(result?.["user"] ?? null));
  }
  async updateUser(id, data) {
    if (Object.keys(data).length > 0) {
      await this.db.update(this.usersTable).set(toDrizzleRow(data)).where(eq(this.usersTable.id, id));
    }
    const updated = await this.getUserById(id);
    if (!updated) throw new Error("Updated user not found");
    return updated;
  }
  async deleteUser(id) {
    await this.db.delete(this.usersTable).where(eq(this.usersTable.id, id));
  }
  async linkOAuthAccount(userId, provider, providerAccountId) {
    if (!this.oauthAccountsTable) {
      throw new Error(
        "OAuth accounts table not configured. Set oauthAccountsTable in adapter options."
      );
    }
    await this.db.insert(this.oauthAccountsTable).values({
      userId,
      provider,
      providerAccountId
    });
  }
  async getUserWithPasswordHash(email) {
    const [row] = await this.db.select().from(this.usersTable).where(eq(this.usersTable.email, email));
    if (!row) return null;
    const user = toUser2(row);
    if (!user) return null;
    const password = row["password"];
    return {
      ...user,
      password: typeof password === "string" ? password : null
    };
  }
};

// src/adapters/database/d1.ts
var D1UserAdapter = class extends UserAdapter {
  db;
  usersTable;
  oauthAccountsTable;
  sanitizeUser;
  columns;
  oauthColumns;
  allowedFields;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.usersTable = options.usersTable || "users";
    this.oauthAccountsTable = options.oauthAccountsTable || "oauth_accounts";
    this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
    this.columns = {
      id: options.columns?.["id"] || "id",
      email: options.columns?.["email"] || "email",
      name: options.columns?.["name"] || "name",
      avatar: options.columns?.["avatar"] || "avatar",
      emailVerified: options.columns?.["emailVerified"] || "email_verified",
      password: options.columns?.["password"] || "password",
      role: options.columns?.["role"] || "role",
      settings: options.columns?.["settings"] || "settings",
      createdAt: options.columns?.["createdAt"] || "created_at",
      updatedAt: options.columns?.["updatedAt"] || "updated_at"
    };
    this.oauthColumns = {
      userId: options.oauthColumns?.["userId"] || "user_id",
      provider: options.oauthColumns?.["provider"] || "provider",
      providerAccountId: options.oauthColumns?.["providerAccountId"] || "provider_account_id"
    };
    this.allowedFields = options.allowedFields || [
      "email",
      "name",
      "avatar",
      "emailVerified",
      "password",
      "role",
      "settings",
      "createdAt",
      "updatedAt"
    ];
  }
  mapUser(row) {
    if (!row) return null;
    const id = row[this.columns["id"]] ?? row["id"];
    const email = row[this.columns["email"]] ?? row["email"];
    const name = row[this.columns["name"]] ?? row["name"];
    const avatar = row[this.columns["avatar"]] ?? row["avatar"];
    const emailVerified = row[this.columns.emailVerified] ?? row["email_verified"];
    const role = row[this.columns.role] ?? row["role"];
    const settings = row[this.columns.settings] ?? row["settings"];
    const createdAt = row[this.columns.createdAt] ?? row["created_at"];
    const updatedAt = row[this.columns.updatedAt] ?? row["updated_at"];
    if (typeof id !== "string" && typeof id !== "number") return null;
    if (typeof email !== "string") return null;
    if (typeof name !== "string") return null;
    if (avatar !== null && typeof avatar !== "string") return null;
    if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
      return null;
    }
    if (role !== null && role !== void 0 && typeof role !== "string") {
      return null;
    }
    if (settings !== null && settings !== void 0 && typeof settings !== "string") {
      return null;
    }
    if (createdAt !== null && createdAt !== void 0 && typeof createdAt !== "string") {
      return null;
    }
    if (updatedAt !== null && updatedAt !== void 0 && typeof updatedAt !== "string") {
      return null;
    }
    let parsedSettings;
    if (typeof settings === "string" && settings.trim().length > 0) {
      try {
        const decoded = JSON.parse(settings);
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
          parsedSettings = decoded;
        }
      } catch {
      }
    }
    const createdAtDate = typeof createdAt === "string" && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt) : void 0;
    const updatedAtDate = typeof updatedAt === "string" && !Number.isNaN(new Date(updatedAt).getTime()) ? new Date(updatedAt) : void 0;
    return {
      id: String(id),
      email,
      name,
      avatar,
      emailVerified: Boolean(emailVerified),
      ...typeof role === "string" ? { role } : {},
      ...parsedSettings ? { settings: parsedSettings } : {},
      ...createdAtDate ? { createdAt: createdAtDate } : {},
      ...updatedAtDate ? { updatedAt: updatedAtDate } : {}
    };
  }
  _defaultSanitizeUser(user) {
    return user;
  }
  mapFieldToColumn(field) {
    if (field === "id") return this.columns.id;
    if (field === "email") return this.columns.email;
    if (field === "name") return this.columns.name;
    if (field === "avatar") return this.columns.avatar;
    if (field === "emailVerified") return this.columns.emailVerified;
    if (field === "password") return this.columns.password;
    if (field === "role") return this.columns.role;
    if (field === "settings") return this.columns.settings;
    if (field === "createdAt") return this.columns.createdAt;
    if (field === "updatedAt") return this.columns.updatedAt;
    return field;
  }
  coerceDbValue(value) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (value === null || value === void 0) return null;
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
  async createUser(profile, metadata = {}) {
    const userData = {
      email: profile.email,
      name: profile.name ?? profile.email,
      avatar: profile.picture ?? null,
      emailVerified: Boolean(profile.verified_email)
    };
    for (const [key, value] of Object.entries(metadata)) {
      if (!this.allowedFields.includes(key)) continue;
      userData[key] = value;
    }
    const fields = Object.keys(userData);
    const columns = fields.map((field) => this.mapFieldToColumn(field));
    const placeholders = fields.map(() => "?").join(", ");
    const values = fields.map((field) => this.coerceDbValue(userData[field]));
    const sql = `INSERT INTO ${this.usersTable} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = await this.db.prepare(sql).bind(...values).run();
    const id = result?.meta?.last_row_id;
    if (id === void 0) throw new Error("Failed to create user");
    const created = await this.getUserById(String(id), id);
    if (!created) throw new Error("Created user not found");
    return created;
  }
  async getUserById(id, rawId) {
    const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.id} = ? LIMIT 1`;
    const normalizedRow = await this.db.prepare(sql).bind(id).first();
    if (normalizedRow) {
      return this.sanitizeUser(this.mapUser(normalizedRow));
    }
    if (rawId !== void 0 && rawId !== id) {
      const rawRow = await this.db.prepare(sql).bind(rawId).first();
      return this.sanitizeUser(this.mapUser(rawRow));
    }
    return null;
  }
  async getUserByEmail(email) {
    const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(email).first();
    return this.sanitizeUser(this.mapUser(row));
  }
  async getUserByProviderId(provider, providerId) {
    const sql = `SELECT u.* FROM ${this.oauthAccountsTable} o
			JOIN ${this.usersTable} u ON o.${this.oauthColumns.userId} = u.${this.columns.id}
			WHERE o.${this.oauthColumns.provider} = ? AND o.${this.oauthColumns.providerAccountId} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(provider, providerId).first();
    return this.sanitizeUser(this.mapUser(row));
  }
  async updateUser(id, data) {
    const fields = Object.keys(data);
    if (fields.length === 0) {
      const existing = await this.getUserById(id);
      if (!existing) throw new Error("User not found");
      return existing;
    }
    for (const field of fields) {
      if (!this.allowedFields.includes(field)) {
        throw new Error(`Field not allowed for update: ${field}`);
      }
    }
    const mappedFields = fields.map((field) => this.mapFieldToColumn(field));
    const setClause = mappedFields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((field) => this.coerceDbValue(data[field]));
    const sql = `UPDATE ${this.usersTable} SET ${setClause} WHERE ${this.columns.id} = ?`;
    await this.db.prepare(sql).bind(...values, id).run();
    const updated = await this.getUserById(id);
    if (!updated) throw new Error("Updated user not found");
    return updated;
  }
  async deleteUser(id) {
    await this.db.prepare(`DELETE FROM ${this.usersTable} WHERE ${this.columns.id} = ?`).bind(id).run();
  }
  async linkOAuthAccount(userId, provider, providerAccountId) {
    const sql = `INSERT INTO ${this.oauthAccountsTable} (${this.oauthColumns.userId}, ${this.oauthColumns.provider}, ${this.oauthColumns.providerAccountId}) VALUES (?, ?, ?)`;
    await this.db.prepare(sql).bind(userId, provider, providerAccountId).run();
  }
  async getUserWithPasswordHash(email) {
    const sql = `SELECT * FROM ${this.usersTable} WHERE ${this.columns.email} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(email).first();
    const mapped = this.mapUser(row);
    if (!mapped) return null;
    const password = row?.[this.columns["password"]] ?? row?.["password"];
    return {
      ...mapped,
      password: typeof password === "string" ? password : null
    };
  }
};

// src/adapters/oauth-token/base.ts
var TokenAdapter = class {
};
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

// src/adapters/verification-token/base.ts
var VerificationTokenAdapter = class {
};
function toToken(row) {
  if (!row) return null;
  const id = row["id"];
  const userId = row["userId"] ?? row["user_id"];
  const type = row["type"];
  const token = row["token"];
  const expiresAt = row["expiresAt"] ?? row["expires_at"];
  const createdAt = row["createdAt"] ?? row["created_at"];
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof userId !== "string" && typeof userId !== "number") return null;
  if (typeof type !== "string") return null;
  if (typeof token !== "string") return null;
  if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
  const expiresDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) return null;
  const createdDate = createdAt instanceof Date ? createdAt : typeof createdAt === "string" ? new Date(createdAt) : /* @__PURE__ */ new Date();
  return {
    id: String(id),
    userId: String(userId),
    type,
    token,
    expiresAt: expiresDate,
    createdAt: Number.isNaN(createdDate.getTime()) ? /* @__PURE__ */ new Date() : createdDate
  };
}
function toUser3(row) {
  if (!row) return null;
  const id = row["id"];
  const email = row["email"];
  const name = row["name"];
  const avatar = row["avatar"] ?? null;
  const emailVerified = row["emailVerified"] ?? row["email_verified"] ?? false;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof email !== "string") return null;
  if (typeof name !== "string") return null;
  if (avatar !== null && typeof avatar !== "string") return null;
  if (typeof emailVerified !== "boolean" && emailVerified !== 0 && emailVerified !== 1) {
    return null;
  }
  return {
    id: String(id),
    email,
    name,
    avatar,
    emailVerified: Boolean(emailVerified)
  };
}
var DrizzleVerificationTokenAdapter = class extends VerificationTokenAdapter {
  db;
  tokensTable;
  usersTable;
  constructor(db, options = {}) {
    super();
    if (!db) {
      throw new Error("DrizzleVerificationTokenAdapter requires a database instance");
    }
    if (!options.tokensTable) {
      throw new Error("DrizzleVerificationTokenAdapter requires tokensTable option");
    }
    if (!options.usersTable) {
      throw new Error("DrizzleVerificationTokenAdapter requires usersTable option");
    }
    this.db = db;
    this.tokensTable = options.tokensTable;
    this.usersTable = options.usersTable;
  }
  async create({
    userId,
    type,
    token,
    expiresAt
  }) {
    await this.db.insert(this.tokensTable).values({
      userId,
      type,
      token,
      expiresAt
    });
  }
  async findByToken({ token, type }) {
    const [record] = await this.db.select({
      token: this.tokensTable,
      user: this.usersTable
    }).from(this.tokensTable).innerJoin(
      this.usersTable,
      eq(requireColumn(this.tokensTable, "userId"), requireColumn(this.usersTable, "id"))
    ).where(
      requireCondition(and(eq(this.tokensTable.token, token), eq(this.tokensTable.type, type)))
    );
    if (!record) return null;
    const tokenRecord = toToken(record["token"] ?? null);
    const user = toUser3(record["user"] ?? null);
    if (!tokenRecord || !user) return null;
    return { token: tokenRecord, user };
  }
  async deleteById(tokenId) {
    await this.db.delete(this.tokensTable).where(eq(requireColumn(this.tokensTable, "id"), tokenId));
  }
  async deleteByUserAndType({ userId, type }) {
    await this.db.delete(this.tokensTable).where(
      requireCondition(
        and(eq(this.tokensTable.userId, userId), eq(this.tokensTable.type, type))
      )
    );
  }
};

// src/adapters/verification-token/d1.ts
var D1VerificationTokenAdapter = class extends VerificationTokenAdapter {
  db;
  tokensTable;
  usersTable;
  columns;
  userColumns;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.tokensTable = options.tokensTable || "verification_tokens";
    this.usersTable = options.usersTable || "users";
    this.columns = {
      id: options.columns?.["id"] || "id",
      userId: options.columns?.["userId"] || "user_id",
      type: options.columns?.["type"] || "type",
      token: options.columns?.["token"] || "token",
      expiresAt: options.columns?.["expiresAt"] || "expires_at"
    };
    this.userColumns = {
      id: options.userColumns?.["id"] || "id",
      email: options.userColumns?.["email"] || "email",
      name: options.userColumns?.["name"] || "name",
      avatar: options.userColumns?.["avatar"] || "avatar"
    };
  }
  coerceDbId(id) {
    return /^\d+$/.test(id) ? Number(id) : id;
  }
  mapTokenAndUser(row) {
    if (!row) return null;
    const tokenId = row[this.columns.id];
    const userId = row[this.columns.userId];
    const type = row[this.columns.type];
    const token = row[this.columns.token];
    const expiresAt = row[this.columns.expiresAt];
    const email = row[this.userColumns.email];
    const name = row[this.userColumns.name];
    const avatar = row[this.userColumns.avatar];
    if (typeof tokenId !== "string" && typeof tokenId !== "number" || typeof userId !== "string" && typeof userId !== "number" || typeof type !== "string" || typeof token !== "string" || typeof expiresAt !== "string" || typeof email !== "string" || typeof name !== "string" || avatar !== null && typeof avatar !== "string") {
      return null;
    }
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) return null;
    const tokenRecord = {
      id: String(tokenId),
      userId: String(userId),
      type,
      token,
      expiresAt: expiresAtDate,
      createdAt: /* @__PURE__ */ new Date()
    };
    const user = {
      id: String(userId),
      email,
      name,
      avatar,
      emailVerified: true
    };
    return { token: tokenRecord, user };
  }
  async create({
    userId,
    type,
    token,
    expiresAt
  }) {
    await this.db.prepare(
      `INSERT INTO ${this.tokensTable} (${this.columns.id}, ${this.columns.userId}, ${this.columns.type}, ${this.columns.token}, ${this.columns.expiresAt}) VALUES (?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      this.coerceDbId(userId),
      type,
      token,
      expiresAt.toISOString()
    ).run();
  }
  async findByToken({ token, type }) {
    const row = await this.db.prepare(
      `SELECT t.*, u.* FROM ${this.tokensTable} t JOIN ${this.usersTable} u ON t.${this.columns.userId} = u.${this.userColumns.id} WHERE t.${this.columns.token} = ? AND t.${this.columns.type} = ? LIMIT 1`
    ).bind(token, type).first();
    return this.mapTokenAndUser(row);
  }
  async deleteById(tokenId) {
    await this.db.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.id} = ?`).bind(tokenId).run();
  }
  async deleteByUserAndType({ userId, type }) {
    await this.db.prepare(
      `DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ? AND ${this.columns.type} = ?`
    ).bind(this.coerceDbId(userId), type).run();
  }
};

// src/adapters/magic-link/base.ts
var MagicLinkAdapter = class {
};
function mapTokenRow(row, columns) {
  if (!row) return null;
  const id = row[columns.id];
  const userId = row[columns.userId] ?? null;
  const email = row[columns.email];
  const tokenHash = row[columns.tokenHash];
  const otpHash = row[columns.otpHash] ?? null;
  const expiresAt = row[columns.expiresAt];
  const createdAt = row[columns.createdAt];
  if (typeof id !== "string") return null;
  if (userId !== null && typeof userId !== "string" && typeof userId !== "number") return null;
  if (typeof email !== "string") return null;
  if (typeof tokenHash !== "string") return null;
  if (otpHash !== null && typeof otpHash !== "string") return null;
  if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
  const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiresAtDate.getTime())) return null;
  const createdAtDate = createdAt instanceof Date ? createdAt : typeof createdAt === "string" ? new Date(createdAt) : /* @__PURE__ */ new Date();
  return {
    id,
    userId: userId === null ? null : String(userId),
    email,
    tokenHash,
    otpHash,
    expiresAt: expiresAtDate,
    createdAt: Number.isNaN(createdAtDate.getTime()) ? /* @__PURE__ */ new Date() : createdAtDate
  };
}
var DrizzleMagicLinkAdapter = class extends MagicLinkAdapter {
  db;
  tokensTable;
  columns;
  constructor(db, options = {}) {
    super();
    if (!options.tokensTable) {
      throw new Error("DrizzleMagicLinkAdapter requires tokensTable option");
    }
    this.db = db;
    this.tokensTable = options.tokensTable;
    this.columns = {
      id: options.columns?.["id"] || "id",
      userId: options.columns?.["userId"] || "userId",
      email: options.columns?.["email"] || "email",
      tokenHash: options.columns?.["tokenHash"] || "tokenHash",
      otpHash: options.columns?.["otpHash"] || "otpHash",
      expiresAt: options.columns?.["expiresAt"] || "expiresAt",
      createdAt: options.columns?.["createdAt"] || "createdAt"
    };
  }
  async createToken({
    userId,
    email,
    tokenHash,
    otpHash,
    expiresAt,
    metadata
  }) {
    const values = {
      [this.columns.userId]: userId,
      [this.columns.email]: email,
      [this.columns.tokenHash]: tokenHash,
      [this.columns.otpHash]: otpHash ?? null,
      [this.columns.expiresAt]: expiresAt,
      ...metadata ?? {}
    };
    await this.db.insert(this.tokensTable).values(values);
    const found = await this.findByTokenHash(tokenHash);
    if (found) return found;
    return {
      id: crypto.randomUUID(),
      userId,
      email,
      tokenHash,
      otpHash: otpHash ?? null,
      expiresAt,
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  async findByTokenHash(tokenHash) {
    const [row] = await this.db.select().from(this.tokensTable).where(eq(requireColumn(this.tokensTable, this.columns.tokenHash), tokenHash));
    return mapTokenRow(row ?? null, this.columns);
  }
  async findByEmailAndOtpHash({
    email,
    otpHash
  }) {
    const [row] = await this.db.select().from(this.tokensTable).where(
      requireCondition(and(
        eq(requireColumn(this.tokensTable, this.columns.email), email),
        eq(requireColumn(this.tokensTable, this.columns.otpHash), otpHash)
      ))
    );
    return mapTokenRow(row ?? null, this.columns);
  }
  async deleteById(tokenId) {
    await this.db.delete(this.tokensTable).where(eq(requireColumn(this.tokensTable, this.columns.id), tokenId));
  }
  async deleteByUserId(userId) {
    await this.db.delete(this.tokensTable).where(eq(requireColumn(this.tokensTable, this.columns.userId), userId));
  }
  async deleteByEmail(email) {
    await this.db.delete(this.tokensTable).where(eq(requireColumn(this.tokensTable, this.columns.email), email));
  }
};

// src/adapters/magic-link/d1.ts
var D1MagicLinkAdapter = class extends MagicLinkAdapter {
  db;
  tokensTable;
  columns;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.tokensTable = options.tokensTable || "magic_link_tokens";
    this.columns = {
      id: options.columns?.["id"] || "id",
      userId: options.columns?.["userId"] || "user_id",
      email: options.columns?.["email"] || "email",
      tokenHash: options.columns?.["tokenHash"] || "token_hash",
      otpHash: options.columns?.["otpHash"] || "otp_hash",
      expiresAt: options.columns?.["expiresAt"] || "expires_at",
      createdAt: options.columns?.["createdAt"] || "created_at"
    };
  }
  async createToken({
    userId,
    email,
    tokenHash,
    otpHash,
    expiresAt,
    metadata
  }) {
    const id = crypto.randomUUID();
    const sql = `INSERT INTO ${this.tokensTable} (${this.columns.id}, ${this.columns.userId}, ${this.columns.email}, ${this.columns.tokenHash}, ${this.columns.otpHash}, ${this.columns.expiresAt}) VALUES (?, ?, ?, ?, ?, ?)`;
    await this.db.prepare(sql).bind(id, userId, email, tokenHash, otpHash ?? null, expiresAt.toISOString()).run();
    return {
      id,
      userId,
      email,
      tokenHash,
      otpHash: otpHash ?? null,
      expiresAt,
      createdAt: /* @__PURE__ */ new Date(),
      ...metadata
    };
  }
  async findByTokenHash(tokenHash) {
    const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.tokenHash} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(tokenHash).first();
    return this.mapRow(row);
  }
  async findByEmailAndOtpHash({
    email,
    otpHash
  }) {
    const sql = `SELECT * FROM ${this.tokensTable} WHERE ${this.columns.email} = ? AND ${this.columns.otpHash} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(email, otpHash).first();
    return this.mapRow(row);
  }
  async deleteById(tokenId) {
    await this.db.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.id} = ?`).bind(tokenId).run();
  }
  async deleteByUserId(userId) {
    await this.db.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.userId} = ?`).bind(userId).run();
  }
  async deleteByEmail(email) {
    await this.db.prepare(`DELETE FROM ${this.tokensTable} WHERE ${this.columns.email} = ?`).bind(email).run();
  }
  mapRow(row) {
    if (!row) return null;
    const id = row[this.columns["id"]] ?? row["id"];
    const userId = row[this.columns.userId] ?? row["user_id"];
    const email = row[this.columns["email"]] ?? row["email"];
    const tokenHash = row[this.columns.tokenHash] ?? row["token_hash"];
    const otpHash = row[this.columns.otpHash] ?? row["otp_hash"];
    const expiresAt = row[this.columns.expiresAt] ?? row["expires_at"];
    const createdAt = row[this.columns.createdAt] ?? row["created_at"];
    if (typeof id !== "string") return null;
    if (userId !== null && typeof userId !== "string") return null;
    if (typeof email !== "string") return null;
    if (typeof tokenHash !== "string") return null;
    if (otpHash !== null && typeof otpHash !== "string") return null;
    if (typeof expiresAt !== "string") return null;
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) return null;
    const createdAtDate = typeof createdAt === "string" && !Number.isNaN(new Date(createdAt).getTime()) ? new Date(createdAt) : /* @__PURE__ */ new Date();
    return {
      id,
      userId,
      email,
      tokenHash,
      otpHash,
      expiresAt: expiresAtDate,
      createdAt: createdAtDate
    };
  }
};

// src/adapters/webauthn/base.ts
var WebAuthnAdapter = class {
};
function mapChallengeRow(row, columns) {
  if (!row) return null;
  const id = row[columns.challengeId];
  const userId = row[columns.challengeUserId] ?? null;
  const challenge = row[columns.challenge];
  const type = row[columns.challengeType];
  const expiresAt = row[columns.challengeExpiresAt];
  if (typeof id !== "string") return null;
  if (userId !== null && typeof userId !== "string" && typeof userId !== "number") return null;
  if (typeof challenge !== "string") return null;
  if (typeof type !== "string") return null;
  if (!(expiresAt instanceof Date) && typeof expiresAt !== "string") return null;
  const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiresAtDate.getTime())) return null;
  return {
    id,
    userId: userId === null ? null : String(userId),
    challenge,
    type,
    expiresAt: expiresAtDate
  };
}
function mapCredentialRow(row, columns) {
  if (!row) return null;
  const credentialId = row[columns.credentialId];
  const userId = row[columns.userId];
  const publicKey = row[columns.publicKey];
  const counter = row[columns.counter];
  const transportsRaw = row[columns.transports] ?? null;
  const name = row[columns.name] ?? null;
  const createdAt = row[columns.createdAt];
  const updatedAt = row[columns.updatedAt];
  if (typeof credentialId !== "string") return null;
  if (typeof userId !== "string" && typeof userId !== "number") return null;
  if (typeof publicKey !== "string") return null;
  if (typeof counter !== "number") return null;
  if (transportsRaw !== null && typeof transportsRaw !== "string") return null;
  if (name !== null && typeof name !== "string") return null;
  let transports = null;
  if (typeof transportsRaw === "string") {
    const parsed = JSON.parse(transportsRaw);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      return null;
    }
    transports = parsed;
  }
  const createdAtDate = createdAt instanceof Date ? createdAt : typeof createdAt === "string" ? new Date(createdAt) : /* @__PURE__ */ new Date();
  const updatedAtDate = updatedAt instanceof Date ? updatedAt : typeof updatedAt === "string" ? new Date(updatedAt) : /* @__PURE__ */ new Date();
  return {
    id: credentialId,
    userId: String(userId),
    credentialId,
    publicKey,
    counter,
    transports,
    name,
    createdAt: Number.isNaN(createdAtDate.getTime()) ? /* @__PURE__ */ new Date() : createdAtDate,
    updatedAt: Number.isNaN(updatedAtDate.getTime()) ? /* @__PURE__ */ new Date() : updatedAtDate
  };
}
var DrizzleWebAuthnAdapter = class extends WebAuthnAdapter {
  db;
  credentialsTable;
  challengesTable;
  columns;
  constructor(db, options = {}) {
    super();
    if (!options.credentialsTable || !options.challengesTable) {
      throw new Error(
        "DrizzleWebAuthnAdapter requires credentialsTable and challengesTable options"
      );
    }
    this.db = db;
    this.credentialsTable = options.credentialsTable;
    this.challengesTable = options.challengesTable;
    this.columns = {
      credentialId: options.columns?.["credentialId"] || "credentialId",
      userId: options.columns?.["userId"] || "userId",
      publicKey: options.columns?.["publicKey"] || "publicKey",
      counter: options.columns?.["counter"] || "counter",
      transports: options.columns?.["transports"] || "transports",
      name: options.columns?.["name"] || "name",
      createdAt: options.columns?.["createdAt"] || "createdAt",
      updatedAt: options.columns?.["updatedAt"] || "updatedAt",
      challengeId: options.columns?.["challengeId"] || "id",
      challenge: options.columns?.["challenge"] || "challenge",
      challengeType: options.columns?.["challengeType"] || "type",
      challengeUserId: options.columns?.["challengeUserId"] || "userId",
      challengeExpiresAt: options.columns?.["challengeExpiresAt"] || "expiresAt"
    };
  }
  async createChallenge({
    challengeId,
    userId,
    challenge,
    type,
    expiresAt
  }) {
    await this.db.insert(this.challengesTable).values({
      [this.columns.challengeId]: challengeId,
      [this.columns.challengeUserId]: userId,
      [this.columns.challenge]: challenge,
      [this.columns.challengeType]: type,
      [this.columns.challengeExpiresAt]: expiresAt
    });
  }
  async getChallenge(challengeId) {
    const [row] = await this.db.select().from(this.challengesTable).where(eq(requireColumn(this.challengesTable, this.columns.challengeId), challengeId));
    return mapChallengeRow(row ?? null, this.columns);
  }
  async deleteChallenge(challengeId) {
    await this.db.delete(this.challengesTable).where(eq(requireColumn(this.challengesTable, this.columns.challengeId), challengeId));
  }
  async createCredential({
    userId,
    credentialId,
    publicKey,
    counter,
    transports,
    name
  }) {
    await this.db.insert(this.credentialsTable).values({
      [this.columns.userId]: userId,
      [this.columns.credentialId]: credentialId,
      [this.columns.publicKey]: publicKey,
      [this.columns.counter]: counter,
      [this.columns.transports]: transports ? JSON.stringify(transports) : null,
      [this.columns.name]: name ?? null
    });
  }
  async getCredential(credentialId) {
    const [row] = await this.db.select().from(this.credentialsTable).where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
    return mapCredentialRow(row ?? null, this.columns);
  }
  async listCredentials(userId) {
    const rows = await this.db.select().from(this.credentialsTable).where(eq(requireColumn(this.credentialsTable, this.columns.userId), userId));
    const credentials = [];
    for (const row of rows) {
      const credential = mapCredentialRow(row, this.columns);
      if (credential) credentials.push(credential);
    }
    return credentials;
  }
  async updateCredential(credentialId, updates) {
    const payload = {};
    const columnLookup = this.columns;
    for (const [key, value] of Object.entries(updates)) {
      const mappedColumn = columnLookup[key] || key;
      if (mappedColumn === this.columns.transports && Array.isArray(value)) {
        if (value.every((entry) => typeof entry === "string")) {
          payload[mappedColumn] = JSON.stringify(value);
        }
        continue;
      }
      payload[mappedColumn] = value;
    }
    if (Object.keys(payload).length === 0) return;
    await this.db.update(this.credentialsTable).set(payload).where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
  }
  async deleteCredential(credentialId) {
    await this.db.delete(this.credentialsTable).where(eq(requireColumn(this.credentialsTable, this.columns.credentialId), credentialId));
  }
  async deleteUserCredentials(userId) {
    await this.db.delete(this.credentialsTable).where(eq(requireColumn(this.credentialsTable, this.columns.userId), userId));
  }
};

// src/adapters/webauthn/d1.ts
var D1WebAuthnAdapter = class extends WebAuthnAdapter {
  db;
  credentialsTable;
  challengesTable;
  columns;
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.credentialsTable = options.credentialsTable || "webauthn_credentials";
    this.challengesTable = options.challengesTable || "webauthn_challenges";
    this.columns = {
      credentialId: options.columns?.["credentialId"] || "credential_id",
      userId: options.columns?.["userId"] || "user_id",
      publicKey: options.columns?.["publicKey"] || "public_key",
      counter: options.columns?.["counter"] || "counter",
      transports: options.columns?.["transports"] || "transports",
      name: options.columns?.["name"] || "name",
      createdAt: options.columns?.["createdAt"] || "created_at",
      updatedAt: options.columns?.["updatedAt"] || "updated_at",
      challengeId: options.columns?.["challengeId"] || "id",
      challenge: options.columns?.["challenge"] || "challenge",
      challengeType: options.columns?.["challengeType"] || "type",
      challengeUserId: options.columns?.["challengeUserId"] || "user_id",
      challengeExpiresAt: options.columns?.["challengeExpiresAt"] || "expires_at"
    };
  }
  async createChallenge({
    challengeId,
    userId,
    challenge,
    type,
    expiresAt
  }) {
    const sql = `INSERT INTO ${this.challengesTable} (${this.columns.challengeId}, ${this.columns.challengeUserId}, ${this.columns.challenge}, ${this.columns.challengeType}, ${this.columns.challengeExpiresAt}) VALUES (?, ?, ?, ?, ?)`;
    await this.db.prepare(sql).bind(
      challengeId,
      userId,
      challenge,
      type,
      expiresAt.toISOString()
    ).run();
  }
  mapChallenge(row) {
    if (!row) return null;
    const id = row[this.columns.challengeId];
    const userId = row[this.columns.challengeUserId];
    const challenge = row[this.columns.challenge];
    const type = row[this.columns.challengeType];
    const expiresAt = row[this.columns.challengeExpiresAt];
    if (typeof id !== "string") return null;
    if (userId !== null && typeof userId !== "string" && typeof userId !== "number") {
      return null;
    }
    if (typeof challenge !== "string") return null;
    if (typeof type !== "string") return null;
    if (typeof expiresAt !== "string") return null;
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) return null;
    return {
      id,
      userId: userId === null ? null : String(userId),
      challenge,
      type,
      expiresAt: expiresAtDate
    };
  }
  mapCredential(row) {
    const credentialId = row[this.columns.credentialId];
    const userId = row[this.columns.userId];
    const publicKey = row[this.columns.publicKey];
    const counter = row[this.columns.counter];
    const transportsRaw = row[this.columns.transports];
    const name = row[this.columns.name] ?? null;
    const createdAtRaw = row[this.columns.createdAt];
    const updatedAtRaw = row[this.columns.updatedAt];
    if (typeof credentialId !== "string") return null;
    if (typeof userId !== "string" && typeof userId !== "number") return null;
    if (typeof publicKey !== "string") return null;
    if (typeof counter !== "number") return null;
    if (transportsRaw !== null && typeof transportsRaw !== "string") return null;
    if (name !== null && typeof name !== "string") return null;
    let transports = null;
    if (typeof transportsRaw === "string") {
      try {
        const parsed = JSON.parse(transportsRaw);
        if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
          return null;
        }
        transports = parsed;
      } catch {
        return null;
      }
    }
    const createdAt = typeof createdAtRaw === "string" && !Number.isNaN(new Date(createdAtRaw).getTime()) ? new Date(createdAtRaw) : /* @__PURE__ */ new Date();
    const updatedAt = typeof updatedAtRaw === "string" && !Number.isNaN(new Date(updatedAtRaw).getTime()) ? new Date(updatedAtRaw) : /* @__PURE__ */ new Date();
    return {
      id: credentialId,
      userId: String(userId),
      credentialId,
      publicKey,
      counter,
      transports,
      name,
      createdAt,
      updatedAt
    };
  }
  async getChallenge(challengeId) {
    const sql = `SELECT * FROM ${this.challengesTable} WHERE ${this.columns.challengeId} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(challengeId).first();
    return this.mapChallenge(row);
  }
  async deleteChallenge(challengeId) {
    await this.db.prepare(
      `DELETE FROM ${this.challengesTable} WHERE ${this.columns.challengeId} = ?`
    ).bind(challengeId).run();
  }
  async createCredential({
    userId,
    credentialId,
    publicKey,
    counter,
    transports,
    name
  }) {
    const sql = `INSERT INTO ${this.credentialsTable} (${this.columns.userId}, ${this.columns.credentialId}, ${this.columns.publicKey}, ${this.columns.counter}, ${this.columns.transports}, ${this.columns.name}) VALUES (?, ?, ?, ?, ?, ?)`;
    await this.db.prepare(sql).bind(
      userId,
      credentialId,
      publicKey,
      counter,
      transports ? JSON.stringify(transports) : null,
      name ?? null
    ).run();
  }
  async getCredential(credentialId) {
    const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ? LIMIT 1`;
    const row = await this.db.prepare(sql).bind(credentialId).first();
    if (!row) return null;
    return this.mapCredential(row);
  }
  async listCredentials(userId) {
    const sql = `SELECT * FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`;
    const result = await this.db.prepare(sql).bind(userId).all();
    const rows = result?.results ?? [];
    const credentials = [];
    for (const row of rows) {
      const credential = this.mapCredential(row);
      if (credential) credentials.push(credential);
    }
    return credentials;
  }
  async updateCredential(credentialId, updates) {
    const payload = /* @__PURE__ */ new Map();
    for (const [key, value] of Object.entries(updates)) {
      const column = this.columns[key] || key;
      if (column === this.columns.transports && Array.isArray(value)) {
        if (value.every((entry) => typeof entry === "string")) {
          payload.set(column, JSON.stringify(value));
        }
        continue;
      }
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        payload.set(column, value);
      }
    }
    const fields = Array.from(payload.keys());
    if (fields.length === 0) return;
    const setSql = fields.map((field) => `${field} = ?`).join(", ");
    const sql = `UPDATE ${this.credentialsTable} SET ${setSql} WHERE ${this.columns.credentialId} = ?`;
    const values = fields.map((field) => payload.get(field) ?? null);
    await this.db.prepare(sql).bind(...values, credentialId).run();
  }
  async deleteCredential(credentialId) {
    await this.db.prepare(
      `DELETE FROM ${this.credentialsTable} WHERE ${this.columns.credentialId} = ?`
    ).bind(credentialId).run();
  }
  async deleteUserCredentials(userId) {
    await this.db.prepare(
      `DELETE FROM ${this.credentialsTable} WHERE ${this.columns.userId} = ?`
    ).bind(userId).run();
  }
};

// src/adapters/drizzle/index.ts
function getTable(key, options) {
  const explicit = options.tables?.[key];
  if (explicit) return explicit;
  return options.schema?.[key];
}
function requireTable(key, options) {
  const found = getTable(key, options);
  if (!found) {
    throw new Error(
      `drizzleAdapter requires '${key}' table. Pass it via options.schema.${key} or options.tables.${key}.`
    );
  }
  return found;
}
function drizzleAdapter(db, options = {}) {
  const usersTable = requireTable("users", options);
  const sessionsTable = requireTable("sessions", options);
  const oauthAccountsTable = getTable("oauthAccounts", options);
  const user = new DrizzleUserAdapter(db, {
    usersTable,
    ...oauthAccountsTable ? { oauthAccountsTable } : {},
    ...options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {}
  });
  const session = new DrizzleSessionAdapter(db, {
    sessionsTable,
    usersTable,
    ...options.session?.sessionLifetime !== void 0 ? { sessionLifetime: options.session.sessionLifetime } : {},
    ...options.session?.sessionRefreshThreshold !== void 0 ? { sessionRefreshThreshold: options.session.sessionRefreshThreshold } : {},
    ...options.session?.cookieName !== void 0 ? { cookieName: options.session.cookieName } : {},
    ...options.session?.secureCookies !== void 0 ? { secureCookies: options.session.secureCookies } : {},
    ...options.sanitizeUser ? { sanitizeUser: options.sanitizeUser } : {}
  });
  const oauthTokensTable = getTable("oauthTokens", options);
  const oauthToken = oauthTokensTable ? new DrizzleTokenAdapter(db, {
    tokensTable: oauthTokensTable,
    ...options.oauthTokenEncryptionKey !== void 0 ? { encryptionKey: options.oauthTokenEncryptionKey } : {},
    encrypt: options.oauthTokenEncrypt ?? (typeof options.oauthTokenEncryptionKey === "string" && options.oauthTokenEncryptionKey.length > 0)
  }) : void 0;
  const verificationTokensTable = getTable("verificationTokens", options);
  const verificationToken = verificationTokensTable ? new DrizzleVerificationTokenAdapter(db, {
    tokensTable: verificationTokensTable,
    usersTable
  }) : void 0;
  const magicLinkTokensTable = getTable("magicLinkTokens", options);
  const magicLink = magicLinkTokensTable ? new DrizzleMagicLinkAdapter(db, { tokensTable: magicLinkTokensTable }) : void 0;
  const webauthnCredentials = getTable("webauthnCredentials", options);
  const webauthnChallenges = getTable("webauthnChallenges", options);
  const webauthn = webauthnCredentials && webauthnChallenges ? new DrizzleWebAuthnAdapter(db, {
    credentialsTable: webauthnCredentials,
    challengesTable: webauthnChallenges
  }) : void 0;
  return {
    session,
    user,
    ...oauthToken ? { oauthToken } : {},
    ...verificationToken ? { verificationToken } : {},
    ...magicLink ? { magicLink } : {},
    ...webauthn ? { webauthn } : {}
  };
}

export { CookieSessionAdapter, CookieTokenAdapter, D1MagicLinkAdapter, D1SessionAdapter, D1TokenAdapter, D1UserAdapter, D1VerificationTokenAdapter, D1WebAuthnAdapter, DrizzleMagicLinkAdapter, DrizzleSessionAdapter, DrizzleTokenAdapter, DrizzleUserAdapter, DrizzleVerificationTokenAdapter, DrizzleWebAuthnAdapter, MagicLinkAdapter, SessionAdapter, TokenAdapter, UserAdapter, VerificationTokenAdapter, WebAuthnAdapter, drizzleAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map