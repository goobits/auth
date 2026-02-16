<script lang="ts">
	import SuccessPage from '$lib/ui/SuccessPage.svelte'
</script>

<svelte:head>
	<title>Check Your Email - MIKO.ART</title>
</svelte:head>

<SuccessPage
	className="register-page register-success-page"
	title="Check your email"
	copy="Your account is ready. Open your inbox and confirm your email to finish setup before signing in."
	buttonHref="/calendar/login"
	buttonLabel="Go to sign in"
	imageSrc="/media/contact-thank-you.svg"
	imageAlt="Success illustration"
	buttonIcon="login"
/>
