import { WebAuthnAdapter } from "./base.js";
import type { WebAuthnCredential } from "../../types/index.js";
import { type DrizzleDbLike, type DrizzleJson, type DrizzleTable } from "../drizzle-types.js";
type CredentialsTable = DrizzleTable;
type ChallengesTable = DrizzleTable;
type ChallengeRecord = {
    id: string;
    userId: string | null;
    challenge: string;
    type: string;
    expiresAt: Date;
};
export declare class DrizzleWebAuthnAdapter extends WebAuthnAdapter {
    private db;
    private credentialsTable;
    private challengesTable;
    private columns;
    constructor(db: DrizzleDbLike, options?: {
        credentialsTable?: CredentialsTable;
        challengesTable?: ChallengesTable;
        columns?: Partial<Record<string, string>>;
    });
    createChallenge({ challengeId, userId, challenge, type, expiresAt, }: {
        challengeId: string;
        userId: string | null;
        challenge: string;
        type: string;
        expiresAt: Date;
    }): Promise<void>;
    getChallenge(challengeId: string): Promise<ChallengeRecord | null>;
    deleteChallenge(challengeId: string): Promise<void>;
    createCredential({ userId, credentialId, publicKey, counter, transports, name, }: {
        userId: string;
        credentialId: string;
        publicKey: string;
        counter: number;
        transports?: string[] | null;
        name?: string | null;
    }): Promise<void>;
    getCredential(credentialId: string): Promise<WebAuthnCredential | null>;
    listCredentials(userId: string): Promise<WebAuthnCredential[]>;
    updateCredential(credentialId: string, updates: Record<string, DrizzleJson>): Promise<void>;
    deleteCredential(credentialId: string): Promise<void>;
    deleteUserCredentials(userId: string): Promise<void>;
}
export {};
