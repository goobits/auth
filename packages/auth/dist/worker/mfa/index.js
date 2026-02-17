// src/mfa/totp.ts
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[value << 5 - bits & 31];
  }
  return output;
}
function fromBase32(input) {
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      output.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}
async function hmacSha1(keyBytes, messageBytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    messageBytes
  );
  return new Uint8Array(sig);
}
function intToBytes(num) {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = num & 255;
    num = Math.floor(num / 256);
  }
  return bytes;
}
function generateSecret({ length = 20 } = {}) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toBase32(bytes);
}
function createOtpAuthURL({
  secret = "",
  label = "",
  issuer = "",
  digits = 6,
  period = 30
} = {}) {
  const params = new URLSearchParams({
    secret,
    issuer,
    digits: String(digits),
    period: String(period)
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
async function generateTOTP({
  secret = "",
  time = Date.now(),
  digits = 6,
  period = 30
} = {}) {
  if (!secret) {
    throw new Error("TOTP secret is required");
  }
  const counter = Math.floor(time / 1e3 / period);
  const counterBytes = intToBytes(counter);
  const keyBytes = fromBase32(secret);
  const hash = await hmacSha1(keyBytes, counterBytes);
  const last = hash[hash.length - 1] ?? 0;
  const offset = last & 15;
  const code = ((hash[offset] ?? 0) & 127) << 24 | ((hash[offset + 1] ?? 0) & 255) << 16 | ((hash[offset + 2] ?? 0) & 255) << 8 | (hash[offset + 3] ?? 0) & 255;
  const otp = (code % 10 ** digits).toString().padStart(digits, "0");
  return otp;
}
async function verifyTOTP({
  secret = "",
  token = "",
  digits = 6,
  period = 30,
  window = 1,
  time = Date.now()
} = {}) {
  if (!secret || !token) return false;
  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const t = time + errorWindow * period * 1e3;
    const candidate = await generateTOTP({ secret, time: t, digits, period });
    if (candidate === token) return true;
  }
  return false;
}

// src/mfa/backup-codes.ts
var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length = 10) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}
function generateBackupCodes({
  count = 10,
  length = 10
} = {}) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(randomCode(length));
  }
  return codes;
}
async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required");
  }
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashBackupCodes(codes) {
  return Promise.all(codes.map((c) => sha256Hex(c)));
}
async function verifyBackupCode({
  code,
  hashedCodes
}) {
  if (!code || !hashedCodes?.length) return { valid: false };
  const hash = await sha256Hex(code);
  const idx = hashedCodes.indexOf(hash);
  if (idx === -1) return { valid: false };
  return { valid: true, hash, index: idx };
}

export { createOtpAuthURL, generateBackupCodes, generateSecret, generateTOTP, hashBackupCodes, verifyBackupCode, verifyTOTP };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map