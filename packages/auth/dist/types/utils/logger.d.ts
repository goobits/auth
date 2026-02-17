export type Logger = {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
};
export declare function setLogger(logger: Logger | null | undefined): void;
export declare function getLogger(): Logger;
