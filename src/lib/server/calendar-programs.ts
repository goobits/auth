import { CALENDAR_ACTIVITY_LIST, type CalendarActivityConfig } from '$lib/booking/activities'
import { isValidProgramSlug, type CalendarProgramSlug } from '$lib/booking/programs'
import type { D1DatabaseLike } from '$lib/dev/devDb'

export type CalendarProgramState = CalendarActivityConfig & {
	enabled: boolean
	sortOrder: number
}

type ProgramRow = {
	slug: string
	label: string
	activity_name: string
	page_title: string
	eyebrow: string
	hero_title_line_1: string
	hero_title_line_2: string | null
	hero_subtitle: string
	description: string
	icon: string
	eyebrow_class: string | null
	glow_class: string | null
	form_glow_class: string | null
	service_status_note: string | null
	enabled: number
	sort_order: number
}

function toProgram(row: ProgramRow): CalendarProgramState {
	const titleLines = row.hero_title_line_2
		? [row.hero_title_line_1, row.hero_title_line_2] as [string, string]
		: [row.hero_title_line_1] as [string]

	const base: CalendarProgramState = {
		slug: row.slug,
		href: `/calendar/${row.slug}`,
		label: row.label,
		activityName: row.activity_name,
		pageTitle: row.page_title,
		eyebrow: row.eyebrow,
		heroTitleLines: titleLines,
		heroSubtitle: row.hero_subtitle,
		description: row.description,
		icon: row.icon,
		enabled: row.enabled !== 0,
		sortOrder: row.sort_order ?? 0
	}
	if (row.eyebrow_class) base.eyebrowClass = row.eyebrow_class
	if (row.glow_class) base.glowClass = row.glow_class
	if (row.form_glow_class) base.formGlowClass = row.form_glow_class
	if (row.service_status_note) base.serviceStatusNote = row.service_status_note
	return base
}

async function listProgramRows(db: D1DatabaseLike) {
	const result = await db.prepare(
		`SELECT slug, label, activity_name, page_title, eyebrow, hero_title_line_1, hero_title_line_2,
		        hero_subtitle, description, icon, eyebrow_class, glow_class, form_glow_class,
		        service_status_note, enabled, sort_order
		 FROM calendar_programs
		 ORDER BY sort_order ASC, label ASC`
	).all<ProgramRow>()
	return result?.results ?? []
}

async function seedProgramRows(db: D1DatabaseLike) {
	for (const [index, program] of CALENDAR_ACTIVITY_LIST.entries()) {
		const titleLine2 = program.heroTitleLines.length > 1 ? program.heroTitleLines[1] : null
		await db.prepare(
			`INSERT OR IGNORE INTO calendar_programs (
			  slug, label, activity_name, page_title, eyebrow,
			  hero_title_line_1, hero_title_line_2, hero_subtitle, description, icon,
			  eyebrow_class, glow_class, form_glow_class, enabled, sort_order, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, unixepoch(), unixepoch())`
		).bind(
			program.slug,
			program.label,
			program.activityName,
			program.pageTitle,
			program.eyebrow,
			program.heroTitleLines[0],
			titleLine2,
			program.heroSubtitle,
			program.description,
			program.icon,
			program.eyebrowClass ?? null,
			program.glowClass ?? null,
			program.formGlowClass ?? null,
			(index + 1) * 10
		).run()
	}
}

export async function getCalendarPrograms(db: D1DatabaseLike): Promise<CalendarProgramState[]> {
	await seedProgramRows(db)
	const rows = await listProgramRows(db)
	return rows.map(toProgram)
}

export async function getEnabledCalendarPrograms(db: D1DatabaseLike): Promise<CalendarActivityConfig[]> {
	const programs = await getCalendarPrograms(db)
	return programs.filter((program) => program.enabled)
}

export async function isCalendarProgramEnabled(db: D1DatabaseLike, slug: CalendarProgramSlug) {
	const row = await db.prepare(
		`SELECT enabled FROM calendar_programs WHERE slug = ? LIMIT 1`
	).bind(slug).first<{ enabled: number }>()
	return row?.enabled !== 0
}

export async function setCalendarProgramEnabled(db: D1DatabaseLike, slug: CalendarProgramSlug, enabled: boolean) {
	await db.prepare(
		`UPDATE calendar_programs SET enabled = ?, updated_at = unixepoch() WHERE slug = ?`
	).bind(enabled ? 1 : 0, slug).run()
}

export async function getCalendarProgramBySlug(db: D1DatabaseLike, slug: string, options: { includeDisabled?: boolean } = {}) {
	const row = await db.prepare(
		`SELECT slug, label, activity_name, page_title, eyebrow, hero_title_line_1, hero_title_line_2,
		        hero_subtitle, description, icon, eyebrow_class, glow_class, form_glow_class,
		        service_status_note, enabled, sort_order
		 FROM calendar_programs
		 WHERE slug = ?
		 LIMIT 1`
	).bind(slug).first<ProgramRow>()
	if (!row) return null
	if (!options.includeDisabled && row.enabled === 0) return null
	return toProgram(row)
}

export async function getEnabledCalendarProgramByActivityName(db: D1DatabaseLike, activityName: string) {
	const row = await db.prepare(
		`SELECT slug, enabled
		 FROM calendar_programs
		 WHERE activity_name = ?
		 LIMIT 1`
	).bind(activityName).first<{ slug: string; enabled: number }>()
	if (!row || row.enabled === 0) return null
	return row.slug
}

export type CalendarProgramInput = {
	slug: string
	label: string
	activityName: string
	pageTitle: string
	eyebrow: string
	heroTitleLine1: string
	heroTitleLine2: string | null
	heroSubtitle: string
	description: string
	icon: string
	eyebrowClass: string | null
	glowClass: string | null
	formGlowClass: string | null
	serviceStatusNote: string | null
	enabled: boolean
	sortOrder: number
}

export async function upsertCalendarProgram(db: D1DatabaseLike, input: CalendarProgramInput) {
	if (!isValidProgramSlug(input.slug)) {
		throw new Error('Invalid program slug')
	}
	await db.prepare(
		`INSERT INTO calendar_programs (
		  slug, label, activity_name, page_title, eyebrow,
		  hero_title_line_1, hero_title_line_2, hero_subtitle, description, icon,
		  eyebrow_class, glow_class, form_glow_class, service_status_note, enabled, sort_order, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
		ON CONFLICT(slug) DO UPDATE SET
		  label = excluded.label,
		  activity_name = excluded.activity_name,
		  page_title = excluded.page_title,
		  eyebrow = excluded.eyebrow,
		  hero_title_line_1 = excluded.hero_title_line_1,
		  hero_title_line_2 = excluded.hero_title_line_2,
		  hero_subtitle = excluded.hero_subtitle,
		  description = excluded.description,
		  icon = excluded.icon,
		  eyebrow_class = excluded.eyebrow_class,
		  glow_class = excluded.glow_class,
		  form_glow_class = excluded.form_glow_class,
		  service_status_note = excluded.service_status_note,
		  enabled = excluded.enabled,
		  sort_order = excluded.sort_order,
		  updated_at = unixepoch()`
	).bind(
		input.slug,
		input.label,
		input.activityName,
		input.pageTitle,
		input.eyebrow,
		input.heroTitleLine1,
		input.heroTitleLine2,
		input.heroSubtitle,
		input.description,
		input.icon,
		input.eyebrowClass,
		input.glowClass,
		input.formGlowClass,
		input.serviceStatusNote,
		input.enabled ? 1 : 0,
		input.sortOrder
	).run()
}

export async function deleteCalendarProgram(db: D1DatabaseLike, slug: string) {
	await db.prepare(
		`DELETE FROM calendar_programs WHERE slug = ?`
	).bind(slug).run()
}
