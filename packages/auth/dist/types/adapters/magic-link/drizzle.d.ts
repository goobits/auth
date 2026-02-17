import { MagicLinkAdapter } from "./base.js";
import type { MagicLinkToken } from "../../types/index.js";
import { type DrizzleDbLike, type DrizzleJson, type DrizzleTable } from "../drizzle-types.js";
type TokensTable = DrizzleTable;
export declare class DrizzleMagicLinkAdapter extends MagicLinkAdapter {
    private db;
    private tokensTable;
    private columns;
    constructor(db: DrizzleDbLike, options?: {
        tokensTable?: TokensTable;
        columns?: Partial<Record<string, string>>;
    });
    createToken({ userId, email, tokenHash, otpHash, expiresAt, metadata, }: {
        userId: string | null;
        email: string;
        tokenHash: string;
        otpHash?: string | null;
        expiresAt: Date;
        metadata?: Record<string, DrizzleJson>;
    }): Promise<MagicLinkToken>;
    findByTokenHash(tokenHash: string): Promise<MagicLinkToken | null>;
    findByEmailAndOtpHash({ email, otpHash, }: {
        email: string;
        otpHash: string;
    }): Promise<MagicLinkToken | null>;
    deleteById(tokenId: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
    deleteByEmail(email: string): Promise<void>;
}
export {};
