<script lang="ts">
	import { page } from '$app/stores'
	import { CALENDAR_ACTIVITY_LIST } from '$lib/booking/activities'
	import { getProviderErrorMessage, type CalendarProviderName } from '$lib/auth/ui/providers'
	import { buildProviderLoginHref } from '$lib/auth/ui/redirects'
	import '../Calendar.scss'

	const { data } = $props<{
		data: {
			providers: Record<CalendarProviderName, boolean>
			hasAnyProvider: boolean
		}
	}>()

	let loading = $state(false)
	let inviteInputEl = $state<HTMLInputElement | null>(null)
	const rawError = $page.url.searchParams.get('error') || ''
	let error = $state(getProviderErrorMessage(rawError))

	const inviteCode = $page.url.searchParams.get('invite') || ''
	const redirectTo = $page.url.searchParams.get('redirect') || '/calendar'
	const verifiedStatus = $page.url.searchParams.get('verified') || ''
	let inviteInput = $state(inviteCode)

	function resolveTargetActivity(path: string) {
		const pathname = path.split('?')[0]?.replace(/\/+$/, '') || ''
		if (pathname === '/calendar-gym') {
			return CALENDAR_ACTIVITY_LIST.find((item) => item.slug === 'gym') ?? null
		}
		return CALENDAR_ACTIVITY_LIST.find((item) => item.href === pathname) ?? null
	}

	const targetActivity = resolveTargetActivity(redirectTo)

	async function loginWith(provider: CalendarProviderName, codeOverride?: string) {
		loading = true
		error = ''

		try {
			const code = codeOverride ?? inviteCode
			window.location.href = buildProviderLoginHref(provider, { inviteCode: code, redirectTo })
		} catch {
			error = 'Something went wrong. Please try again.'
			loading = false
		}
	}

	function canUse(provider: CalendarProviderName) {
		return Boolean(data.providers[provider])
	}

	function joinWithInvite(event: SubmitEvent) {
		event.preventDefault()
		const code = inviteInput.trim()
		if (!code) {
			error = 'Enter an invite code to continue.'
			return
		}

		if (canUse('google')) {
			loginWith('google', code)
			return
		}

		if (canUse('apple')) {
			loginWith('apple', code)
			return
		}

		error = 'No sign-in provider is configured yet.'
	}

	function focusInviteInput(event: MouseEvent) {
		const target = event.target as HTMLElement | null
		if (target?.closest('.calendar-login__invite-button')) return
		inviteInputEl?.focus()
		inviteInputEl?.select()
	}
</script>

<svelte:head>
	<title>Sign In | Rainbow Gym | MIKO.ART</title>
</svelte:head>

<div class="calendar-page calendar-login">
	<div class="calendar-login__center">
		<section class="calendar-login__card" aria-label="Members sign in">
			<p class="calendar-login__label">{targetActivity ? targetActivity.eyebrow : 'Members'}</p>
			<h1 class="calendar-login__title">
				{targetActivity ? `${targetActivity.label} ${targetActivity.icon}` : 'Welcome back ✨'}
			</h1>
			<p class="calendar-login__subtitle">
				{targetActivity
					? `${targetActivity.heroSubtitle} Sign in to continue.`
					: 'Sign in to access activities and events.'}
			</p>

			{#if error}
				<div class="calendar-page__error-message calendar-login__error">{error}</div>
			{/if}

			{#if verifiedStatus === '1'}
				<div class="calendar-page__invite-notice calendar-login__invite-notice">
					Email verified. You can sign in now.
				</div>
			{:else if verifiedStatus && verifiedStatus !== '1'}
				<div class="calendar-page__error-message calendar-login__error">
					Verification link is invalid or expired.
				</div>
			{/if}

			{#if inviteCode}
				<div class="calendar-page__invite-notice calendar-login__invite-notice">
					Using invite code: <code>{inviteCode}</code>
				</div>
			{/if}

			<div class="calendar-login__buttons">
				{#if data.providers.google}
					<button
						onclick={() => loginWith('google', inviteInput.trim() || inviteCode)}
						disabled={loading}
						class="calendar-login__button calendar-login__button--google"
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
						onclick={() => loginWith('apple', inviteInput.trim() || inviteCode)}
						disabled={loading}
						class="calendar-login__button calendar-login__button--apple"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
						</svg>
						Sign in with Apple
					</button>
				{/if}
			</div>

			{#if data.hasAnyProvider}
				<div class="calendar-login__divider" aria-hidden="true">
					<div class="calendar-login__divider-line"></div>
					<span>or join with invite</span>
					<div class="calendar-login__divider-line"></div>
				</div>

				<form class="calendar-login__invite-form" onsubmit={joinWithInvite}>
					<div class="calendar-login__invite-row" onclick={focusInviteInput}>
						<input
							class="calendar-login__invite-input"
							type="text"
							maxlength="24"
							spellcheck="false"
							autocomplete="off"
							placeholder="Invite code"
							bind:value={inviteInput}
							bind:this={inviteInputEl}
						/>
						<button class="calendar-login__invite-button" type="submit" disabled={loading}>
							Join
						</button>
					</div>
				</form>
			{/if}

			{#if !data.hasAnyProvider}
				<p class="calendar-page__invite-hint calendar-login__hint">
					No sign-in provider is configured yet. Please add OAuth credentials in environment settings.
				</p>
			{/if}

			{#if !inviteCode}
				<p class="calendar-page__invite-hint calendar-login__hint">
					Don't have a code? Invites are shared directly by Miko.
				</p>
			{/if}
		</section>
	</div>
</div>
