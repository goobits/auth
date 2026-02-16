<script>
	import AdminPageShell from '$lib/ui/admin/AdminPageShell.svelte'
	let { data, form } = $props()
</script>

<AdminPageShell {data} {form} initialTab={data.initialTab || 'dash'} />
