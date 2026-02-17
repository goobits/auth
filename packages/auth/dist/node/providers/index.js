import { Google, Apple } from 'arctic';
import { decodeBase64IgnorePadding } from '@oslojs/encoding';
import { argon2id, argon2Verify } from 'hash-wasm';

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

// src/providers/base.ts
var OAuthProvider = class {
  name;
  config;
  /**
   * @param {string} name - Provider name (e.g., 'google', 'apple')
   * @param {Object} config - Provider configuration
   */
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }
  /**
   * Create authorization URL for OAuth flow
   * @param {string} state - CSRF state token
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string[]} scopes - OAuth scopes to request
   * @returns {URL} Authorization URL
   */
  createAuthorizationURL(state, codeVerifier, scopes) {
    throw new Error("createAuthorizationURL must be implemented");
  }
  /**
   * Validate authorization code and get user profile + tokens
   * @param {string} code - Authorization code from callback
   * @param {string} codeVerifier - PKCE code verifier
   * @returns {Promise<{profile: import('../types.js').OAuthProfile, tokens: import('../types.js').OAuthTokens}>}
   */
  async getUserProfile(code, codeVerifier, userData) {
    throw new Error("getUserProfile must be implemented");
  }
  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<import('../types.js').OAuthTokens>}
   */
  async refreshAccessToken(refreshToken) {
    throw new Error("refreshAccessToken must be implemented");
  }
};

// src/providers/google.ts
init_logger();
var GoogleProvider = class extends OAuthProvider {
  client;
  defaultScopes;
  readTokenValue(value) {
    if (typeof value === "function") return value();
    return value ?? null;
  }
  /**
   * @param {Object} config - Configuration
   * @param {string} config.clientId - Google OAuth client ID
   * @param {string} config.clientSecret - Google OAuth client secret
   * @param {string} config.callbackUrl - OAuth callback URL
   * @param {string[]} [config.scopes] - Default OAuth scopes
   */
  constructor(config) {
    super("google", config);
    if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
      throw new Error(
        "GoogleProvider requires clientId, clientSecret, and callbackUrl"
      );
    }
    this.client = new Google(
      config.clientId,
      config.clientSecret,
      config.callbackUrl
    );
    this.defaultScopes = config.scopes || [
      "openid",
      "profile",
      "email"
    ];
  }
  createAuthorizationURL(state, codeVerifier, scopes = this.defaultScopes) {
    const requestedScopes = scopes || this.defaultScopes;
    return this.client.createAuthorizationURL(
      state,
      codeVerifier,
      requestedScopes
    );
  }
  async getUserProfile(code, codeVerifier) {
    try {
      const tokens = await this.client.validateAuthorizationCode(
        code,
        codeVerifier
      );
      const googleUserResponse = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
        {
          headers: {
            Authorization: `Bearer ${this.readTokenValue(tokens.accessToken) ?? ""}`
          }
        }
      );
      const googleUser = await googleUserResponse.json();
      if (!googleUser.verified_email) {
        throw new Error("Google email not verified");
      }
      const profile = {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        verified_email: googleUser.verified_email
      };
      if (googleUser.picture) {
        profile.picture = googleUser.picture;
      }
      return {
        profile,
        tokens: {
          accessToken: tokens.data?.access_token ?? this.readTokenValue(tokens.accessToken) ?? "",
          refreshToken: tokens.data?.refresh_token ?? this.readTokenValue(tokens.refreshToken),
          scope: tokens.data?.scope ?? tokens.scope ?? null,
          accessTokenExpiresAt: new Date(
            Date.now() + (tokens.data?.expires_in ?? tokens.expiresIn ?? 0) * 1e3
          ).toISOString()
        }
      };
    } catch (error) {
      getLogger().error?.("Error in GoogleProvider.getUserProfile:", error);
      throw error;
    }
  }
  async refreshAccessToken(refreshToken) {
    const newTokens = await this.client.refreshAccessToken(
      refreshToken
    );
    return {
      accessToken: this.readTokenValue(newTokens.accessToken) ?? "",
      refreshToken: this.readTokenValue(newTokens.refreshToken),
      scope: newTokens.scope ?? newTokens.scopes ?? null,
      accessTokenExpiresAt: new Date(
        Date.now() + (newTokens.expiresIn ?? newTokens.expires_in ?? 0) * 1e3
      ).toISOString()
    };
  }
};

// src/providers/apple.ts
init_logger();
var AppleProvider = class extends OAuthProvider {
  client;
  readTokenValue(value) {
    if (typeof value === "function") return value();
    return value ?? null;
  }
  /**
   * @param {Object} config - Configuration
   * @param {string} config.clientId - Apple Services ID
   * @param {string} config.teamId - Apple Team ID
   * @param {string} config.keyId - Apple Key ID
   * @param {string} config.privateKey - Apple Private Key (base64 encoded)
   * @param {string} config.callbackUrl - OAuth callback URL
   */
  constructor(config) {
    super("apple", config);
    if (!config.clientId || !config.teamId || !config.keyId || !config.privateKey || !config.callbackUrl) {
      throw new Error(
        "AppleProvider requires clientId, teamId, keyId, privateKey, and callbackUrl"
      );
    }
    const privateKeyBytes = this._decodePrivateKey(config.privateKey);
    this.client = new Apple(
      config.clientId,
      config.teamId,
      config.keyId,
      privateKeyBytes,
      config.callbackUrl
    );
  }
  /**
   * Decode base64 private key
   * @param {string} privateKey - Base64 encoded private key
   * @returns {Uint8Array}
   * @private
   */
  _decodePrivateKey(privateKey) {
    try {
      const cleaned = privateKey.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replaceAll("\r", "").replaceAll("\n", "").trim();
      return decodeBase64IgnorePadding(cleaned);
    } catch (error) {
      getLogger().error?.("Error decoding Apple private key:", error);
      throw new Error("Invalid Apple private key format");
    }
  }
  createAuthorizationURL(state, codeVerifier, scopes = ["name", "email"]) {
    const requestedScopes = scopes || ["name", "email"];
    const client = this.client;
    const createAuthorizationURL = client.createAuthorizationURL;
    if (createAuthorizationURL.length >= 3) {
      return createAuthorizationURL.call(
        this.client,
        state,
        codeVerifier,
        requestedScopes
      );
    }
    return createAuthorizationURL.call(this.client, state, requestedScopes);
  }
  /**
   * Get user profile from Apple
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} [userData] - Optional user data from first-time sign in (JSON string)
   * @returns {Promise<{profile: Object, tokens: Object}>}
   */
  async getUserProfile(code, codeVerifier, userData = null) {
    try {
      const client = this.client;
      const validateAuthorizationCode = client.validateAuthorizationCode;
      const tokens = validateAuthorizationCode.length >= 2 ? await validateAuthorizationCode.call(
        this.client,
        code,
        codeVerifier
      ) : await validateAuthorizationCode.call(this.client, code);
      const { email, sub: appleUserId } = tokens.idToken();
      if (!email || !appleUserId) {
        throw new Error("Invalid token data from Apple");
      }
      let name = void 0;
      if (userData) {
        try {
          const userJson = JSON.parse(userData);
          if (userJson.name) {
            const firstName = userJson.name.firstName || "";
            const lastName = userJson.name.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) name = fullName;
          }
        } catch (e) {
          getLogger().warn?.("Could not parse Apple user data:", e);
        }
      }
      return {
        profile: {
          id: appleUserId,
          email,
          ...name && { name },
          verified_email: true
          // Apple emails are always verified
        },
        tokens: {
          accessToken: this.readTokenValue(tokens.accessToken) ?? "",
          refreshToken: this.readTokenValue(tokens.refreshToken),
          scope: tokens.scope ?? tokens.scopes ?? null,
          accessTokenExpiresAt: new Date(
            Date.now() + (tokens.expiresIn ?? tokens.expires_in ?? 0) * 1e3
          ).toISOString()
        }
      };
    } catch (error) {
      getLogger().error?.("Error in AppleProvider.getUserProfile:", error);
      throw error;
    }
  }
  async refreshAccessToken(refreshToken) {
    const client = this.client;
    const newTokens = await client.refreshAccessToken(refreshToken);
    return {
      accessToken: this.readTokenValue(newTokens.accessToken) ?? "",
      refreshToken: this.readTokenValue(newTokens.refreshToken),
      scope: newTokens.scope ?? newTokens.scopes ?? null,
      accessTokenExpiresAt: new Date(
        Date.now() + (newTokens.expiresIn ?? newTokens.expires_in ?? 0) * 1e3
      ).toISOString()
    };
  }
};
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

// src/providers/credentials.ts
var CredentialsProvider = class _CredentialsProvider {
  name;
  validatePassword;
  identifierField;
  allowBoth;
  normalizeIdentifier;
  hashPassword;
  verifyPassword;
  /**
   * @param {Object} [options] - Configuration options
   * @param {Function} [options.validatePassword] - Custom password validation function
   */
  constructor(options = {}) {
    this.name = "credentials";
    if (options.validatePassword) this.validatePassword = options.validatePassword;
    this.identifierField = options.identifierField ?? "email";
    this.allowBoth = options.allowBoth ?? false;
    this.normalizeIdentifier = options.normalizeIdentifier ?? ((value) => value.trim().toLowerCase());
    this.hashPassword = options.hashPassword ?? hashPassword;
    this.verifyPassword = options.verifyPassword ?? verifyPassword;
  }
  withIdentifier(identifierField, options = {}) {
    const providerOptions = {
      identifierField,
      allowBoth: options.allowBoth ?? this.allowBoth,
      normalizeIdentifier: options.normalizeIdentifier ?? this.normalizeIdentifier,
      hashPassword: this.hashPassword,
      verifyPassword: this.verifyPassword
    };
    if (this.validatePassword) {
      providerOptions.validatePassword = this.validatePassword;
    }
    return new _CredentialsProvider(providerOptions);
  }
  /**
   * Authenticate a user with email and password
   * @param {Object} params
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @param {import('../adapters/database/base.js').UserAdapter} params.userAdapter - User adapter
   * @returns {Promise<{user: Object, valid: boolean}>}
   */
  async authenticate({
    email,
    identifier,
    identifierField,
    allowBoth,
    password,
    userAdapter
  }) {
    const rawIdentifier = identifier ?? email ?? "";
    if (!rawIdentifier || !password) {
      return { user: null, valid: false };
    }
    const resolvedField = identifierField ?? this.identifierField;
    const resolvedAllowBoth = allowBoth ?? this.allowBoth;
    const normalizedIdentifier = this.normalizeIdentifier(rawIdentifier);
    let user = null;
    let matchedField = null;
    const tryFields = resolvedAllowBoth ? Array.from(/* @__PURE__ */ new Set([resolvedField, "email"])) : [resolvedField];
    for (const field of tryFields) {
      if (field === "email") {
        user = await userAdapter.getUserWithPasswordHash(normalizedIdentifier);
      } else if (userAdapter.getUserWithPasswordHashByIdentifier) {
        user = await userAdapter.getUserWithPasswordHashByIdentifier(
          normalizedIdentifier,
          field
        );
      }
      if (user) {
        matchedField = field;
        break;
      }
    }
    if (!user || !user.password) {
      return { user: null, valid: false };
    }
    const valid = await this.verifyPassword(user.password, password);
    if (!valid) {
      return { user: null, valid: false };
    }
    const sanitized = matchedField === "email" ? await userAdapter.getUserByEmail(normalizedIdentifier) : userAdapter.getUserByIdentifier ? await userAdapter.getUserByIdentifier(
      normalizedIdentifier,
      matchedField ?? resolvedField
    ) : await userAdapter.getUserByEmail(normalizedIdentifier);
    return { user: sanitized, valid: true };
  }
  /**
   * Create a new user with email and password
   * @param {Object} params
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @param {string} [params.name] - User name
   * @param {Object} [params.metadata] - Additional user data
   * @param {import('../adapters/database/base.js').UserAdapter} params.userAdapter - User adapter
   * @returns {Promise<Object>} Created user (sanitized)
   */
  async signUp({
    email,
    password,
    name,
    metadata = {},
    userAdapter
  }) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    if (this.validatePassword) {
      const validation = this.validatePassword(password);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }
    }
    const passwordHash = await this.hashPassword(password);
    const profile = {
      id: email.toLowerCase(),
      email: email.toLowerCase(),
      verified_email: false
    };
    const fallbackName = email.split("@")[0] ?? "";
    if (name) {
      profile.name = name;
    } else if (fallbackName) {
      profile.name = fallbackName;
    }
    const user = await userAdapter.createUser(profile, {
      password: passwordHash,
      provider: "email",
      emailVerified: false,
      ...metadata
    });
    return user;
  }
  /**
   * Update user password
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.newPassword - New plain text password
   * @param {import('../adapters/database/base.js').UserAdapter} params.userAdapter - User adapter
   * @returns {Promise<Object>} Updated user (sanitized)
   */
  async updatePassword({
    userId,
    newPassword,
    userAdapter
  }) {
    if (!userId || !newPassword) {
      throw new Error("User ID and new password are required");
    }
    if (this.validatePassword) {
      const validation = this.validatePassword(newPassword);
      if (!validation.valid) {
        throw new Error(validation.errors.join(", "));
      }
    }
    const passwordHash = await this.hashPassword(newPassword);
    const user = await userAdapter.updateUser(userId, {
      password: passwordHash
    });
    return user;
  }
  /**
   * Verify current password before allowing update
   * @param {Object} params
   * @param {string} params.email - User email
   * @param {string} params.currentPassword - Current plain text password
   * @param {string} params.newPassword - New plain text password
   * @param {import('../adapters/database/base.js').UserAdapter} params.userAdapter - User adapter
   * @returns {Promise<{user: Object, valid: boolean}>}
   */
  async changePassword({
    email,
    currentPassword,
    newPassword,
    userAdapter
  }) {
    const { user, valid } = await this.authenticate({
      email,
      password: currentPassword,
      userAdapter
    });
    if (!valid || !user) {
      return { user: null, valid: false };
    }
    const userId = typeof user.id === "string" || typeof user.id === "number" ? String(user.id) : "";
    if (!userId) {
      return { user: null, valid: false };
    }
    const updatedUser = await this.updatePassword({
      userId,
      newPassword,
      userAdapter
    });
    return { user: updatedUser, valid: true };
  }
};

export { AppleProvider, CredentialsProvider, GoogleProvider, OAuthProvider };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map