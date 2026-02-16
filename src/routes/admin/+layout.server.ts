export const prerender = false

export function load(event: { locals: { user?: unknown } }) {
	return {
		user: event.locals.user ?? null
	}
}
