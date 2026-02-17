import { MagicLinkAdapter } from "./base.js";
import type { MagicLinkToken } from "../../types/index.js";
type D1Value = string | number | boolean | null;
type D1Row = Record<string, D1Value>;
type D1DatabaseLike = {
    prepare: (sql: string) => {
        bind: (...args: D1Value[]) => {
            run: () => Promise<void>;
            first: () => Promise<D1Row | null>;
        };
    };
};
export declare class D1MagicLinkAdapter extends MagicLinkAdapter {
    private db;
    private tokensTable;
    private columns;
    constructor(db: D1DatabaseLike, options?: {
        tokensTable?: string;
        columns?: Partial<Record<string, string>>;
    });
    createToken({ userId, email, tokenHash, otpHash, expiresAt, metadata, }: {
        userId: string | null;
        email: string;
        tokenHash: string;
        otpHash?: string | null;
        expiresAt: Date;
        metadata?: Record<string, unknown>;
    }): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string | null;
        email: string;
        tokenHash: string;
        otpHash: string | null;
        expiresAt: Date;
        createdAt: Date;
    }>;
    findByTokenHash(tokenHash: string): Promise<MagicLinkToken | null>;
    findByEmailAndOtpHash({ email, otpHash, }: {
        email: string;
        otpHash: string;
    }): Promise<MagicLinkToken | null>;
    deleteById(tokenId: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
    deleteByEmail(email: string): Promise<void>;
    private mapRow;
}
export {};
