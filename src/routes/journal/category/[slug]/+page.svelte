<script>
	import Results from '@components/Journal/Results.svelte'
	let { data } = $props()
</script>

<Results {...data} type="category" />