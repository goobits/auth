<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Users, LogOut } from '@lucide/svelte'
	import { ADMIN_NAV } from '$lib/viewmodels/admin'

	const { tab, onSelect } = $props()
</script>

<aside class="admin-page__sidebar">
	<div class="admin-page__sidebar-title">Manage</div>
	{#each ADMIN_NAV as n}
		<button
			class="admin-page__sidebar-item"
			class:admin-page__sidebar-item--active={tab === n.id}
			onclick={() => onSelect(n.id)}
		>
			{#if n.id === 'dash'}
				<Clock size={16} strokeWidth={1.8} />
			{:else if n.id === 'cal'}
				<Calendar size={16} strokeWidth={1.8} />
			{:else if n.id === 'calendar-auth'}
				<Users size={16} strokeWidth={1.8} />
			{/if}
			{n.label}
		</button>
	{/each}
	<form method="POST" action="?/logout" use:enhance>
		<button class="admin-page__sidebar-item admin-page__sidebar-item--logout" type="submit"><LogOut size={16} strokeWidth={1.8} /> Logout</button>
	</form>
</aside>
