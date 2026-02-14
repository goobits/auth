<script>
	import './Contact.styl'
	import Hero from '$lib/ui/Hero.svelte'
	import { form, field } from 'svelte-forms'
	import { email, required } from 'svelte-forms/validators'

	const yourName = field('yourName', '', [ required() ])
	const yourEmail = field('yourEmail', '', [ email(), required() ])
	const yourMessage = field('yourMessage', '', [ required() ])

	const myForm = form(yourName, yourEmail, yourMessage)

	async function submitForm() {
		await myForm.validate()

		if ($myForm.valid) {
			const formData = new FormData(document.querySelector('form'))
			const data = {}
			formData.forEach((value, key) => (data[key] = value))
			const request = new XMLHttpRequest()
			request.open('POST', 'https://miko.art/api/email')
			request.send(JSON.stringify(data))
			request.onload = function () {
				if (request.status === 200) {
					window.location.href = '/contact/thank-you'
				} else {
					alert('Something went wrong. Please try again.')
				}
			}
		}
	}
</script>

<svelte:head>
    <title>Contact - MIKO.ART</title>
</svelte:head>

<Hero
	className="contact-page contact-page__hero"
	title="Contact Miko"
	subtitle="Got a question? Drop me a line."
	icon="/media/emoji-herb.png"
	iconSize="0.96em"
/>

<contact-form class="contact-page__form-shell">
    <img class="contact-page__image" src="/media/super-racoon.svg" style="float: right; width: 31%" alt="">
    <form class="contact-page__form" style="float: left; width: 60%" action="javascript:">
        <form-title>Your Name <span>*</span></form-title>
        <input type="text" name="name" bind:value={$yourName.value}><br>

        <form-title>Your Email <span>*</span></form-title>
        <input type="text" name="email" bind:value={$yourEmail.value}><br>

        <form-title>Your Message <span>*</span></form-title>
        <textarea name="message" bind:value={$yourMessage.value}></textarea>

        <contact-form-errors class="contact-page__errors">
            {#if $myForm.hasError('yourName.required')}
                <li>Name is required</li>
            {/if}

            {#if $myForm.hasError('yourEmail.required')}
                <li>Email is required</li>
            {:else if $myForm.hasError('yourEmail.not_an_email')}
                <li>Email is invalid</li>
            {/if}

            {#if $myForm.hasError('yourMessage.required')}
                <li>Message is required</li>
            {/if}
        </contact-form-errors>

        <button class="contact-page__submit" on:click={submitForm}>Send</button>

		<p class="contact-form__legal-note contact-page__legal-note">
			By sending this form, you agree to our
			<a href="/privacy">Privacy Policy</a>,
			<a href="/terms">Terms of Use</a>, and
			<a href="/cookies">Cookie Policy</a>.
		</p>
    </form>
    <div style="clear: both"></div>
</contact-form>
