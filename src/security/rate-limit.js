export class MemoryRateLimitStore {
	constructor() {
		this._data = new Map();
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
}

export class KVRateLimitStore {
	constructor(namespace, options = {}) {
		this.namespace = namespace;
		this.ttlSeconds = options.ttlSeconds || null;
	}

	async get(key) {
		const value = await this.namespace.get(key, { type: "json" });
		return value || null;
	}

	async set(key, value, ttlMs) {
		const ttl =
			ttlMs != null
				? Math.ceil(ttlMs / 1000)
				: this.ttlSeconds;
		const options = ttl ? { expirationTtl: ttl } : undefined;
		await this.namespace.put(key, JSON.stringify(value), options);
	}

	async delete(key) {
		await this.namespace.delete(key);
	}
}

export function createRateLimiter({
	store = new MemoryRateLimitStore(),
	windowMs = 60 * 1000,
	max = 5,
	keyPrefix = "rl",
} = {}) {
	return async function checkRateLimit(key) {
		const now = Date.now();
		const fullKey = `${keyPrefix}:${key}`;
		const record = await store.get(fullKey);

		if (!record || now >= record.resetAt) {
			const resetAt = now + windowMs;
			const next = { count: 1, resetAt };
			await store.set(fullKey, next, windowMs);
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
