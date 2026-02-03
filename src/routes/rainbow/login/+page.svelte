<script>
	import { page } from '$app/stores'

	let loading = $state(false)
	let error = $state($page.url.searchParams.get('error') || '')

	const inviteCode = $page.url.searchParams.get('invite') || ''
	const redirectTo = $page.url.searchParams.get('redirect') || '/rainbow'

	async function loginWith(provider) {
		loading = true
		error = ''

		try {
			const res = await fetch('/api/rainbow/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider,
					invite: inviteCode,
					redirectTo
				})
			})

			const data = await res.json()

			if (!data.ok) {
				error = data.error?.message || 'Login failed'
				loading = false
				return
			}

			window.location.href = data.authUrl
		} catch (e) {
			error = 'Something went wrong. Please try again.'
			loading = false
		}
	}
</script>

<div class="login-container">
	<div class="login-card">
		<h1>Welcome to Rainbow</h1>
		<p class="subtitle">Sign in to access activities</p>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		{#if inviteCode}
			<div class="invite-notice">
				Using invite code: <code>{inviteCode}</code>
			</div>
		{/if}

		<div class="login-buttons">
			<button
				onclick={() => loginWith('google')}
				disabled={loading}
				class="login-btn google"
			>
				<svg viewBox="0 0 24 24" width="20" height="20">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				Sign in with Google
			</button>

			<button
				onclick={() => loginWith('apple')}
				disabled={loading}
				class="login-btn apple"
			>
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
				</svg>
				Sign in with Apple
			</button>
		</div>

		{#if !inviteCode}
			<p class="invite-hint">
				Don't have an account? You'll need an invite code to join.
			</p>
		{/if}
	</div>
</div>

<style>
	.login-container {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.login-card {
		background: var(--card-bg, white);
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 16px;
		padding: 3rem;
		max-width: 400px;
		width: 100%;
		text-align: center;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
	}

	h1 {
		font-size: 1.75rem;
		margin-bottom: 0.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		color: var(--text-secondary, #666);
		margin-bottom: 1.5rem;
	}

	.error-message {
		background: #fee2e2;
		color: #dc2626;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.invite-notice {
		background: #dbeafe;
		color: #1d4ed8;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.invite-notice code {
		background: rgba(0, 0, 0, 0.1);
		padding: 0.2em 0.4em;
		border-radius: 4px;
		font-family: monospace;
	}

	.login-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.875rem 1.5rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid;
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.login-btn.google {
		background: white;
		border-color: #e0e0e0;
		color: #333;
	}

	.login-btn.google:hover:not(:disabled) {
		background: #f5f5f5;
		border-color: #ccc;
	}

	.login-btn.apple {
		background: #000;
		border-color: #000;
		color: white;
	}

	.login-btn.apple:hover:not(:disabled) {
		background: #333;
	}

	.invite-hint {
		color: var(--text-secondary, #666);
		font-size: 0.85rem;
		margin-top: 1.5rem;
	}
</style>
