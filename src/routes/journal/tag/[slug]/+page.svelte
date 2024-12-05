<script>
	import Results from '@components/Results.svelte'

	let { data } = $props()
</script>

<Results {...data} type="tag"/>