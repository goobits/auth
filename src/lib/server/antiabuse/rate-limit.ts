export type RateLimitCheckResult = {
	allowed: boolean
	remaining: number
	resetAt: number
	count: number
}

type Bucket = {
	count: number
	resetAt: number
}

const buckets = new Map<string, Bucket>()

function nowMs() {
	return Date.now()
}

function touchBucket(key: string, windowMs: number): Bucket {
	const now = nowMs()
	const existing = buckets.get(key)
	if (!existing || existing.resetAt <= now) {
		const next: Bucket = { count: 0, resetAt: now + windowMs }
		buckets.set(key, next)
		return next
	}
	return existing
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitCheckResult {
	const bucket = touchBucket(key, windowMs)
	bucket.count += 1
	const allowed = bucket.count <= limit
	const remaining = Math.max(0, limit - bucket.count)
	return {
		allowed,
		remaining,
		resetAt: bucket.resetAt,
		count: bucket.count
	}
}

export function keyForRateLimit(prefix: string, value: string) {
	return `${prefix}:${value.trim().toLowerCase()}`
}

export function compactRateLimitBuckets(maxSize = 5000) {
	if (buckets.size <= maxSize) return
	const now = nowMs()
	for (const [key, bucket] of buckets.entries()) {
		if (bucket.resetAt <= now) {
			buckets.delete(key)
		}
		if (buckets.size <= maxSize) break
	}
}
