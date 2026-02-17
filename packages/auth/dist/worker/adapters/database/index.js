import { eq, and } from 'drizzle-orm';

// src/adapters/database/base.ts
var UserAdapter = class {
};

// src/adapters/drizzle-types.ts
function requireCondition(condition) {
  if (!condition) {
    throw new Error("Missing SQL condition");
  }
  return condition;
}

// src/adapters/database/drizzle.ts
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
    return this.sanitizeUser(toUser(row ?? null));
  }
  async getUserByEmail(email) {
    const [row] = await this.db.select().from(this.usersTable).where(eq(this.usersTable.email, email));
    return this.sanitizeUser(toUser(row ?? null));
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
    return this.sanitizeUser(toUser(result?.["user"] ?? null));
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
    const user = toUser(row);
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

export { D1UserAdapter, DrizzleUserAdapter, UserAdapter };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map