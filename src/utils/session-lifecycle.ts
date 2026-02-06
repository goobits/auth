import { AuthPrincipalResolutionError } from "../errors/auth.ts";
import type { RequestEventLike } from "../types/auth.ts";
import type { Session } from "../types/index.ts";

type SessionAdapterLike = {
	createSession: (userId: string) => Promise<Session>;
	setSessionCookie?: (
		cookies: RequestEventLike["cookies"],
		session: Session,
	) => void;
};

export type OnLoginMode = "augment" | "manual";

export async function ensureSessionAfterLogin(input: {
	event: RequestEventLike;
	sessionAdapter: SessionAdapterLike;
	userId: string | null;
	autoCreateSession?: boolean;
	onLoginMode?: OnLoginMode;
}): Promise<string> {
	const {
		event,
		sessionAdapter,
		userId,
		autoCreateSession = true,
		onLoginMode = "augment",
	} = input;

	if (!userId) {
		throw new AuthPrincipalResolutionError();
	}

	if (autoCreateSession && onLoginMode === "augment") {
		const session = await sessionAdapter.createSession(userId);
		sessionAdapter.setSessionCookie?.(event.cookies, session);
	}

	return userId;
}
