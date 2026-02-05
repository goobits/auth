export async function hash() {
	throw new Error('Bcrypt is unavailable in this runtime.')
}

export async function verify() {
	throw new Error('Bcrypt is unavailable in this runtime.')
}
