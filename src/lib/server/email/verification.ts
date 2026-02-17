import type { D1DatabaseLike } from '@miko/calendar-kit'

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24

function toUnixSeconds(dateMs: number) {
	return Math.floor(dateMs / 1000)
}

function fromHex(bytes: Uint8Array) {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string) {
	const bytes = new TextEncoder().encode(input)
	const digest = await crypto.subtle.digest('SHA-256', bytes)
	return fromHex(new Uint8Array(digest))
}

function randomToken() {
	const bytes = new Uint8Array(24)
	crypto.getRandomValues(bytes)
	return fromHex(bytes)
}

async function ensureVerificationTable(db: D1DatabaseLike) {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS calendar_email_verifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id TEXT NOT NULL,
			email TEXT NOT NULL,
			token_hash TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			consumed_at INTEGER,
			UNIQUE(token_hash)
		)
	`).run()
	await db.prepare(
		'CREATE INDEX IF NOT EXISTS idx_calendar_email_verifications_user ON calendar_email_verifications(user_id)'
	).run()
}

export async function issueEmailVerification({
	db,
	userId,
	email,
	baseUrl,
	env
}: {
	db: D1DatabaseLike
	userId: string
	email: string
	baseUrl: string
	env: Record<string, string | undefined>
}) {
	await ensureVerificationTable(db)

	const rawToken = randomToken()
	const tokenHash = await sha256Hex(rawToken)
	const nowMs = Date.now()
	const expiresAt = toUnixSeconds(nowMs + EMAIL_VERIFICATION_TTL_MS)
	const createdAt = toUnixSeconds(nowMs)

	await db.prepare(
		`INSERT INTO calendar_email_verifications (user_id, email, token_hash, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?)`
	).bind(userId, email.toLowerCase(), tokenHash, expiresAt, createdAt).run()

	const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`
	const webhook = env['EMAIL_VERIFICATION_WEBHOOK_URL'] || ''

	if (!webhook) {
		console.info('[register] email verification token issued (no webhook configured)', {
			email,
			verificationUrl
		})
		return { sent: false, verificationUrl }
	}

	const response = await fetch(webhook, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			event: 'email-verification',
			email,
			verificationUrl,
			sentAt: new Date().toISOString()
		})
	})

	if (!response.ok) {
		console.warn('[register] verification webhook failed', { status: response.status })
		return { sent: false, verificationUrl }
	}

	return { sent: true, verificationUrl }
}

export async function consumeEmailVerificationToken({
	db,
	email,
	token
}: {
	db: D1DatabaseLike
	email: string
	token: string
}) {
	await ensureVerificationTable(db)
	const tokenHash = await sha256Hex(token)
	const now = Math.floor(Date.now() / 1000)

	const row = await db.prepare(
		`SELECT id, user_id as userId, expires_at as expiresAt, consumed_at as consumedAt
		 FROM calendar_email_verifications
		 WHERE token_hash = ? AND email = ?
		 LIMIT 1`
	).bind(tokenHash, email.toLowerCase()).first<{ id: number; userId: string; expiresAt: number; consumedAt: number | null }>()

	if (!row) return { ok: false as const, reason: 'invalid' as const }
	if (row.consumedAt) return { ok: false as const, reason: 'already_used' as const }
	if (row.expiresAt < now) return { ok: false as const, reason: 'expired' as const }

	await db.prepare('UPDATE calendar_email_verifications SET consumed_at = ? WHERE id = ?').bind(now, row.id).run()
	await db.prepare('UPDATE calendar_users SET email_verified = 1 WHERE id = ?').bind(row.userId).run()

	return { ok: true as const, userId: row.userId }
}
