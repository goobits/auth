<script lang="ts">
	import { page } from '$app/stores'
	import { getProviderErrorMessage, type CalendarProviderName } from '$lib/auth/ui/providers'
	import { buildProviderLoginHref } from '$lib/auth/ui/redirects'
	import Hero from '$lib/ui/Hero.svelte'
	import Section from '$lib/ui/Section.svelte'
	import Card from '$lib/ui/Card.svelte'
	import '../Calendar.scss'

	const { data } = $props<{
		data: {
			providers: Record<CalendarProviderName, boolean>
			hasAnyProvider: boolean
		}
	}>()

	let loading = $state(false)
	const rawError = $page.url.searchParams.get('error') || ''
	let error = $state(getProviderErrorMessage(rawError))

	const inviteCode = $page.url.searchParams.get('invite') || ''
	const redirectTo = $page.url.searchParams.get('redirect') || '/calendar'

	async function loginWith(provider: CalendarProviderName) {
		loading = true
		error = ''

		try {
			window.location.href = buildProviderLoginHref(provider, { inviteCode, redirectTo })
		} catch {
			error = 'Something went wrong. Please try again.'
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Sign In | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-login">
	<Hero
		className="calendar-page__hero calendar-login__hero"
		glowClass="calendar-page__hero-glow calendar-login__glow"
		eyebrowClass="calendar-page__eyebrow calendar-login__eyebrow"
		subtitleClass="calendar-page__subtitle calendar-login__sub"
		eyebrow="Members"
		title="Welcome."
		subtitle="Sign in to access activities and events."
	/>

	<Section className="calendar-page__section calendar-login__section">
		<Card className="calendar-page__login-card calendar-login__card">
			{#if error}
				<div class="calendar-page__error-message calendar-login__error">{error}</div>
			{/if}

			{#if inviteCode}
				<div class="calendar-page__invite-notice calendar-login__invite-notice">
					Using invite code: <code>{inviteCode}</code>
				</div>
			{/if}

			<div class="calendar-page__login-buttons calendar-login__buttons">
				{#if data.providers.google}
					<button
						onclick={() => loginWith('google')}
						disabled={loading}
						class="calendar-page__login-button calendar-page__login-button--google calendar-login__button calendar-login__button--google"
					>
						<svg viewBox="0 0 24 24" width="20" height="20">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
						</svg>
						Sign in with Google
					</button>
				{/if}

				{#if data.providers.apple}
					<button
						onclick={() => loginWith('apple')}
						disabled={loading}
						class="calendar-page__login-button calendar-page__login-button--apple calendar-login__button calendar-login__button--apple"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
						</svg>
						Sign in with Apple
					</button>
				{/if}
			</div>

			{#if !data.hasAnyProvider}
				<p class="calendar-page__invite-hint calendar-login__hint">
					No sign-in provider is configured yet. Please add OAuth credentials in environment settings.
				</p>
			{/if}

			{#if !inviteCode}
				<p class="calendar-page__invite-hint calendar-login__hint">
					Need an account? You'll need an invite code to join.
				</p>
			{/if}
		</Card>
	</Section>
</div>
