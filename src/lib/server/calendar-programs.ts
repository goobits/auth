import { CALENDAR_ACTIVITY_LIST, type CalendarActivityConfig } from '$lib/booking/activities'
import { parseProgramEnabledValue, programSettingKey, type CalendarProgramSlug } from '$lib/booking/programs'
import type { D1DatabaseLike } from '$lib/dev/devDb'

type SettingRow = {
	key: string
	value: string
}

export type CalendarProgramState = CalendarActivityConfig & {
	enabled: boolean
}

async function readProgramSettings(db: D1DatabaseLike) {
	const keys = CALENDAR_ACTIVITY_LIST.map((activity) => `'${programSettingKey(activity.slug)}'`).join(', ')
	const query = `SELECT key, value FROM settings WHERE key IN (${keys})`
	const result = await db.prepare(query).all<SettingRow>()
	const rows = result?.results ?? []
	return new Map(rows.map((row) => [row.key, row.value]))
}

export async function getCalendarPrograms(db: D1DatabaseLike): Promise<CalendarProgramState[]> {
	const settings = await readProgramSettings(db)
	return CALENDAR_ACTIVITY_LIST.map((activity) => {
		const value = settings.get(programSettingKey(activity.slug))
		return {
			...activity,
			enabled: parseProgramEnabledValue(value)
		}
	})
}

export async function getEnabledCalendarPrograms(db: D1DatabaseLike): Promise<CalendarActivityConfig[]> {
	const programs = await getCalendarPrograms(db)
	return programs.filter((program) => program.enabled)
}

export async function isCalendarProgramEnabled(db: D1DatabaseLike, slug: CalendarProgramSlug) {
	const setting = await db.prepare(
		`SELECT value FROM settings WHERE key = ? LIMIT 1`
	).bind(programSettingKey(slug)).first<{ value: string }>()
	return parseProgramEnabledValue(setting?.value)
}

export async function setCalendarProgramEnabled(db: D1DatabaseLike, slug: CalendarProgramSlug, enabled: boolean) {
	const now = Date.now()
	const value = enabled ? '1' : '0'
	await db.prepare(
		`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	).bind(programSettingKey(slug), value, now).run()
}

