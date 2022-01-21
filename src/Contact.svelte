<title>MIKO.ART - Contact</title>

<h1>Contact Miko 🌿</h1>
<h2>Got a question? Drop me a line.</h2>

<script>
	import {form, field} from 'svelte-forms'
	import {email, required} from 'svelte-forms/validators'

	const yourName = field('yourName', '', [required()])
	const yourEmail = field('yourEmail', '', [email(), required()])
	const yourMessage = field('yourMessage', '', [required()])

	const myForm = form(yourName, yourEmail, yourMessage)

	async function blah() {
		console.log(await myForm.validate())
	}
</script>

<contact-form>
    <img src="https://image.freepik.com/free-vector/cute-cat-super-hero-cartoon-icon-illustration-animal-hero-icon-concept-isolated-flat-cartoon-style_138676-3127.jpg" style="float: right; width: 35%">
    <div style="float: left; width: 60%">
        <form-title>Name <span>*</span></form-title>
        <input type="text" bind:value={$yourName.value}><br>

        <form-title>Email <span>*</span></form-title>
        <input type="text" bind:value={$yourEmail.value}><br>

        <form-title>Your Message <span>*</span></form-title>
        <textarea bind:value={$yourMessage.value}></textarea>

        {#if $myForm.hasError('yourName.required')}
            <div>Name is required</div>
        {/if}

        {#if $myForm.hasError('yourEmail.required')}
            <div>Email is required</div>
        {/if}

        {#if $myForm.hasError('yourMessage.required')}
            <div>Message is required</div>
        {/if}

        <button on:click={myForm.validate}>Send</button>
    </div>
</contact-form>