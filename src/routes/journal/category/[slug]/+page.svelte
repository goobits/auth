<script>
	import Results from '@components/Journal/Results.svelte'
	let { data } = $props()
</script>

<svelte:head>
	<title>Category: {data.category} - MIKO.ART</title>
</svelte:head>

<Results {...data} type="category" />
