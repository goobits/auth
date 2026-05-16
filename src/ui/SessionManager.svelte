<script>
	export let listEndpoint = "/auth/sessions";
	export let revokeEndpoint = "/auth/sessions";
	export let fetcher = fetch;
	export let headers = {};
	export let sessions = null;

	let loading = false;
	let revokingId = null;
	let error = null;

	async function loadSessions() {
		loading = true;
		error = null;
		try {
			const response = await fetcher(listEndpoint, {
				headers,
			});
			const data = await response.json();
			if (!response.ok || !data.ok) {
				throw new Error(data.error || "Failed to load sessions");
			}
			sessions = data.sessions;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function revoke(sessionId) {
		revokingId = sessionId;
		error = null;
		try {
			const response = await fetcher(revokeEndpoint, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...headers,
				},
				body: JSON.stringify({ sessionId }),
			});
			const data = await response.json();
			if (!response.ok || !data.ok) {
				throw new Error(data.error || "Failed to revoke session");
			}
			await loadSessions();
		} catch (err) {
			error = err.message;
		} finally {
			revokingId = null;
		}
	}

	if (!sessions) {
		loadSessions();
	}
</script>

<div class="auth-session-manager">
	{#if error}
		<p class="auth-session-error">{error}</p>
	{/if}
	{#if loading && !sessions}
		<p class="auth-session-loading">Loading sessions…</p>
	{:else if sessions && sessions.length > 0}
		<ul class="auth-session-list" aria-label="Active sessions">
			{#each sessions as session}
				<li class="auth-session-item">
					<div>
						<p class="auth-session-meta">
							{session.current ? "Current session" : "Session"} ·
							{session.ip || "Unknown IP"}
						</p>
						<p class="auth-session-sub">
							Expires {new Date(session.expiresAt).toLocaleString()}
						</p>
					</div>
					{#if !session.current}
						<button
							class="auth-session-revoke"
							type="button"
							disabled={revokingId === session.id}
							aria-label="Revoke session {session.ip || 'Unknown IP'}"
							on:click={() => revoke(session.id)}
						>
							{revokingId === session.id ? 'Revoking…' : 'Revoke'}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="auth-session-empty">No sessions found.</p>
	{/if}
</div>
