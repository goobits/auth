import type { UserAdapter } from '../adapters/database/UserAdapter.ts'
import type { MagicLinkAdapter } from '../adapters/magic-link/MagicLinkAdapter.ts'
import type { SessionAdapter } from '../adapters/session/SessionAdapter.ts'

export type MagicLinkTokenAdapter = Pick<
	MagicLinkAdapter,
	| 'createToken'
	| 'findByTokenHash'
	| 'findByEmailAndOtpHash'
	| 'consumeByTokenHash'
	| 'consumeByEmailAndOtpHash'
	| 'deleteById'
	| 'deleteByEmail'
>

export type MagicLinkUserAdapter = Pick<
	UserAdapter,
	'getUserByEmail' | 'getUserById' | 'createUser' | 'updateUser'
>

export type MagicLinkSessionAdapter = Pick<SessionAdapter, 'createSession'> &
	Partial<Pick<SessionAdapter, 'setSessionCookie'>>

export type MagicLinkTokenRecord = {
	id?: string
	userId?: string
	email?: string
	expiresAt?: string | Date
	[key: string]: unknown
}
