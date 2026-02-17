<script>
	import './Admin.scss'
	import { AdminShellLayout } from '@miko/calendar-ui'

	const { children, data } = $props()
</script>

<AdminShellLayout {data}>
	{@render children()}
</AdminShellLayout>
