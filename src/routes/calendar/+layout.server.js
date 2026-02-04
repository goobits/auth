export function load({ locals }) {
	return {
		user: locals.calendarUser || null
	}
}
