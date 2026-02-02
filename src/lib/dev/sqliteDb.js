import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const DB_PATH = path.join(process.cwd(), '.dev', 'db.sqlite')
const MIGRATION_PATH = path.join(process.cwd(), 'packages', 'calendar', 'migrations', '0001_calendar.sql')

function ensureDbDir() {
	const dir = path.dirname(DB_PATH)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

function runMigrations(db) {
	if (!fs.existsSync(MIGRATION_PATH)) {
		throw new Error('Missing migration file for calendar database')
	}
	const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8')
	db.exec(sql)
}

function wrapStatement(stmt) {
	let bound = []
	return {
		bind(...args) {
			bound = args
			return this
		},
		first() {
			return stmt.get(...bound) ?? null
		},
		all() {
			return { results: stmt.all(...bound) }
		},
		run() {
			const info = stmt.run(...bound)
			return { meta: { last_row_id: info.lastInsertRowid } }
		}
	}
}

export function createSqliteDb() {
	ensureDbDir()
	const db = new Database(DB_PATH)
	runMigrations(db)

	return {
		prepare(sql) {
			return wrapStatement(db.prepare(sql))
		}
	}
}
