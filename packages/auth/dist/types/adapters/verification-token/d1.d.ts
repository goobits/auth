import { VerificationTokenAdapter } from "./base.js";
import type { User, VerificationToken } from "../../types/index.js";
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
type TokenUserRecord = {
    token: VerificationToken;
    user: User;
};
export declare class D1VerificationTokenAdapter extends VerificationTokenAdapter {
    private db;
    private tokensTable;
    private usersTable;
    private columns;
    private userColumns;
    constructor(db: D1DatabaseLike, options?: {
        tokensTable?: string;
        usersTable?: string;
        columns?: Partial<Record<string, string>>;
        userColumns?: Partial<Record<string, string>>;
    });
    private coerceDbId;
    private mapTokenAndUser;
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
