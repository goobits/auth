import { CredentialsProvider } from '@goobits/auth/providers'
import { D1UserAdapter } from '@goobits/auth/adapters'
import type { D1DatabaseLike } from '@miko/calendar-kit'
import { issueEmailVerification } from '$lib/server/email/verification'

export type RegisterUserInput = {
	name: string
	email: string
	password: string
	baseUrl: string
	env: Record<string, string | undefined>
}

export type RegisterUserResult = {
	ok: boolean
	error?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string) {
	return email.trim().toLowerCase()
}

function validatePassword(password: string) {
	const trimmed = password.trim()
	if (trimmed.length < 10) return 'Password must be at least 10 characters.'
	if (!/[a-z]/.test(trimmed) || !/[A-Z]/.test(trimmed) || !/[0-9]/.test(trimmed)) {
		return 'Password must include upper, lower, and number.'
	}
	return ''
}

function createCredentialsProvider() {
	return new CredentialsProvider({
		validatePassword(password) {
			const message = validatePassword(password)
			if (!message) return { valid: true, errors: [] }
			return { valid: false, errors: [message] }
		}
	})
}

function createUserAdapter(db: D1DatabaseLike) {
	return new D1UserAdapter(db, {
		usersTable: 'calendar_users',
		oauthAccountsTable: 'calendar_oauth_accounts',
		columns: {
			id: 'id',
			email: 'email',
			name: 'name',
			avatar: 'avatar_url',
			emailVerified: 'email_verified',
			password: 'password'
		},
		oauthColumns: {
			userId: 'user_id',
			provider: 'provider',
			providerAccountId: 'provider_account_id'
		}
	})
}

export async function registerUser(db: D1DatabaseLike, input: RegisterUserInput): Promise<RegisterUserResult> {
	const email = normalizeEmail(input.email)
	const name = input.name.trim()
	const password = input.password

	if (!name || !email || !password) {
		return { ok: false, error: 'Please fill in all required fields.' }
	}
	if (!EMAIL_RE.test(email)) {
		return { ok: false, error: 'Please use a valid email address.' }
	}
	const passwordError = validatePassword(password)
	if (passwordError) {
		return { ok: false, error: passwordError }
	}

	const userAdapter = createUserAdapter(db)
	const existingUser = await userAdapter.getUserByEmail(email)
	if (existingUser) {
		return { ok: false, error: 'We could not complete that request. Please try again later.' }
	}

	const provider = createCredentialsProvider()
	const user = await provider.signUp({
		email,
		name,
		password,
		userAdapter
	})

	const userId = typeof user['id'] === 'string' ? user['id'] : ''
	if (!userId) {
		return { ok: false, error: 'We could not complete that request. Please try again later.' }
	}

	await issueEmailVerification({
		db,
		userId,
		email,
		baseUrl: input.baseUrl,
		env: input.env
	})

	return { ok: true }
}
