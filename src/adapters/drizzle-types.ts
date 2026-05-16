import type { SQLWrapper } from "drizzle-orm";

export type DrizzleScalar = string | number | boolean | Date | null;
export type DrizzleJson = DrizzleScalar | DrizzleJson[] | { [key: string]: DrizzleJson };
export type DrizzleRow = Record<string, DrizzleJson>;

export type DrizzleTable = Record<string, SQLWrapper>;

export type SelectQuery<T> = {
	from: (table: DrizzleTable) => {
		where: (condition: SQLWrapper) => Promise<T[]>;
		innerJoin: (
			table: DrizzleTable,
			on: SQLWrapper,
		) => {
			where: (condition: SQLWrapper) => Promise<T[]>;
		};
	};
};

export type InsertQuery = {
	values: (values: DrizzleRow) => Promise<void>;
};

export type UpdateQuery = {
	set: (values: DrizzleRow) => {
		where: (condition: SQLWrapper) => Promise<void>;
	};
};

export type DeleteQuery = {
	where: (condition: SQLWrapper) => Promise<void>;
};

export type DrizzleDbLike = {
	select(): SelectQuery<DrizzleRow>;
	select(fields: Record<string, DrizzleTable>): SelectQuery<Record<string, DrizzleRow>>;
	insert: (table: DrizzleTable) => InsertQuery;
	update: (table: DrizzleTable) => UpdateQuery;
	delete: (table: DrizzleTable) => DeleteQuery;
};

export function requireColumn(table: DrizzleTable, column: string): SQLWrapper {
	const found = table[column];
	if (!found) {
		throw new Error(`Missing column '${column}' in drizzle table configuration`);
	}
	return found;
}

export function requireCondition(condition: SQLWrapper | undefined): SQLWrapper {
	if (!condition) {
		throw new Error("Missing SQL condition");
	}
	return condition;
}
