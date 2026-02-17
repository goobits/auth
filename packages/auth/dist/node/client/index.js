import { decodeBase64url, encodeBase64url } from '@oslojs/encoding';

// src/client/index.ts
function toUint8Array(value) {
  if (!value) return new Uint8Array();
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "string") return decodeBase64url(value);
  return new Uint8Array(value);
}
function toBase64url(value) {
  return encodeBase64url(toUint8Array(value));
}
function parseCreationOptions(options) {
  const parsed = { ...options };
  parsed["challenge"] = toUint8Array(options["challenge"]);
  const user = options.user;
  if (user?.id) {
    parsed["user"] = { ...user, id: toUint8Array(user.id) };
  }
  const exclude = options.excludeCredentials;
  if (Array.isArray(exclude)) {
    parsed["excludeCredentials"] = exclude.map((cred) => ({
      ...cred,
      id: toUint8Array(cred.id)
    }));
  }
  return parsed;
}
function parseRequestOptions(options) {
  const parsed = { ...options };
  parsed["challenge"] = toUint8Array(options["challenge"]);
  const allow = options.allowCredentials;
  if (Array.isArray(allow)) {
    parsed["allowCredentials"] = allow.map((cred) => ({
      ...cred,
      id: toUint8Array(cred.id)
    }));
  }
  return parsed;
}
function serializeCredential(credential) {
  if (!credential) return null;
  const response = credential.response || {};
  return {
    id: credential.id,
    type: credential.type,
    rawId: toBase64url(credential.rawId),
    response: {
      attestationObject: response["attestationObject"] ? toBase64url(response["attestationObject"]) : void 0,
      clientDataJSON: response["clientDataJSON"] ? toBase64url(response["clientDataJSON"]) : void 0,
      authenticatorData: response["authenticatorData"] ? toBase64url(response["authenticatorData"]) : void 0,
      signature: response["signature"] ? toBase64url(response["signature"]) : void 0,
      userHandle: response["userHandle"] ? toBase64url(response["userHandle"]) : void 0,
      transports: response["getTransports"] ? response["getTransports"]() : void 0
    }
  };
}
function createAuthClient({
  baseUrl = "",
  endpoints = {},
  fetcher = fetch
} = {}) {
  const resolved = {
    magicLinkRequest: endpoints.magicLinkRequest || "/auth/magic",
    magicLinkVerify: endpoints.magicLinkVerify || "/auth/magic/verify",
    passkeyRegisterOptions: endpoints.passkeyRegisterOptions || "/auth/passkey/register/options",
    passkeyRegisterVerify: endpoints.passkeyRegisterVerify || "/auth/passkey/register/verify",
    passkeyLoginOptions: endpoints.passkeyLoginOptions || "/auth/passkey/login/options",
    passkeyLoginVerify: endpoints.passkeyLoginVerify || "/auth/passkey/login/verify",
    sessions: endpoints.sessions || "/auth/sessions"
  };
  const jsonHeaders = { "content-type": "application/json" };
  const withBase = (path) => `${baseUrl}${path}`;
  return {
    loginWithOAuth(provider) {
      if (!provider) throw new Error("Provider is required");
      const url = `${baseUrl}/auth/${provider}`;
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
      return url;
    },
    async sendMagicLink({
      email,
      redirectTo
    } = {}) {
      const response = await fetcher(withBase(resolved.magicLinkRequest), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ email, redirectTo })
      });
      return response.json();
    },
    async verifyMagicLink({
      token,
      otp,
      email
    } = {}) {
      const response = await fetcher(withBase(resolved.magicLinkVerify), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ token, otp, email })
      });
      return response.json();
    },
    async registerPasskey({ name } = {}) {
      if (!globalThis?.navigator?.credentials) {
        throw new Error("WebAuthn not supported in this environment");
      }
      const optionsRes = await fetcher(
        withBase(resolved.passkeyRegisterOptions),
        { method: "POST" }
      );
      const { options, challengeId } = await optionsRes.json();
      const credential = await navigator.credentials.create({
        publicKey: parseCreationOptions(options)
      });
      const verifyRes = await fetcher(
        withBase(resolved.passkeyRegisterVerify),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            challengeId,
            credential: serializeCredential(credential),
            name
          })
        }
      );
      return verifyRes.json();
    },
    async loginWithPasskey({ email } = {}) {
      if (!globalThis?.navigator?.credentials) {
        throw new Error("WebAuthn not supported in this environment");
      }
      const optionsRes = await fetcher(
        withBase(resolved.passkeyLoginOptions),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ email })
        }
      );
      const { options, challengeId } = await optionsRes.json();
      const credential = await navigator.credentials.get({
        publicKey: parseRequestOptions(options)
      });
      const verifyRes = await fetcher(
        withBase(resolved.passkeyLoginVerify),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            challengeId,
            credential: serializeCredential(credential)
          })
        }
      );
      return verifyRes.json();
    },
    async listSessions() {
      const response = await fetcher(withBase(resolved.sessions), {
        method: "GET"
      });
      return response.json();
    },
    async revokeSession({
      sessionId,
      all,
      others
    } = {}) {
      const response = await fetcher(withBase(resolved.sessions), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sessionId, all, others })
      });
      return response.json();
    }
  };
}

export { createAuthClient };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map