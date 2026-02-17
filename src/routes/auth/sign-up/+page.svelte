<script lang="ts">
	import { enhance } from '$app/forms';
	import TurnstileField from '$lib/components/TurnstileField.svelte';
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
</script>

<svelte:head>
	<title>Create Account | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card flow-page__card--narrow">
			<p class="layout__eyebrow">Accounts</p>
			<h1 class="layout__title">Create your account</h1>
			<p class="flow-page__copy">
				This is optional. Accounts help us keep signups organized and let you manage your info later.
			</p>

			{#if form && !form.success && form.error}
				<p class="flow-page__error">{form.error}</p>
			{/if}

			<form class="flow-form" method="POST" use:enhance>
				<input class="flow-form__honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
				<label class="flow-form__field">
					<span class="flow-form__label">Name (optional)</span>
					<input class="flow-form__control" name="name" maxlength="80" autocomplete="name" />
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Email</span>
					<input class="flow-form__control" name="email" type="email" required maxlength="140" autocomplete="email" />
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Password</span>
					<input class="flow-form__control" name="password" type="password" required autocomplete="new-password" />
					<span class="flow-form__help">10+ chars with upper, lower, number, symbol.</span>
				</label>
				<TurnstileField action="auth-signup" />
				<div class="flow-form__actions">
					<button class="c-button c-button--primary c-button--large" type="submit">Create Account</button>
					<a class="c-button c-button--secondary" href="/auth/sign-in">Sign in</a>
					<a class="c-button c-button--secondary" href="/">Back Home</a>
				</div>
			</form>
		</div>
	</div>
</section>
