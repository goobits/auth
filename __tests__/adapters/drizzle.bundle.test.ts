import { describe, it, expect } from "vitest";
import { drizzleAdapter } from "../../src/adapters/drizzle/index.ts";
import type { DrizzleDbLike, DrizzleTable } from "../../src/adapters/drizzle-types.ts";

function createMockDb(): DrizzleDbLike {
	return {
		select: () => ({
			from: () => ({
				where: async () => [],
				innerJoin: () => ({ where: async () => [] }),
			}),
		}),
		insert: () => ({ values: async () => {} }),
		update: () => ({ set: () => ({ where: async () => {} }) }),
		delete: () => ({ where: async () => {} }),
	};
}

function table(columns: string[]): DrizzleTable {
	const value: DrizzleTable = {};
	for (const column of columns) {
		value[column] = {} as never;
	}
	return value;
}

describe("drizzleAdapter", () => {
	it("requires users and sessions tables", () => {
		const db = createMockDb();
		expect(() => drizzleAdapter(db, { schema: {} })).toThrow(
			"drizzleAdapter requires 'users' table",
		);
	});

	it("builds a full adapter bundle when tables exist", () => {
		const db = createMockDb();
		const schema = {
			users: table(["id", "email", "name", "avatar", "emailVerified"]),
			sessions: table(["id", "userId", "expiresAt"]),
			oauthAccounts: table(["userId", "provider", "providerAccountId"]),
			oauthTokens: table(["userId", "provider", "tokens"]),
			verificationTokens: table(["id", "userId", "type", "token", "expiresAt"]),
			magicLinkTokens: table(["id", "userId", "email", "tokenHash", "otpHash", "expiresAt", "createdAt"]),
			webauthnCredentials: table(["credentialId", "userId", "publicKey", "counter", "transports", "name", "createdAt", "updatedAt"]),
			webauthnChallenges: table(["id", "challenge", "type", "userId", "expiresAt"]),
		};

		const adapters = drizzleAdapter(db, {
			schema,
			oauthTokenEncryptionKey:
				"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
		});

		expect(adapters.session).toBeDefined();
		expect(adapters.user).toBeDefined();
		expect(adapters.oauthToken).toBeDefined();
		expect(adapters.verificationToken).toBeDefined();
		expect(adapters.magicLink).toBeDefined();
		expect(adapters.webauthn).toBeDefined();
	});
});
