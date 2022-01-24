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
		console.log(await myForm.validate())
	}
</script>

<contact-form>
    <img src="/media/super-racoon.svg" style="float: right; width: 30%">
    <div style="float: left; width: 60%">
        <form-title>Name <span>*</span></form-title>
        <input type="text" bind:value={$yourName.value}><br>

        <form-title>Email <span>*</span></form-title>
        <input type="text" bind:value={$yourEmail.value}><br>

        <form-title>Your Message <span>*</span></form-title>
        <textarea bind:value={$yourMessage.value}></textarea>

        {#if $myForm.hasError('yourName.required')}
            <div>Name is required!</div>
        {/if}

        {#if $myForm.hasError('yourEmail.required')}
            <div>Email is required!</div>
        {:else if $myForm.hasError('yourEmail.not_an_email')}
            <div>Email is invalid!</div>
        {/if}

        {#if $myForm.hasError('yourMessage.required')}
            <div>Message is required!</div>
        {/if}

        <button on:click={submitForm}>Send</button>
    </div>
    <div style="clear: both"></div>
</contact-form>