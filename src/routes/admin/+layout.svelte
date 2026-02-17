<script>
	import AdminShellLayout from '$lib/ui/admin/AdminShellLayout.svelte'

	const { children, data } = $props()
</script>

<AdminShellLayout {data}>
	{@render children()}
</AdminShellLayout>
