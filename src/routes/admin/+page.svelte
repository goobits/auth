<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Check, Users, LogOut } from '@lucide/svelte'
	import { handleUnauthorizedSessionError } from '$lib/client/routing/auth'
	import {
		ADMIN_NAV,
		formatAdminDate
	} from '$lib/viewmodels/admin'
	import { createAdminDashboardController } from '$lib/viewmodels/admin-dashboard-controller.svelte'
	import { createAdminMembersController } from '$lib/viewmodels/admin-members.svelte'
	import AdminDashboardPanel from '$lib/ui/admin/AdminDashboardPanel.svelte'
	import AdminCalendarPanel from '$lib/ui/admin/AdminCalendarPanel.svelte'
	import AdminMembersPanel from '$lib/ui/admin/AdminMembersPanel.svelte'
	import AdminBookingModal from '$lib/ui/admin/AdminBookingModal.svelte'

	let { data, form } = $props()

	let tab = $state('dash')
	let authed = $derived(!!data.user)

	const dashboard = createAdminDashboardController({ onUnauthorized: handleUnauthorizedSessionError })
	const members = createAdminMembersController({ onUnauthorized: handleUnauthorizedSessionError })

	$effect(() => {
		if (authed) {
			dashboard.loadStatus()
			dashboard.loadBookings()
		}
	})

	$effect(() => {
		if (tab === 'calendar-auth') {
			members.load()
		}
	})
</script>

<svelte:head>
	<title>Admin | Rainbow Gym | MIKO.ART</title>
</svelte:head>

{#if !authed}
	<div class="admin-page__login">
		<div class="admin-page__login-card">
			<div class="admin-page__login-title">Admin access</div>
			<div class="admin-page__login-sub">Enter the admin passcode to continue.</div>
			<form method="POST" action="?/login" use:enhance>
				<input type="hidden" name="email" value="admin@miko.art" />
				<div class="admin-page__login-field">
					<input class="admin-page__input" type="password" name="password" placeholder="Passcode" />
				</div>
				{#if form?.error}
					<div class="admin-page__login-error">{form.error}</div>
				{/if}
				<button class="admin-page__button-secondary admin-page__unlock" type="submit">Unlock</button>
			</form>
		</div>
	</div>
{:else}
	<div class="admin-page">
		<!-- Sidebar -->
		<aside class="admin-page__sidebar">
			<div class="admin-page__sidebar-title">Manage</div>
			{#each ADMIN_NAV as n}
				<button
					class="admin-page__sidebar-item"
					class:admin-page__sidebar-item--active={tab === n.id}
					onclick={() => tab = n.id}
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

		<!-- Content -->
		<main class="admin-page__main">
			{#if tab === 'dash'}
				<AdminDashboardPanel {dashboard} />
			{/if}

			{#if tab === 'cal'}
				<AdminCalendarPanel {dashboard} />
			{/if}

			{#if tab === 'calendar-auth'}
				<AdminMembersPanel {members} formatDate={formatAdminDate} />
			{/if}
		</main>
	</div>

	<AdminBookingModal {dashboard} />

	<!-- Save toast -->
{#if dashboard.saved}
		<div class="admin-page__toast">
			<Check size={14} strokeWidth={2.5} />
			Rules saved successfully.
		</div>
	{/if}
{/if}
