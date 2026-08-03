export type D1Value = string | number | boolean | null
export type D1Row = Record<string, D1Value>

export interface D1Result<Row extends D1Row = D1Row> {
	results?: Row[]
	success?: boolean
	meta?: {
		changes?: number
		last_row_id?: string | number
	}
}

export interface D1PreparedStatement {
	bind(...values: D1Value[]): D1PreparedStatement
	first<Row extends D1Row = D1Row>(): Promise<Row | null>
	all<Row extends D1Row = D1Row>(): Promise<D1Result<Row>>
	run(): Promise<D1Result>
}

export interface D1DatabasePort {
	prepare(sql: string): D1PreparedStatement
	batch?(statements: D1PreparedStatement[]): Promise<D1Result[]>
}

export interface D1BatchDatabasePort extends D1DatabasePort {
	batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
}

export function isD1BatchDatabasePort(database: D1DatabasePort): database is D1BatchDatabasePort {
	return typeof database.batch === 'function'
}
