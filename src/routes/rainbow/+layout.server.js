export function load({ locals }) {
	return {
		user: locals.rainbowUser || null
	}
}
