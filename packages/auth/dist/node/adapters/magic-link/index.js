import { eq, and } from 'drizzle-orm';

// src/adapters/magic-link/base.ts
var MagicLinkAdapter = class {
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

// src/adapters/magic-link/drizzle.ts
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

export { D1MagicLinkAdapter, DrizzleMagicLinkAdapter, MagicLinkAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map