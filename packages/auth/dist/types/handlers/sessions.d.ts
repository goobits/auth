import type { AuthLocals, RequestEventLike } from "../types/auth.js";
import type { SessionSummary, Session } from "../types/index.js";
type SessionAdapterLike = {
    listSessions?: (userId: string) => Promise<SessionSummary[]>;
    invalidateSession?: (sessionId: string) => Promise<void>;
    invalidateUserSessions?: (userId: string) => Promise<void>;
    deleteSessionCookie?: (cookies: RequestEventLike["cookies"]) => void;
};
type SessionHandlerConfig = {
    sessionAdapter: SessionAdapterLike;
    isAuthenticated?: (locals: AuthLocals) => boolean;
    getUser?: (locals: AuthLocals) => {
        id: string;
    };
    getSession?: (locals: AuthLocals) => Session | null;
};
export declare function createSessionListHandler(config: SessionHandlerConfig): (event: RequestEventLike) => Promise<Response>;
export declare function createSessionRevokeHandler(config: SessionHandlerConfig): (event: RequestEventLike) => Promise<Response>;
export {};
