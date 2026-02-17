import { eq } from 'drizzle-orm';

// src/adapters/webauthn/base.ts
var WebAuthnAdapter = class {
};

// src/adapters/drizzle-types.ts
function requireColumn(table, column) {
  const found = table[column];
  if (!found) {
    throw new Error(`Missing column '${column}' in drizzle table configuration`);
  }
  return found;
}

// src/adapters/webauthn/drizzle.ts
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

export { D1WebAuthnAdapter, DrizzleWebAuthnAdapter, WebAuthnAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map