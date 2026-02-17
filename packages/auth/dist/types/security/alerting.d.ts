type WebhookAlerterConfig = {
    url?: string | null;
    secret?: string | null;
    cooldownMs?: number;
    maxPerHour?: number;
    timeoutMs?: number;
};
export declare function createWebhookAlerter({ url, secret, cooldownMs, maxPerHour, timeoutMs, }?: WebhookAlerterConfig): (payload: Record<string, unknown>, alertType?: string) => Promise<boolean>;
export {};
