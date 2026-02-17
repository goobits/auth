import { VerificationTokenAdapter } from "./base.js";
import type { User, VerificationToken } from "../../types/index.js";
import { type DrizzleDbLike, type DrizzleTable } from "../drizzle-types.js";
type TokensTable = DrizzleTable & {
    id: DrizzleTable[string];
    userId: DrizzleTable[string];
    type: DrizzleTable[string];
    token: DrizzleTable[string];
    expiresAt: DrizzleTable[string];
};
type UsersTable = DrizzleTable & {
    id: DrizzleTable[string];
};
type TokenUserRecord = {
    token: VerificationToken;
    user: User;
};
export declare class DrizzleVerificationTokenAdapter extends VerificationTokenAdapter {
    private db;
    private tokensTable;
    private usersTable;
    constructor(db: DrizzleDbLike, options?: {
        tokensTable?: TokensTable;
        usersTable?: UsersTable;
    });
    create({ userId, type, token, expiresAt, }: {
        userId: string;
        type: string;
        token: string;
        expiresAt: Date;
    }): Promise<void>;
    findByToken({ token, type }: {
        token: string;
        type: string;
    }): Promise<TokenUserRecord | null>;
    deleteById(tokenId: string): Promise<void>;
    deleteByUserAndType({ userId, type }: {
        userId: string;
        type: string;
    }): Promise<void>;
}
export {};
