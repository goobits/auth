<script>
	import Results from '@components/Journal/Results.svelte'

	let { data } = $props()
</script>

<svelte:head>
	<title>Tag: {data.category} - MIKO.ART</title>
</svelte:head>

<div class="journal-results journal-results--tag">
	<div class="journal-results__content">
		<Results {...data} type="tag"/>
	</div>
</div>
