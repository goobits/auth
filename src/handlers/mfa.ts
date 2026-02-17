import { generateSecret, createOtpAuthURL, verifyTOTP } from "../mfa/totp.js";
import { generateBackupCodes, hashBackupCodes, verifyBackupCode } from "../mfa/backup-codes.js";
import type { RequestEventLike } from "../types/auth.js";

type MfaStore = {
	setSecret: (userId: string, secret: string) => Promise<void>;
	setBackupCodes: (userId: string, codes: string[]) => Promise<void>;
	enableMfa: (userId: string) => Promise<void>;
	getSecret: (userId: string) => Promise<string>;
	disableMfa: (userId: string) => Promise<void>;
	getBackupCodes: (userId: string) => Promise<string[]>;
	consumeBackupCode: (userId: string, hash: string) => Promise<void>;
};

type MfaConfig = {
	getUserId: (locals: RequestEventLike["locals"]) => string | null;
	store: MfaStore;
	issuer?: string;
	label?: (userId: string, locals: RequestEventLike["locals"]) => string;
};

/**
 * Create MFA enrollment handler
 * @param {Object} config
 * @param {Function} config.getUserId - function (locals) => userId
 * @param {Object} config.store - MFA store with setSecret/setBackupCodes/enableMfa
 * @param {string} config.issuer - issuer name
 * @param {Function} [config.label] - function (userId, locals) => label
 */
export function createMfaEnrollHandler(config: MfaConfig) {
	const { getUserId, store, issuer, label } = config;
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals);
		if (!userId) return { success: false, error: "Unauthorized" };

		const secret = generateSecret();
		const otpLabel = label ? label(userId, event.locals) : String(userId);
		const otpInput: { secret: string; label: string; issuer?: string } = {
			secret,
			label: otpLabel,
		};
		if (issuer) otpInput.issuer = issuer;
		const otpauthUrl = createOtpAuthURL(otpInput);
		const backupCodes = generateBackupCodes();
		const hashedCodes = await hashBackupCodes(backupCodes);

		await store.setSecret(userId, secret);
		await store.setBackupCodes(userId, hashedCodes);

		return { success: true, secret, otpauthUrl, backupCodes };
	};
}

/**
 * Verify MFA token to enable MFA
 */
export function createMfaVerifyHandler(config: MfaConfig) {
	const { getUserId, store } = config;
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals);
		if (!userId) return { success: false, error: "Unauthorized" };
		const formData = await event.request.formData();
		const token = formData.get("token")?.toString();
		const secret = await store.getSecret(userId);
		const verifyInput: { secret: string; token?: string } = { secret };
		if (token) verifyInput.token = token;
		const valid = await verifyTOTP(verifyInput);
		if (!valid) return { success: false, error: "Invalid code" };
		await store.enableMfa(userId);
		return { success: true };
	};
}

export function createMfaDisableHandler(config: MfaConfig) {
	const { getUserId, store } = config;
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals);
		if (!userId) return { success: false, error: "Unauthorized" };
		await store.disableMfa(userId);
		return { success: true };
	};
}

export function createMfaBackupCodeHandler(config: MfaConfig) {
	const { getUserId, store } = config;
	return async (event: RequestEventLike) => {
		const userId = getUserId(event.locals);
		if (!userId) return { success: false, error: "Unauthorized" };
		const formData = await event.request.formData();
		const code = formData.get("code")?.toString();
		const hashedCodes = await store.getBackupCodes(userId);
		const result = await verifyBackupCode({ code: code ?? "", hashedCodes });
		if (!result.valid) return { success: false, error: "Invalid backup code" };
		if (!result.hash) return { success: false, error: "Invalid backup code" };
		await store.consumeBackupCode(userId, result.hash);
		return { success: true };
	};
}
