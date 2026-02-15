import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import type { D1DatabaseLike, D1PreparedStatement } from './devDb'

const DB_PATH = path.join(process.cwd(), '.dev', 'db.sqlite')
const MIGRATIONS_DIR = path.join(process.cwd(), 'packages', 'calendar', 'migrations')

function ensureDbDir() {
	const dir = path.dirname(DB_PATH)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
}

function runMigrations(db: Database.Database) {
	db.exec(`CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
	const applied = new Set(
		(db.prepare(`SELECT name FROM migrations`).all() as Array<Record<string, unknown>>)
			.map((row) => String(row['name']))
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

function wrapStatement(stmt: Database.Statement): D1PreparedStatement {
	let bound: unknown[] = []
	const statement: D1PreparedStatement = {
		bind(...args: unknown[]) {
			bound = args
			return statement
		},
		async first<T = Record<string, unknown>>() {
			return (stmt.get(...bound) as T | undefined) ?? null
		},
		async all<T = Record<string, unknown>>() {
			return { results: stmt.all(...bound) as T[] }
		},
		async run() {
			const info = stmt.run(...bound)
			// D1 exposes `last_row_id` as a number. better-sqlite3 types allow bigint.
			// In dev we coerce to number for API compatibility.
			return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }
		}
	}
	return statement
}

export function createSqliteDb(): D1DatabaseLike {
	ensureDbDir()
	const db = new Database(DB_PATH)
	runMigrations(db)

	return {
		prepare(sql: string) {
			return wrapStatement(db.prepare(sql))
		}
	}
}
