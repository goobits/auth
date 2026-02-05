export function load({ locals }: { locals: Record<string, unknown> }) {
	const user = locals.user
		? { ...locals.user, avatarUrl: locals.user.avatarUrl || locals.user.avatar }
		: null
	return {
		user
	}
}
