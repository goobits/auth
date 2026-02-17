<script>
	import CalendarShellLayout from '$lib/ui/calendar/CalendarShellLayout.svelte'

	const { data, children } = $props()
</script>

<CalendarShellLayout {data}>
	{@render children()}
</CalendarShellLayout>
