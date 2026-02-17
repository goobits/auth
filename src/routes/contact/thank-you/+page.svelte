<script lang="ts">
	import { SuccessPage } from '@miko/ui'
</script>

<svelte:head>
	<title>Thank You - MIKO.ART</title>
</svelte:head>

<SuccessPage
	className="contact-page thank-you-page"
	title="Message received!"
	copy="Thank you for reaching out. I&apos;ll get back to you as soon as possible."
	buttonHref="/"
	buttonLabel="Back to home"
	imageSrc="/media/contact-thank-you.svg"
	imageAlt="Thank you illustration"
	buttonIcon="home"
/>
