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
function bytesToHex(bytes) {
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
  return bytesToHex(bytes);
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
var KVRateLimitStore = class {
  namespace;
  ttlSeconds;
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.ttlSeconds = options.ttlSeconds || null;
  }
  async get(key) {
    const value = await this.namespace.get(key, { type: "json" });
    return value || null;
  }
  async set(key, value, ttlMs) {
    const ttl = ttlMs != null ? Math.ceil(ttlMs / 1e3) : this.ttlSeconds;
    const options = ttl ? { expirationTtl: ttl } : void 0;
    await this.namespace.put(key, JSON.stringify(value), options);
  }
  async delete(key) {
    await this.namespace.delete(key);
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

// src/security/audit.ts
function auditLog(event, options = {}) {
  const { logger = console, redactKeys = DEFAULT_REDACT_KEYS } = options;
  const safeEvent = redactObject(event, redactKeys);
  logger.info("audit", safeEvent);
}
function withAuditLogging({
  action = "unknown_action",
  includeRequestBody = false,
  includeResponse = false,
  logger = console,
  redactKeys = DEFAULT_REDACT_KEYS
} = {}) {
  return (handler) => {
    return async (event) => {
      const start = Date.now();
      const { request } = event;
      const locals = event.locals;
      const auditContext = {
        action,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        method: request.method,
        url: request.url,
        clientIP: locals["clientIP"] || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
        sessionId: locals["sessionId"] || null
      };
      if (includeRequestBody && request.method !== "GET") {
        try {
          auditContext["requestBody"] = await request.clone().json();
        } catch (error) {
          auditContext["requestBodyError"] = error instanceof Error ? error.message : String(error);
        }
      }
      auditLog(auditContext, { logger, redactKeys });
      try {
        const response = await handler(event);
        const duration = Date.now() - start;
        const result = {
          ...auditContext,
          status: response?.status || 200,
          duration,
          success: true
        };
        if (includeResponse) {
          try {
            const responseBody = await response.clone().json();
            result["responseBody"] = responseBody;
          } catch (error) {
            result["responseBodyError"] = error instanceof Error ? error.message : String(error);
          }
        }
        auditLog(result, { logger, redactKeys });
        return response;
      } catch (error) {
        const duration = Date.now() - start;
        auditLog(
          {
            ...auditContext,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : void 0,
            duration,
            success: false
          },
          { logger, redactKeys }
        );
        throw error;
      }
    };
  };
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      await emit("auth.failure", "error", 500, message);
      throw error;
    }
  };
}

// src/security/authorize.ts
function resolveRoles(actor) {
  const base = actor.role ? [actor.role] : [];
  return [...base, ...actor.roles ?? []];
}
async function emitDenied(context, message, details = {}) {
  if (!context.emitter) return;
  await context.emitter(
    createAuthEvent({
      name: "authz.denied",
      severity: "warn",
      route: context.event.url.pathname,
      method: context.event.request.method,
      status: 403,
      message,
      userId: context.event.locals.user?.id ? String(context.event.locals.user.id) : null,
      details
    })
  );
}
function requireAuthenticated(locals) {
  if (!locals.user) {
    throw new Error("Unauthorized");
  }
}
async function requireRole(context, requiredRoles) {
  requireAuthenticated(context.event.locals);
  const actor = context.event.locals.user;
  const roles = resolveRoles(actor);
  const ok = requiredRoles.some((role) => roles.includes(role));
  if (!ok) {
    await emitDenied(context, "Missing required role", {
      requiredRoles,
      actorRoles: roles
    });
    throw new Error("Forbidden");
  }
}
async function requireOwnership(context, resourceOwnerId) {
  requireAuthenticated(context.event.locals);
  const actorId = String(context.event.locals.user.id);
  if (actorId !== String(resourceOwnerId)) {
    await emitDenied(context, "Ownership check failed", {
      actorId,
      resourceOwnerId: String(resourceOwnerId)
    });
    throw new Error("Forbidden");
  }
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

// src/security/admin-auth.ts
function bytesToHex2(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual2(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return bytesToHex2(new Uint8Array(digest));
}
async function createAdminApiKey({
  prefix = "adm",
  bytes = 32
} = {}) {
  const random = await getRandomBytes(bytes);
  return `${prefix}_${bytesToHex2(random)}`;
}
async function hashAdminApiKey(apiKey, { salt = "" } = {}) {
  if (!apiKey) throw new Error("apiKey is required");
  return sha256Hex(`${salt}${apiKey}`);
}
async function verifyAdminApiKey(apiKey, hashed, { salt = "" } = {}) {
  if (!apiKey || !hashed) return false;
  const candidate = await hashAdminApiKey(apiKey, { salt });
  return timingSafeEqual2(candidate, hashed);
}
function parseApiKeyHeader(value) {
  if (!value) return null;
  if (value.startsWith("ApiKey ")) return value.slice(7);
  if (value.startsWith("Bearer ")) return value.slice(7);
  return value;
}

// src/security/recaptcha.ts
var DEFAULT_TIMEOUT_MS = 5e3;
async function verifyRecaptchaToken(token, options = {}) {
  const {
    secretKey = process.env["RECAPTCHA_SECRET_KEY"],
    action = null,
    minScore = 0.5,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    allowInDevelopment = true
  } = options;
  if (!token) return false;
  if (!secretKey) {
    return process.env["NODE_ENV"] === "production" ? false : allowInDevelopment;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: secretKey, response: token }),
        signal: controller.signal
      }
    );
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.success) return false;
    if (typeof data.score === "number") {
      if (data.score < minScore) return false;
      if (action && data.action !== action) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, KVRateLimitStore, MemoryCsrfStore, MemoryRateLimitStore, applySecurityPolicy, auditAuthEvent, auditLog, createAdminApiKey, createAuthEvent, createCsrfToken, createRateLimiter, createSecurityAlertObserver, createWebhookAlerter, hashAdminApiKey, issueCsrfToken, parseApiKeyHeader, requireAuthenticated, requireOwnership, requireRole, timingSafeEqual2 as timingSafeEqual, validateCsrfRequest, verifyAdminApiKey, verifyRecaptchaToken, withAuditLogging };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map