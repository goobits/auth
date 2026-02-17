import { derived, writable } from 'svelte/store';
import { browser } from '$app/environment';

type AuthUser = Record<string, unknown> | null;
type AuthSession = Record<string, unknown> | null;

type AuthState = {
	user: AuthUser;
	session: AuthSession;
	isAuthenticated: boolean;
	loading: boolean;
	error: string | null;
};

type AuthEndpoints = {
	login: string;
	register: string;
	logout: string;
	session: string;
	updateProfile: string;
};

type AuthStoreOptions = {
	baseUrl?: string;
	endpoints?: Partial<AuthEndpoints>;
	publishableApiKey?: string | null;
	fetcher?: typeof fetch;
	autoCheck?: boolean;
};

const DEFAULT_ENDPOINTS = {
	login: '/auth/login',
	register: '/auth/register',
	logout: '/auth/logout',
	session: '/auth/session',
	updateProfile: '/auth/profile',
};

const mergeHeaders = (
	base: Record<string, string>,
	extra?: Record<string, string>,
) => ({
	...base,
	...(extra || {}),
});

export function createAuthStore(options: AuthStoreOptions = {}) {
	const {
		baseUrl = '',
		endpoints = {},
		publishableApiKey = null,
		fetcher = fetch,
		autoCheck = true,
	} = options;

	const resolvedEndpoints: AuthEndpoints = { ...DEFAULT_ENDPOINTS, ...endpoints };

	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		isAuthenticated: false,
		loading: false,
		error: null,
	});

	const buildHeaders = (extra?: Record<string, string>) => {
		const base: Record<string, string> = publishableApiKey
			? { 'x-publishable-api-key': publishableApiKey }
			: {};
		return mergeHeaders(base, extra);
	};

	const applyAuthSuccess = (result: Record<string, unknown>) => {
		const user = (result["customer"] || result["user"] || null) as AuthUser;
		update((state) => ({
			...state,
			user,
			session: (result["session"] || null) as AuthSession,
			isAuthenticated: true,
			loading: false,
		}));
		return { success: true, user };
	};

	const applyAuthFailure = (error: unknown) => {
		const message =
			typeof error === 'string' ? error : (error as Error)?.message || 'Request failed';
		update((state) => ({ ...state, loading: false, error: message }));
		return { success: false, error: message };
	};

	const postAuth = async (path: string, payload?: unknown) => {
		const response = await fetcher(`${baseUrl}${path}`, {
			method: 'POST',
			headers: buildHeaders({ 'Content-Type': 'application/json' }),
			credentials: 'include',
			body: payload ? JSON.stringify(payload) : null,
		});

		try {
			return await response.json();
		} catch {
			return { success: response.ok };
		}
	};

	const api = {
		subscribe,

		async login(email: string, password: string) {
			update((state) => ({ ...state, loading: true, error: null }));
			try {
				const result = await postAuth(resolvedEndpoints.login, { email, password });

				if (result.twoFactorRequired) {
					update((state) => ({ ...state, loading: false }));
					return { success: true, mfaRequired: true };
				}

				if (!result.success) {
					return applyAuthFailure(result.error || 'Login failed');
				}

				return applyAuthSuccess(result);
			} catch (error) {
				return applyAuthFailure((error as Error)?.message || 'Login failed');
			}
		},

		async register(data: Record<string, unknown> | string) {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				let registrationData: Record<string, unknown>;
				if (typeof data === 'object' && !data["name"]) {
					const { first_name, last_name, email, password, phone } = data as Record<string, unknown>;
					registrationData = { email, password, first_name, last_name, phone };
				} else if (typeof data === 'object') {
					registrationData = data as Record<string, unknown>;
				} else {
					const email = arguments[0];
					const password = arguments[1];
					const name = arguments[2];
					registrationData = { email, password, name } as Record<string, unknown>;
				}

				const result = await postAuth(resolvedEndpoints.register, registrationData);

				if (!result.success) {
					return applyAuthFailure(result.error || 'Registration failed');
				}

				return applyAuthSuccess(result);
			} catch (error) {
				return applyAuthFailure((error as Error)?.message || 'Registration failed');
			}
		},

		async logout() {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const result = await postAuth(resolvedEndpoints.logout);
				set({
					user: null,
					session: null,
					isAuthenticated: false,
					loading: false,
					error: null,
				});
				return { success: (result as { success?: boolean }).success || true };
			} catch {
				set({
					user: null,
					session: null,
					isAuthenticated: false,
					loading: false,
					error: null,
				});
				return { success: true };
			}
		},

		async checkSession() {
			if (!browser) return;

			update((state) => ({ ...state, loading: true }));

			try {
				const response = await fetcher(`${baseUrl}${resolvedEndpoints.session}`, {
					method: 'GET',
					headers: buildHeaders(),
					credentials: 'include',
				});

				if (response.status === 204 || !response.ok) {
					update((state) => ({ ...state, loading: false }));
					return;
				}

				const result = (await response.json()) as Record<string, unknown>;

				if (result["success"] && result["user"]) {
					update((state) => ({
						...state,
						user: result["user"] as AuthUser,
						session: (result["session"] || null) as AuthSession,
						isAuthenticated: true,
						loading: false,
					}));
				} else {
					update((state) => ({ ...state, loading: false }));
				}
			} catch {
				update((state) => ({ ...state, loading: false }));
			}
		},

		async updateProfile(data: Record<string, unknown>) {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const response = await fetcher(`${baseUrl}${resolvedEndpoints.updateProfile}`, {
					method: 'POST',
					headers: buildHeaders({ 'Content-Type': 'application/json' }),
					credentials: 'include',
					body: JSON.stringify(data),
				});

				const result = (await response.json()) as Record<string, unknown>;

				if (!result["success"]) {
					update((state) => ({
						...state,
						loading: false,
						error: (result["error"] as string) || 'Profile update failed',
					}));
					return { success: false, error: (result["error"] as string) || 'Profile update failed' };
				}

				update((state) => ({
					...state,
					user: { ...(state["user"] ?? {}), ...(result["user"] as Record<string, unknown>) },
					loading: false,
				}));

				return { success: true, user: result["user"] };
			} catch (error) {
				const message = (error as Error)?.message || 'Profile update failed';
				update((state) => ({ ...state, loading: false, error: message }));
				return { success: false, error: message };
			}
		},

		async refreshSession() {
			return this.checkSession();
		},
	};

	if (browser && autoCheck) {
		api.checkSession();
	}

	return api;
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const user = derived(auth, ($auth) => $auth.user);
