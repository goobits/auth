const DEFAULT_WINDOW_MS = 60 * 1000;

export class MemoryRateLimitStore {
	private _data: Map<string, { count: number; resetAt: number }>;

	constructor() {
		this._data = new Map();
	}

	get(key: string): { count: number; resetAt: number } | null {
		return this._data.get(key) || null;
	}

	set(key: string, value: { count: number; resetAt: number }): void {
		this._data.set(key, value);
	}

	delete(key: string): void {
		this._data.delete(key);
	}
}

type RateLimiterConfig = {
	store?: MemoryRateLimitStore;
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
	windowMs = DEFAULT_WINDOW_MS,
	max = 5,
	keyPrefix = "rl",
}: RateLimiterConfig = {}): (key: string) => Promise<RateLimitResult> {
	return async function checkRateLimit(key: string): Promise<RateLimitResult> {
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
