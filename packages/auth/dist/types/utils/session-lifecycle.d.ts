import type { RequestEventLike } from "../types/auth.js";
import type { Session } from "../types/index.js";
type SessionAdapterLike = {
    createSession: (userId: string) => Promise<Session>;
    setSessionCookie?: (cookies: RequestEventLike["cookies"], session: Session) => void;
};
export type OnLoginMode = "augment" | "manual";
export declare function ensureSessionAfterLogin(input: {
    event: RequestEventLike;
    sessionAdapter: SessionAdapterLike;
    userId: string | null;
    autoCreateSession?: boolean;
    onLoginMode?: OnLoginMode;
}): Promise<string>;
export {};
