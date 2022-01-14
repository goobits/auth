<title>MIKO.ART - Contact</title>

<h1>Contact Miko 💕</h1>
<p>Want to collaborate with me?</p>

<script>
	import {form, field, combined} from 'svelte-forms'
	import {required} from 'svelte-forms/validators'

	const firstname = field('firstname', '', [required()])
	const lastname = field('lastname', '', [required()])
	const fullname = combined('fullname', [firstname, lastname], ([firstname, lastname]) => [firstname.value, lastname.value].join(' '))

	const myForm = form(name);
</script>

<!--<section>-->
<!--    <input type="text" bind:value={$firstname.value}>-->
<!--    <input type="text" bind:value={$lastname.value}>-->

<!--    {#if $myForm.hasError('firstname.required')}-->
<!--        <div>Firstname is required</div>-->
<!--    {/if}-->

<!--    {#if $myForm.hasError('lastname.required')}-->
<!--        <div>Lastname is required</div>-->
<!--    {/if}-->

<!--    <div>Welcome {$fullname.value}</div>-->

<!--    <button on:click={name.validate}>Validate field</button>-->
<!--</section>-->
