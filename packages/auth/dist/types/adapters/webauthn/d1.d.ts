import { WebAuthnAdapter } from "./base.js";
import type { WebAuthnCredential } from "../../types/index.js";
type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;
type D1DatabaseLike = {
    prepare: (sql: string) => {
        bind: (...args: D1Value[]) => {
            run: () => Promise<unknown>;
            first: () => Promise<D1Row | null>;
            all: () => Promise<{
                results?: D1Row[];
            }>;
        };
    };
};
type WebAuthnChallengeRecord = {
    id: string;
    userId: string | null;
    challenge: string;
    type: string;
    expiresAt: Date;
};
export declare class D1WebAuthnAdapter extends WebAuthnAdapter {
    private db;
    private credentialsTable;
    private challengesTable;
    private columns;
    constructor(db: D1DatabaseLike, options?: {
        credentialsTable?: string;
        challengesTable?: string;
        columns?: Partial<Record<string, string>>;
    });
    createChallenge({ challengeId, userId, challenge, type, expiresAt, }: {
        challengeId: string;
        userId: string | null;
        challenge: string;
        type: string;
        expiresAt: Date;
    }): Promise<void>;
    private mapChallenge;
    private mapCredential;
    getChallenge(challengeId: string): Promise<WebAuthnChallengeRecord | null>;
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
    updateCredential(credentialId: string, updates: Record<string, unknown>): Promise<void>;
    deleteCredential(credentialId: string): Promise<void>;
    deleteUserCredentials(userId: string): Promise<void>;
}
export {};
