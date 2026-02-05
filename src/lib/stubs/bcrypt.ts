type BcryptModule = {
	hash: (password: string, saltOrRounds?: number | string) => Promise<string>
	compare: (password: string, hash: string) => Promise<boolean>
}

async function getBcrypt(): Promise<BcryptModule> {
	const mod = await import('bcryptjs')
	const bcrypt = (mod.default ?? mod) as BcryptModule
	return bcrypt
}

function looksLikeBcryptHash(value: string) {
	return /^\$2[aby]\$/.test(value)
}

export async function hash(password: string, saltOrRounds: number | string = 10) {
	if (!password || typeof password !== 'string') {
		throw new Error('Password must be a non-empty string.')
	}
	const bcrypt = await getBcrypt()
	return bcrypt.hash(password, saltOrRounds)
}

export async function verify(a: string, b: string) {
	if (!a || !b) return false
	const bcrypt = await getBcrypt()
	const [password, hash] = looksLikeBcryptHash(a) ? [b, a] : [a, b]
	return bcrypt.compare(password, hash)
}
