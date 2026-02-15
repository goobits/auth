<svelte:head>
	<title>Check your email - MIKO.ART</title>
</svelte:head>

<section class="register-success ui-surface-card">
	<h1>Check your email</h1>
	<p>Your account was created. Please verify your email before signing in.</p>
	<p><a href="/calendar/login">Go to sign in</a></p>
</section>

<style>
	.register-success {
		max-width: min(36rem, 100%);
		padding: var(--space-8);
		display: grid;
		gap: var(--space-3);
	}
	.register-success h1,
	.register-success p {
		margin: 0;
	}
</style>
