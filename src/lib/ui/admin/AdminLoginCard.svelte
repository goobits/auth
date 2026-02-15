<script>
	import { enhance } from '$app/forms'
	const { form } = $props()
</script>

<div class="admin-page__login">
	<div class="admin-page__login-card">
		<div class="admin-page__login-title">Admin access</div>
		<div class="admin-page__login-sub">Enter the admin passcode to continue.</div>
		<form method="POST" action="?/login" use:enhance>
			<input type="hidden" name="email" value="admin@miko.art" />
			<div class="admin-page__login-field">
				<input class="admin-page__input" type="password" name="password" placeholder="Passcode" />
			</div>
			{#if form?.error}
				<div class="admin-page__login-error">{form.error}</div>
			{/if}
			<button class="admin-page__button-secondary admin-page__unlock" type="submit">Unlock</button>
		</form>
	</div>
</div>
