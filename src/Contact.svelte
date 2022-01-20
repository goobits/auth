<title>MIKO.ART - Contact</title>

<h1>Contact Miko 🌿</h1>
<h2>Want to collaborate with me?</h2>

<script>
	import {form, field} from 'svelte-forms'
	import {email, required} from 'svelte-forms/validators'

	const yourName = field('firstname', '', [required()])
	const yourEmail = field('name', '', [email(), required()])
	const yourMessage = field('message', '', [required()])

	const myForm = form(yourName, yourEmail)

    async function blah() {
        console.log(await myForm.validate())
    }
</script>

<section>
    Name
    <input type="text" bind:value={$yourName.value}><br>

    Email
    <input type="text" bind:value={$yourEmail.value}><br>

    Your Message
    <textarea bind:value={$yourMessage.value}></textarea>

    {#if $myForm.hasError('yourName.required')}
        <div>Firstname is required</div>
    {/if}

    {#if $myForm.hasError('yourEmail.required')}
        <div>Lastname is required</div>
    {/if}

    {#if $myForm.hasError('yourMessage.required')}
        <div>Message is required</div>
    {/if}

    <button on:click={blah}>Send</button>
</section>