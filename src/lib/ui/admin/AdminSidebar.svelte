<script>
	import { Clock, Calendar, CalendarClock, LayoutGrid, Users, Link2 } from '@lucide/svelte'
	import { ADMIN_NAV } from '$lib/viewmodels/admin'

	const { tab, onSelect } = $props()
</script>

<aside class="admin-page__sidebar">
	<div class="admin-page__sidebar-label">Manage</div>

	<div class="admin-page__sidebar-items">
		{#each ADMIN_NAV as n}
			<button
				class="admin-page__sidebar-item"
				class:admin-page__sidebar-item--active={tab === n.id}
				onclick={() => onSelect(n.id)}
				type="button"
			>
				{#if n.id === 'dash'}
					<Clock size={16} strokeWidth={1.8} />
				{:else if n.id === 'cal'}
					<Calendar size={16} strokeWidth={1.8} />
				{:else if n.id === 'calendar-auth'}
					<Users size={16} strokeWidth={1.8} />
				{:else if n.id === 'programs'}
					<LayoutGrid size={16} strokeWidth={1.8} />
				{:else if n.id === 'events'}
					<CalendarClock size={16} strokeWidth={1.8} />
				{:else if n.id === 'integrations'}
					<Link2 size={16} strokeWidth={1.8} />
				{/if}
				{n.label}
			</button>
		{/each}
	</div>
</aside>
