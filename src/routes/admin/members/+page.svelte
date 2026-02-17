<script>
	import { AdminPageShell } from '@miko/calendar-ui'
	let { data, form } = $props()
</script>

<AdminPageShell {data} {form} initialTab={data.initialTab || 'dash'} />
