export function load({ locals }: { locals: any }) {
	const user = locals.user
		? { ...locals.user, avatarUrl: locals.user.avatarUrl || locals.user.avatar }
		: null
	return {
		user
	}
}
