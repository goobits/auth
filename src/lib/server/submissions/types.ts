export type JoinSubmission = {
	name: string;
	email: string;
	attendees: number;
	routePreference: string;
	notes: string;
};

export type VolunteerSubmission = {
	name: string;
	email: string;
	rolePreference: string;
	availability: string;
	notes: string;
};

export type ReminderSubmission = {
	email: string;
};

export type D1PreparedStatement = {
	bind: (...values: unknown[]) => {
		run: () => Promise<unknown>;
		first: () => Promise<Record<string, unknown> | null>;
		all: () => Promise<{ results?: Record<string, unknown>[] }>;
	};
};

export type D1DatabaseLike = {
	prepare: (query: string) => D1PreparedStatement;
};

export type PlatformWithDb = {
	env?: {
		DB?: unknown;
	};
};
