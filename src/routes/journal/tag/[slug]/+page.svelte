<script>
	import Results from '@components/Journal/Results.svelte'

	let { data } = $props()
</script>

<svelte:head>
	<title>Tag: {data.category} - MIKO.ART</title>
</svelte:head>

<Results {...data} type="tag"/>
