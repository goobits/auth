<script lang="ts">
	import { onMount } from 'svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'

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

		<label class="register-page__field">
			<span class="register-page__field-label">Name</span>
			<input class="register-page__field-input" name="name" type="text" required value={form?.name || ''} autocomplete="name" />
		</label>
		<label class="register-page__field">
			<span class="register-page__field-label">Email</span>
			<input class="register-page__field-input" name="email" type="email" required value={form?.email || ''} autocomplete="email" />
		</label>
		<label class="register-page__field">
			<span class="register-page__field-label">Password</span>
			<input class="register-page__field-input" name="password" type="password" required minlength="10" autocomplete="new-password" />
		</label>

		{#if data.turnstileSiteKey}
			<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
		{/if}

		{#if form?.error}
			<p class="register-page__error">{form.error}</p>
		{/if}

		<PillButton type="submit" className="register-page__submit" variant="primary" size="md">
			Create account
		</PillButton>
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

	.register-page__field {
		display: grid;
		gap: var(--space-2);
	}

	.register-page__field-label {
		font-size: var(--font-size-sm);
		color: var(--muted);
	}

	.register-page__field-input {
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

	:global(.register-page__submit) { justify-self: start; }
</style>
