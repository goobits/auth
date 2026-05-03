export type RateLimitStore = {
	get: (key: string) => Promise<{ count: number; resetAt: number } | null>;
	set: (key: string, value: { count: number; resetAt: number }, ttlMs?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

export class MemoryRateLimitStore implements RateLimitStore {
	private _data: Map<string, { count: number; resetAt: number }>;
	private maxSize: number;

	constructor(options: { maxSize?: number } = {}) {
		this._data = new Map();
		this.maxSize = options.maxSize ?? 5000;
	}

	async get(key: string): Promise<{ count: number; resetAt: number } | null> {
		const record = this._data.get(key);
		if (!record) return null;
		if (record.resetAt && Date.now() > record.resetAt) {
			this._data.delete(key);
			return null;
		}
		return record;
	}

	async set(
		key: string,
		value: { count: number; resetAt: number },
	): Promise<void> {
		this.compact();
		if (!this._data.has(key) && this._data.size >= this.maxSize) {
			this.evictOldest();
		}
		this._data.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this._data.delete(key);
	}

	private compact(): void {
		const now = Date.now();
		for (const [key, record] of this._data.entries()) {
			if (record.resetAt <= now) this._data.delete(key);
		}
	}

	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestReset = Number.POSITIVE_INFINITY;
		for (const [key, record] of this._data.entries()) {
			if (record.resetAt < oldestReset) {
				oldestReset = record.resetAt;
				oldestKey = key;
			}
		}
		if (oldestKey) this._data.delete(oldestKey);
	}
}

type KVNamespaceLike = {
	get: (key: string, options?: { type: "json" }) => Promise<unknown>;
	put: (key: string, value: string, options?: { expirationTtl: number }) => Promise<void>;
	delete: (key: string) => Promise<void>;
};

export class KVRateLimitStore {
	private namespace: KVNamespaceLike;
	private ttlSeconds: number | null;

	constructor(
		namespace: KVNamespaceLike,
		options: { ttlSeconds?: number | null } = {},
	) {
		this.namespace = namespace;
		this.ttlSeconds = options.ttlSeconds || null;
	}

	async get(key: string): Promise<{ count: number; resetAt: number } | null> {
		const value = (await this.namespace.get(key, { type: "json" })) as
			| { count: number; resetAt: number }
			| null;
		return value || null;
	}

	async set(
		key: string,
		value: { count: number; resetAt: number },
		ttlMs?: number,
	): Promise<void> {
		const ttl =
			ttlMs != null
				? Math.ceil(ttlMs / 1000)
				: this.ttlSeconds;
		const options = ttl ? { expirationTtl: ttl } : undefined;
		await this.namespace.put(key, JSON.stringify(value), options);
	}

	async delete(key: string): Promise<void> {
		await this.namespace.delete(key);
	}
}

type RateLimiterConfig = {
	store?: RateLimitStore;
	windowMs?: number;
	max?: number;
	keyPrefix?: string;
};

type RateLimitResult = {
	allowed: boolean;
	remaining: number;
	resetAt: number;
};

export function createRateLimiter({
	store = new MemoryRateLimitStore(),
	windowMs = 60 * 1000,
	max = 5,
	keyPrefix = "rl",
}: RateLimiterConfig = {}): (key: string) => Promise<RateLimitResult> {
	return async function checkRateLimit(key: string): Promise<RateLimitResult> {
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
