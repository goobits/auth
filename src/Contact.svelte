<title>MIKO.ART - Contact</title>
<!--🌿-->
<h1>Contact Miko <img src="/media/emoji-herb.png" height="56" width="56" style="vertical-align: top" alt=""></h1>
<h2>Got a question? Drop me a line.</h2>

<script>
	import {form, field} from 'svelte-forms'
	import {email, required} from 'svelte-forms/validators'

	const yourName = field('yourName', '', [required()])
	const yourEmail = field('yourEmail', '', [email(), required()])
	const yourMessage = field('yourMessage', '', [required()])

	const myForm = form(yourName, yourEmail, yourMessage)

	async function submitForm() {
		await myForm.validate()

		if ($myForm.valid) {
			const formData = new FormData(document.querySelector('form'))
			const request = new XMLHttpRequest()
			request.open('POST', '/contact.php')
			request.send(formData)
			request.onload = function () {
				if (request.status === 200) {
					window.location.href = '/contact-thank-you/'
				} else {
					alert('Something went wrong. Please try again.')
				}
			}
		}
	}
</script>

<contact-form>
    <img src="/media/super-racoon.svg" style="float: right; width: 31%" alt="">
    <form style="float: left; width: 60%" action="javascript:">
        <form-title>Your Name <span>*</span></form-title>
        <input type="text" name="name" bind:value={$yourName.value}><br>

        <form-title>Your Email <span>*</span></form-title>
        <input type="text" name="email" bind:value={$yourEmail.value}><br>

        <form-title>Your Message <span>*</span></form-title>
        <textarea name="message" bind:value={$yourMessage.value}></textarea>

        <contact-form-errors>
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

        <button on:click={submitForm}>Send</button>
    </form>
    <div style="clear: both"></div>
</contact-form>