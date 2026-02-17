import { SessionAdapter } from "../adapters/session/base.js";
import { UserAdapter } from "../adapters/database/base.js";
import { TokenAdapter } from "../adapters/oauth-token/base.js";
import type { OAuthProfile, OAuthTokens, Session, User } from "../types/index.js";

export class MockSessionAdapter extends SessionAdapter {
	private sessions = new Map<string, Session>();
	private users = new Map<string, User>();

	setUser(user: User): void {
		this.users.set(String(user.id), user);
	}

	async createSession(userId: string): Promise<Session> {
		const session: Session = {
			id: `session:${crypto.randomUUID()}`,
			userId,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};
		this.sessions.set(session.id, session);
		return session;
	}

	async validateSession(sessionId: string): Promise<{ session: Session | null; user: User | null }> {
		const session = this.sessions.get(sessionId) ?? null;
		const user = session ? this.users.get(session.userId) ?? null : null;
		return { session, user };
	}

	async invalidateSession(sessionId: string): Promise<void> {
		this.sessions.delete(sessionId);
	}

	async invalidateUserSessions(userId: string): Promise<void> {
		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.userId === userId) this.sessions.delete(sessionId);
		}
	}

	async listSessions(userId: string): Promise<Session[]> {
		return [...this.sessions.values()].filter((session) => session.userId === userId);
	}

	setSessionCookie(): void {}
	deleteSessionCookie(): void {}
}

export class MockUserAdapter extends UserAdapter {
	private users = new Map<string, User & { password?: string | null }>();
	private oauthIndex = new Map<string, string>();

	async createUser(
		profile: OAuthProfile,
		metadata: Record<string, unknown> = {},
	): Promise<User> {
		const id = String((metadata["id"] as string | undefined) ?? profile.id ?? profile.email);
		const user: User & { password?: string | null } = {
			id,
			email: profile.email,
			name: profile.name ?? profile.email,
			avatar: profile.picture ?? null,
			emailVerified: Boolean(profile.verified_email),
			...(typeof metadata["password"] === "string"
				? { password: metadata["password"] }
				: {}),
		};
		this.users.set(id, user);
		return this.sanitize(user) ?? user;
	}

	async getUserById(id: string): Promise<User | null> {
		const user = this.users.get(String(id)) ?? null;
		return this.sanitize(user);
	}

	async getUserByEmail(email: string): Promise<User | null> {
		for (const user of this.users.values()) {
			if (user.email === email) return this.sanitize(user);
		}
		return null;
	}

	async getUserByProviderId(provider: string, providerId: string): Promise<User | null> {
		const userId = this.oauthIndex.get(`${provider}:${providerId}`);
		if (!userId) return null;
		return this.getUserById(userId);
	}

	async updateUser(
		id: string,
		data: Partial<User> & Record<string, unknown>,
	): Promise<User> {
		const user = this.users.get(String(id));
		if (!user) throw new Error("User not found");
		const next = { ...user, ...data };
		this.users.set(String(id), next);
		return this.sanitize(next) ?? next;
	}

	async deleteUser(id: string): Promise<void> {
		this.users.delete(String(id));
	}

	async linkOAuthAccount(
		userId: string,
		provider: string,
		providerAccountId: string,
	): Promise<void> {
		this.oauthIndex.set(`${provider}:${providerAccountId}`, String(userId));
	}

	async getUserWithPasswordHash(
		email: string,
	): Promise<(User & { password?: string | null }) | null> {
		for (const user of this.users.values()) {
			if (user.email === email) return user;
		}
		return null;
	}

	private sanitize(user: (User & { password?: string | null }) | null): User | null {
		if (!user) return null;
		const { password: _password, ...safe } = user;
		return safe;
	}
}

export class MockTokenAdapter extends TokenAdapter {
	private tokens = new Map<string, OAuthTokens>();

	async storeTokens(userId: string, provider: string, tokens: OAuthTokens): Promise<void> {
		this.tokens.set(`${userId}:${provider}`, tokens);
	}

	async getTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.tokens.get(`${userId}:${provider}`) ?? null;
	}

	async refreshTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
		return this.getTokens(userId, provider);
	}

	async deleteTokens(userId: string, provider: string): Promise<void> {
		this.tokens.delete(`${userId}:${provider}`);
	}
}
