<script lang="ts">
	import { goto } from '$app/navigation'
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import { submitContact, toContactPayload } from '$lib/client/forms/contact'
	import './Contact.scss'

	type ContactErrors = {
		name?: string
		email?: string
		message?: string
	}

	let submitting = $state(false)
	let submitError = $state('')
	let values = $state({ name: '', email: '', message: '' })
	let errors = $state<ContactErrors>({})

	function validate() {
		const nextErrors: ContactErrors = {}
		if (!values.name.trim()) nextErrors.name = 'Name is required'
		if (!values.email.trim()) nextErrors.email = 'Email is required'
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = 'Email is invalid'
		if (!values.message.trim()) nextErrors.message = 'Message is required'
		errors = nextErrors
		return Object.keys(nextErrors).length === 0
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault()
		submitError = ''
		if (!validate()) return

		submitting = true
		const form = event.currentTarget as HTMLFormElement
		const payload = toContactPayload(new FormData(form))
		const result = await submitContact(payload)
		submitting = false

		if (result.ok) {
			await goto('/contact/thank-you')
			return
		}

		submitError = result.error || 'Something went wrong. Please try again.'
	}
</script>

<svelte:head>
	<title>Contact - MIKO.ART</title>
</svelte:head>

<PageShell className="contact-page">
	<Hero
		className="contact-page__hero"
		eyebrow="Contact"
		title="Contact Miko"
		subtitle="Got a question? Drop me a line."
		compact
	/>

	<section class="contact-page__layout">
		<div class="contact-page__form-shell ui-surface-card">
			<form class="contact-page__form" onsubmit={onSubmit} novalidate>
			<label class="contact-page__field">
				<span>Your Name <i aria-hidden="true">*</i></span>
				<input type="text" name="name" bind:value={values.name} autocomplete="name" />
				{#if errors.name}<small>{errors.name}</small>{/if}
			</label>

			<label class="contact-page__field">
				<span>Your Email <i aria-hidden="true">*</i></span>
				<input type="email" name="email" bind:value={values.email} autocomplete="email" />
				{#if errors.email}<small>{errors.email}</small>{/if}
			</label>

			<label class="contact-page__field">
				<span>Your Message <i aria-hidden="true">*</i></span>
				<textarea name="message" bind:value={values.message}></textarea>
				{#if errors.message}<small>{errors.message}</small>{/if}
			</label>

			{#if submitError}
				<p class="contact-page__submit-error">{submitError}</p>
			{/if}

			<button class="contact-page__submit" type="submit" disabled={submitting}>
				{submitting ? 'Sending…' : 'Send'}
			</button>

			<p class="contact-page__legal-note">
				By sending this form, you agree to our
				<a href="/privacy">Privacy Policy</a>,
				<a href="/terms">Terms of Use</a>, and
				<a href="/cookies">Cookie Policy</a>.
			</p>
			</form>
		</div>
		<aside class="contact-page__aside">
			<img class="contact-page__image" src="/media/super-racoon.svg" alt="Raccoon illustration" loading="lazy" />
		</aside>
	</section>
</PageShell>
