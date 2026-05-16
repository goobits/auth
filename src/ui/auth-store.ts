import { derived, writable } from 'svelte/store';

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
	signIn: string;
	signUp: string;
	signOut: string;
	session: string;
	updateProfile: string;
};

type AuthHeaders =
	| Record<string, string>
	| (() => Record<string, string> | Promise<Record<string, string>>);

export type AuthStoreOptions = {
	baseUrl?: string;
	endpoints?: Partial<AuthEndpoints>;
	headers?: AuthHeaders;
	fetcher?: typeof fetch;
	autoCheck?: boolean;
};

const DEFAULT_ENDPOINTS = {
	signIn: '/auth/signin',
	signUp: '/auth/signup',
	signOut: '/auth/signout',
	session: '/auth/session',
	updateProfile: '/auth/profile',
};

function isBrowser() {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

const mergeHeaders = (
	base: Record<string, string>,
	extra?: Record<string, string>,
) => ({
	...base,
	...(extra || {}),
});

async function resolveHeaders(headers?: AuthHeaders): Promise<Record<string, string>> {
	if (!headers) {
		return {};
	}
	return typeof headers === 'function' ? headers() : headers;
}

export function createAuthStore(options: AuthStoreOptions = {}) {
	const {
		baseUrl = '',
		endpoints = {},
		headers,
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
		return resolveHeaders(headers).then((base) => mergeHeaders(base, extra));
	};

	const applyAuthSuccess = (result: Record<string, unknown>) => {
		const user = (result["user"] || null) as AuthUser;
		const session = (result["session"] || null) as AuthSession;
		update((state) => ({
			...state,
			user,
			session,
			isAuthenticated: !!user || !!session,
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
			headers: await buildHeaders({ 'Content-Type': 'application/json' }),
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

		async signIn(email: string, password: string) {
			update((state) => ({ ...state, loading: true, error: null }));
			try {
				const result = await postAuth(resolvedEndpoints.signIn, { email, password });

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

		async signUp(data: Record<string, unknown>) {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const result = await postAuth(resolvedEndpoints.signUp, data);

				if (!result.success) {
					return applyAuthFailure(result.error || 'Registration failed');
				}

				return applyAuthSuccess(result);
			} catch (error) {
				return applyAuthFailure((error as Error)?.message || 'Registration failed');
			}
		},

		async signOut() {
			update((state) => ({ ...state, loading: true, error: null }));

			try {
				const result = await postAuth(resolvedEndpoints.signOut);
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
			if (!isBrowser()) return;

			update((state) => ({ ...state, loading: true }));

			try {
				const response = await fetcher(`${baseUrl}${resolvedEndpoints.session}`, {
					method: 'GET',
					headers: await buildHeaders(),
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
					headers: await buildHeaders({ 'Content-Type': 'application/json' }),
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

	if (isBrowser() && autoCheck) {
		api.checkSession();
	}

	return api;
}

export const auth = createAuthStore();
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const user = derived(auth, ($auth) => $auth.user);
