import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const DB_PATH = path.join(process.cwd(), '.dev', 'db.sqlite')
const MIGRATIONS_DIR = path.join(process.cwd(), 'packages', 'calendar', 'migrations')

function ensureDbDir() {
	const dir = path.dirname(DB_PATH)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

function runMigrations(db) {
	db.exec(`CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
	const applied = new Set(
		db.prepare(`SELECT name FROM migrations`).all().map(row => row.name)
	)

	const files = fs.readdirSync(MIGRATIONS_DIR)
		.filter(f => f.endsWith('.sql'))
		.sort()

	const insertApplied = db.prepare(`INSERT INTO migrations (name, applied_at) VALUES (?, strftime('%s','now'))`)
	const run = db.transaction(() => {
		for (const file of files) {
			if (applied.has(file)) continue
			const migrationPath = path.join(MIGRATIONS_DIR, file)
			const sql = fs.readFileSync(migrationPath, 'utf-8')
			db.exec(sql)
			insertApplied.run(file)
		}
	})
	run()
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
			return { meta: { last_row_id: info.lastInsertRowid, changes: info.changes } }
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
