type CalendarUser = {
	avatarUrl?: string
	avatar?: string
	[key: string]: unknown
}

export function load({ locals }: { locals: { user?: CalendarUser } }) {
	const rawUser = locals.user
	const user = rawUser
		? { ...rawUser, avatarUrl: rawUser.avatarUrl || rawUser.avatar }
		: null
	return {
		user
	}
}
