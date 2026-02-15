<script>
	const { form } = $props()
</script>

<div class="admin-page__login">
	<div class="admin-login" aria-label="Admin login">
		<div class="admin-login__label">Admin</div>
		<h1 class="admin-login__title">Control room 🔐</h1>
		<p class="admin-login__subtitle">Bookings, invites, and calendar management.</p>

		<form class="admin-login__form" method="POST" action="?/login">
			<input type="hidden" name="email" value="admin@miko.art" />
			<div class="admin-login__row">
				<input
					class="admin-login__passcode"
					type="password"
					name="password"
					placeholder="Passcode"
					autocomplete="current-password"
					required
				/>
				<button class="admin-login__unlock" type="submit">Unlock</button>
			</div>
			{#if form?.error}
				<p class="admin-login__error" role="status">{form.error}</p>
			{/if}
		</form>

		<p class="admin-login__hint">Authorized access only.</p>
	</div>
</div>
