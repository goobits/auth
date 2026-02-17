import { z } from "zod";
export declare function parseRequestData(request: Request): Promise<Record<string, unknown>>;
export declare function parseRequestDataWithSchema<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | null>;
export declare function jsonResponse(payload: unknown, status?: number): Response;
