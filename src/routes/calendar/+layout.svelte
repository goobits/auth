<script>
	import './Calendar.scss'
	import { CalendarShellLayout } from '@miko/calendar-ui'

	const { data, children } = $props()
</script>

<CalendarShellLayout {data}>
	{@render children()}
</CalendarShellLayout>
