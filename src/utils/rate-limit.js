const DEFAULT_WINDOW_MS = 60 * 1000;

export class MemoryRateLimitStore {
	constructor() {
		this._data = new Map();
	}

	get(key) {
		return this._data.get(key) || null;
	}

	set(key, value) {
		this._data.set(key, value);
	}

	delete(key) {
		this._data.delete(key);
	}
}

export function createRateLimiter({
	store = new MemoryRateLimitStore(),
	windowMs = DEFAULT_WINDOW_MS,
	max = 5,
	keyPrefix = "rl",
} = {}) {
	return async function checkRateLimit(key) {
		const now = Date.now();
		const fullKey = `${keyPrefix}:${key}`;
		const record = store.get(fullKey);

		if (!record || now >= record.resetAt) {
			const resetAt = now + windowMs;
			store.set(fullKey, { count: 1, resetAt });
			return {
				allowed: true,
				remaining: max - 1,
				resetAt,
			};
		}

		if (record.count >= max) {
			return { allowed: false, remaining: 0, resetAt: record.resetAt };
		}

		record.count += 1;
		store.set(fullKey, record);

		return {
			allowed: true,
			remaining: max - record.count,
			resetAt: record.resetAt,
		};
	};
}
