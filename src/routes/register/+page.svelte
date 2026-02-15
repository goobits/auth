<script lang="ts">
	import { onMount } from 'svelte'
	import Hero from '$lib/ui/Hero.svelte'

	type ActionData = {
		error?: string
		requiresChallenge?: boolean
		name?: string
		email?: string
	}

	const { data, form } = $props<{ data: { turnstileSiteKey: string; antiAbuseEnabled: boolean }; form?: ActionData }>()

	let startedAt = $state('')
	let deviceId = $state('')

	function ensureDeviceId() {
		const key = 'miko_register_device_id'
		const existing = window.localStorage.getItem(key)
		if (existing) {
			deviceId = existing
			return
		}
		const created = crypto.randomUUID()
		window.localStorage.setItem(key, created)
		deviceId = created
	}

	onMount(() => {
		startedAt = String(Date.now())
		ensureDeviceId()
	})
</script>

<svelte:head>
	<title>Register - MIKO.ART</title>
	{#if data.turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<Hero
	title="Create account"
	subtitle="Create your account and confirm your email to continue."
	icon="/media/emoji-herb.png"
	compact={true}
/>

<section class="register-page ui-surface-card">
	<form method="POST" class="register-page__form" novalidate>
		<input type="hidden" name="started_at" value={startedAt} />
		<input type="hidden" name="device_id" value={deviceId} />
		<label class="register-page__hp" aria-hidden="true">
			<span>Website</span>
			<input type="text" name="website" tabindex="-1" autocomplete="off" />
		</label>

		<label>
			<span>Name</span>
			<input name="name" type="text" required value={form?.name || ''} autocomplete="name" />
		</label>
		<label>
			<span>Email</span>
			<input name="email" type="email" required value={form?.email || ''} autocomplete="email" />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" required minlength="10" autocomplete="new-password" />
		</label>

		{#if data.turnstileSiteKey}
			<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
		{/if}

		{#if form?.error}
			<p class="register-page__error">{form.error}</p>
		{/if}

		<button type="submit">Create account</button>
	</form>
</section>

<style>
	.register-page {
		max-width: min(36rem, 100%);
		padding: var(--space-8);
	}

	.register-page__form {
		display: grid;
		gap: var(--space-4);
	}

	.register-page__form label {
		display: grid;
		gap: var(--space-2);
	}

	.register-page__form span {
		font-size: var(--font-size-sm);
		color: var(--muted);
	}

	.register-page__form input {
		padding: var(--space-3) var(--space-4);
		border: var(--border-width) solid var(--input-border);
		border-radius: var(--radius-md);
		background: var(--input-bg);
		color: var(--text);
	}

	.register-page__hp {
		position: absolute;
		left: -100vw;
		top: auto;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.register-page__error {
		margin: 0;
		color: var(--status-error-text);
	}

	.register-page__form button {
		justify-self: start;
		padding: var(--space-3) var(--space-6);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--button-text);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}
</style>
