<script lang="ts">
	import { goto } from '$app/navigation'
	import { ChevronRight } from '@lucide/svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	import { submitContact, toContactPayload } from '$lib/client/forms/contact'

	let { data } = $props()

	type ContactErrors = {
		name?: string
		email?: string
		message?: string
	}

	let submitting = $state(false)
	let submitError = $state('')
	let values = $state({ name: '', email: '', message: '' })
	let errors = $state<ContactErrors>({})

	const contextFrom = $derived((data?.contextFrom || '').trim())
	const contextTopic = $derived((data?.contextTopic || '').trim())
	const contextLabel = $derived.by(() => {
		const parts = [contextFrom, contextTopic].filter(Boolean)
		return parts.length ? parts.join(' / ') : ''
	})
	const messagePlaceholder = $derived.by(() => {
		if (contextFrom === 'music' && contextTopic) return 'Tell me what you need and include any links...'
		if (contextFrom === 'art') return 'Tell me about the piece, timeline, and any reference links...'
		if (contextFrom === 'about' && contextTopic) return 'Tell me a bit about your project and what you are looking for...'
		return 'Tell me about your project…'
	})

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
		title="Say hello"
		icon="/media/contact-email-heart.png"
		iconAlt="Email heart icon"
		subtitle="Got a question, a project idea, or just want to chat? Drop me a line."
		compact
	/>

	<section class="contact-page__layout">
		<div class="contact-page__form-section">
			<form class="contact-page__form" onsubmit={onSubmit} novalidate>
				<input type="hidden" name="from" value={contextFrom} />
				<input type="hidden" name="topic" value={contextTopic} />
				{#if contextLabel}
					<p class="contact-page__context">Context: {contextLabel}</p>
				{/if}
				<label class="contact-page__field">
					<span>Name <i aria-hidden="true">*</i></span>
					<input
						type="text"
						name="name"
						bind:value={values.name}
						autocomplete="name"
						placeholder="What should I call you?"
					/>
					{#if errors.name}<small>{errors.name}</small>{/if}
				</label>

				<label class="contact-page__field">
					<span>Email <i aria-hidden="true">*</i></span>
					<input
						type="email"
						name="email"
						bind:value={values.email}
						autocomplete="email"
						placeholder="you@email.com"
					/>
					{#if errors.email}<small>{errors.email}</small>{/if}
				</label>

				<label class="contact-page__field">
					<span>Message <i aria-hidden="true">*</i></span>
					<textarea name="message" bind:value={values.message} placeholder={messagePlaceholder}></textarea>
					{#if errors.message}<small>{errors.message}</small>{/if}
				</label>

				{#if submitError}
					<p class="contact-page__submit-error">{submitError}</p>
				{/if}

				<PillButton className="contact-page__submit" type="submit" variant="primary" size="lg" disabled={submitting}>
					{submitting ? 'Sending…' : 'Send message'}
					{#if !submitting}
						<ChevronRight class="contact-page__submit-icon" size={18} strokeWidth={2.4} aria-hidden="true" />
					{/if}
				</PillButton>

				<p class="contact-page__legal-note">
					By sending this form you agree to our <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms</a>,
					and <a href="/cookies">Cookie Policy</a>.
				</p>
			</form>
		</div>
		<aside class="contact-page__aside">
			<section class="contact-page__aside-section">
				<p class="contact-page__aside-label">Response time</p>
				<p>
					I usually reply within a day or two. A short note about scope and timeline helps me get back faster.
				</p>
			</section>
			<section class="contact-page__aside-section">
				<p class="contact-page__aside-label">Elsewhere</p>
				<nav class="contact-page__aside-links" aria-label="Social profiles">
					<a href="https://github.com/mudcube" target="_blank" rel="noreferrer noopener nofollow">GitHub ↗</a>
				</nav>
			</section>
			<div class="contact-page__raccoon-wrap">
				<img
					class="contact-page__image"
					src="/media/super-racoon.svg"
					alt="Raccoon illustration"
					width="180"
					height="180"
					loading="lazy"
					decoding="async"
				/>
			</div>
		</aside>
	</section>
</PageShell>
