import { encodeBase64url } from '@oslojs/encoding';
import { eq } from 'drizzle-orm';

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

// src/adapters/session/kv.ts
function isKVSessionRecord(value) {
  if (!value || typeof value !== "object") return false;
  return "userId" in value && typeof value["userId"] === "string" && "expiresAt" in value && typeof value["expiresAt"] === "string";
}
var KVSessionAdapter = class extends SessionAdapter {
  namespace;
  sessionLifetime;
  sessionRefreshThreshold;
  cookieName;
  secureCookies;
  getUserById;
  sanitizeUser;
  keyPrefix;
  constructor(namespace, options = {}) {
    super();
    this.namespace = namespace;
    this.sessionLifetime = options.sessionLifetime || 30 * 24 * 60 * 60 * 1e3;
    this.sessionRefreshThreshold = options.sessionRefreshThreshold || this.sessionLifetime / 2;
    this.cookieName = options.cookieName || "session";
    this.secureCookies = options.secureCookies !== false;
    this.getUserById = options.getUserById || null;
    this.sanitizeUser = options.sanitizeUser || this._defaultSanitizeUser;
    this.keyPrefix = options.keyPrefix || "session";
  }
  _defaultSanitizeUser(user) {
    return user;
  }
  _key(sessionId) {
    return `${this.keyPrefix}:${sessionId}`;
  }
  async createSession(userId, metadata = {}) {
    const sessionId = await generateRandomUUID();
    const expiresAt = new Date(Date.now() + this.sessionLifetime);
    const payload = {
      userId,
      expiresAt: expiresAt.toISOString()
    };
    await this.namespace.put(
      this._key(sessionId),
      JSON.stringify(payload),
      { expirationTtl: Math.ceil(this.sessionLifetime / 1e3) }
    );
    return { id: sessionId, userId, expiresAt, ...metadata };
  }
  async validateSession(sessionId) {
    const rawValue = await this.namespace.get(this._key(sessionId), { type: "json" });
    const raw = isKVSessionRecord(rawValue) ? rawValue : null;
    if (!raw) return { session: null, user: null };
    const expiresAt = new Date(raw.expiresAt);
    if (Date.now() >= expiresAt.getTime()) {
      await this.namespace.delete(this._key(sessionId));
      return { session: null, user: null };
    }
    const shouldRefresh = Date.now() >= expiresAt.getTime() - this.sessionRefreshThreshold;
    let fresh = false;
    let newExpiresAt = expiresAt;
    if (shouldRefresh) {
      newExpiresAt = new Date(Date.now() + this.sessionLifetime);
      await this.namespace.put(
        this._key(sessionId),
        JSON.stringify({ userId: raw.userId, expiresAt: newExpiresAt.toISOString() }),
        { expirationTtl: Math.ceil(this.sessionLifetime / 1e3) }
      );
      fresh = true;
    }
    const user = this.getUserById ? this.sanitizeUser(await this.getUserById(String(raw.userId ?? ""))) : null;
    return {
      session: { id: sessionId, userId: raw.userId, expiresAt: newExpiresAt, fresh },
      user
    };
  }
  async invalidateSession(sessionId) {
    await this.namespace.delete(this._key(sessionId));
  }
  async invalidateUserSessions(_userId) {
    throw new Error("KVSessionAdapter does not support invalidateUserSessions");
  }
  async listSessions(userId) {
    if (typeof this.namespace.list !== "function") {
      throw new Error("KVSessionAdapter does not support listSessions");
    }
    const keys = await this.namespace.list({ prefix: `${this.keyPrefix}:` });
    const sessions = [];
    for (const key of keys.keys ?? []) {
      const rawValue = await this.namespace.get(key.name, { type: "json" });
      const raw = isKVSessionRecord(rawValue) ? rawValue : null;
      if (!raw) continue;
      if (raw.userId !== userId) continue;
      sessions.push({
        id: key.name.replace(`${this.keyPrefix}:`, ""),
        userId: raw.userId,
        expiresAt: new Date(raw.expiresAt)
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
    cookies.delete(this.cookieName, { path: "/" });
  }
};

export { CookieSessionAdapter, D1SessionAdapter, DrizzleSessionAdapter, KVSessionAdapter, SessionAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map