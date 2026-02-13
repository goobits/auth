<script>
	import Results from '@components/Journal/Results.svelte'
	let { data } = $props()
</script>

<svelte:head>
	<title>Category: {data.category} - MIKO.ART</title>
</svelte:head>

<div class="journal-results journal-results--category">
	<div class="journal-results__content">
		<Results {...data} type="category" />
	</div>
</div>
