function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	})
}

import { createSqliteDb } from '../../../lib/dev/sqliteDb.js'

let cachedDb = null

export function buildEnv() {
	if (!cachedDb) {
		cachedDb = createSqliteDb()
	}
	return {
		...process.env,
		DB: cachedDb
	}
}
