<script lang="ts">
	import { createAuthClient, type CreateAuthClientOptions } from '../client/index.ts'

	type SessionRecord = {
		id: string
		current?: boolean
		ip?: string | null
		expiresAt: string
	}

	export interface SessionManagerLabels {
		failedLoad: string
		failedRevoke: string
		loading: string
		active: string
		current: string
		session: string
		unknownIp: string
		expires: string
		revokeName: string
		revoking: string
		revoke: string
		empty: string
	}

	const defaultLabels: SessionManagerLabels = {
		failedLoad: 'Failed to load sessions',
		failedRevoke: 'Failed to revoke session',
		loading: 'Loading sessions…',
		active: 'Active sessions',
		current: 'Current session',
		session: 'Session',
		unknownIp: 'Unknown IP',
		expires: 'Expires {date}',
		revokeName: 'Revoke session {ip}',
		revoking: 'Revoking…',
		revoke: 'Revoke',
		empty: 'No sessions found.'
	}

	let {
		listEndpoint,
		revokeEndpoint,
		fetcher = fetch,
		headers = {},
		csrf = {},
		sessions: initialSessions = null,
		labels = {},
		locale = 'en'
	}: {
		listEndpoint?: string
		revokeEndpoint?: string
		fetcher?: typeof fetch
		headers?: Record<string, string>
		csrf?: CreateAuthClientOptions['csrf']
		sessions?: SessionRecord[] | null
		labels?: Partial<SessionManagerLabels>
		locale?: string
	} = $props()
	const copy = $derived({ ...defaultLabels, ...labels })
	const dateTimeFormatter = $derived(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }))

	let sessions = $state<SessionRecord[] | null>(null)
	let loading = $state(true)
	let revokingId = $state<string | null>(null)
	let error = $state<string | null>(null)
	let didApplyInitialSessions = false
	let didRequestInitialSessions = false

	function client() {
		const endpoints = {
			...(listEndpoint ? { sessions: listEndpoint } : {}),
			...(revokeEndpoint ? { sessionRevoke: revokeEndpoint } : {})
		}
		return createAuthClient({
			csrf,
			fetcher,
			headers,
			endpoints
		})
	}

	async function loadSessions() {
		loading = true
		error = null
		try {
			const data = await client().listSessions()
			if (!data.ok) {
				throw new Error(data.error || copy.failedLoad)
			}
			sessions = data.sessions
		} catch (err) {
			error = err instanceof Error ? err.message : copy.failedLoad
		} finally {
			loading = false
		}
	}

	async function revoke(sessionId: string) {
		revokingId = sessionId
		error = null
		try {
			const data = await client().revokeSession({ sessionId })
			if (!data.ok) {
				throw new Error(data.error || copy.failedRevoke)
			}
			await loadSessions()
		} catch (err) {
			error = err instanceof Error ? err.message : copy.failedRevoke
		} finally {
			revokingId = null
		}
	}

	$effect(() => {
		if (!didApplyInitialSessions) {
			sessions = initialSessions
			didApplyInitialSessions = true
		}

		if (!didRequestInitialSessions && !sessions) {
			didRequestInitialSessions = true
			void loadSessions()
		}
	})
</script>

<div class="auth-session-manager" aria-busy={loading || revokingId !== null}>
	{#if error}
		<p class="auth-session-manager__error" role="alert">{error}</p>
	{/if}
	{#if loading && !sessions}
		<p class="auth-session-manager__loading" role="status">{copy.loading}</p>
	{:else if sessions && sessions.length > 0}
		<ul class="auth-session-manager__list" aria-label={copy.active} data-testid="auth-session-list">
			{#each sessions as session}
				<li class="auth-session-manager__item" aria-busy={revokingId === session.id}>
					<div>
						<p class="auth-session-manager__meta">
							{session.current ? copy.current : copy.session} ·
							{session.ip || copy.unknownIp}
						</p>
						<p class="auth-session-manager__sub">
							{copy.expires.replace('{date}', dateTimeFormatter.format(new Date(session.expiresAt)))}
						</p>
					</div>
					{#if !session.current}
						<button
							class="auth-session-manager__revoke"
							type="button"
							data-testid="auth-session-revoke"
							disabled={revokingId === session.id}
							aria-label={copy.revokeName.replace('{ip}', session.ip || copy.unknownIp)}
							onclick={() => revoke(session.id)}
						>
							{revokingId === session.id ? copy.revoking : copy.revoke}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="auth-session-manager__empty">{copy.empty}</p>
	{/if}
</div>
