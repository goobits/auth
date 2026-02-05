export function load({ locals }: { locals: Record<string, unknown> }) {
	return { preferences: locals.themePreferences }
}
