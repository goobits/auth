import { type GenerateAuthenticationOptionsOpts, type GenerateRegistrationOptionsOpts } from "@simplewebauthn/server";
import type { RequestHandler } from "@sveltejs/kit";
import type { SessionAdapter } from "../adapters/session/base.js";
import type { WebAuthnAdapter } from "../adapters/webauthn/base.js";
import type { AuthHooks, RequestEventLike } from "../types/auth.js";
import type { User } from "../types/index.js";
import { type OnLoginMode } from "../utils/session-lifecycle.js";
export type WebAuthnRegisterOptionsHandlerConfig = {
    webauthnAdapter: Pick<WebAuthnAdapter, "listCredentials" | "createChallenge">;
    rpName: string;
    rpID: string;
    timeout?: number;
    attestationType?: GenerateRegistrationOptionsOpts["attestationType"];
    authenticatorSelection?: GenerateRegistrationOptionsOpts["authenticatorSelection"];
    supportedAlgorithmIDs?: GenerateRegistrationOptionsOpts["supportedAlgorithmIDs"];
    userVerification?: "preferred" | "required" | "discouraged";
    getUser?: (event: RequestEventLike) => User | null | Promise<User | null>;
};
export declare function createWebAuthnRegisterOptionsHandler(config: WebAuthnRegisterOptionsHandlerConfig): RequestHandler;
export type WebAuthnRegisterVerifyHandlerConfig = {
    webauthnAdapter: Pick<WebAuthnAdapter, "getChallenge" | "deleteChallenge" | "createCredential">;
    rpID: string;
    origin: string;
    requireUserVerification?: boolean;
    onCredentialCreated?: (input: {
        userId: string;
        credentialId: string;
        publicKey: string;
    }) => Promise<void> | void;
};
export declare function createWebAuthnRegisterVerifyHandler(config: WebAuthnRegisterVerifyHandlerConfig): RequestHandler;
export type WebAuthnLoginOptionsHandlerConfig = {
    webauthnAdapter: Pick<WebAuthnAdapter, "listCredentials" | "createChallenge">;
    databaseAdapter?: {
        getUserByEmail: (email: string) => Promise<User | null>;
    };
    rpID: string;
    timeout?: number;
    userVerification?: GenerateAuthenticationOptionsOpts["userVerification"];
};
export declare function createWebAuthnLoginOptionsHandler(config: WebAuthnLoginOptionsHandlerConfig): RequestHandler;
export type WebAuthnLoginVerifyHandlerConfig = {
    webauthnAdapter: Pick<WebAuthnAdapter, "getChallenge" | "deleteChallenge" | "getCredential" | "updateCredential">;
    databaseAdapter?: {
        getUserById: (id: string) => Promise<User | null>;
    };
    sessionAdapter: Pick<SessionAdapter, "createSession" | "setSessionCookie">;
    rpID: string;
    origin: string;
    redirectAfterLogin?: string;
    requireUserVerification?: boolean;
    onLogin?: AuthHooks["onLogin"];
    sanitizeUser?: (user: User | null) => User | null;
    autoCreateSession?: boolean;
    onLoginMode?: OnLoginMode;
};
export declare function createWebAuthnLoginVerifyHandler(config: WebAuthnLoginVerifyHandlerConfig): RequestHandler;
