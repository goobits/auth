<script>
	import { handleUnauthorizedSessionError } from '$lib/client/routing/auth'
	import { formatAdminDate } from '$lib/viewmodels/admin'
	import { createAdminDashboardController } from '$lib/viewmodels/admin-dashboard-controller.svelte'
	import { createAdminMembersController } from '$lib/viewmodels/admin-members.svelte'
	import AdminLoginCard from '$lib/ui/admin/AdminLoginCard.svelte'
	import AdminSidebar from '$lib/ui/admin/AdminSidebar.svelte'
	import AdminDashboardPanel from '$lib/ui/admin/AdminDashboardPanel.svelte'
	import AdminCalendarPanel from '$lib/ui/admin/AdminCalendarPanel.svelte'
	import AdminMembersPanel from '$lib/ui/admin/AdminMembersPanel.svelte'
	import AdminBookingModal from '$lib/ui/admin/AdminBookingModal.svelte'
	import AdminToast from '$lib/ui/admin/AdminToast.svelte'

	let { data, form } = $props()

	let tab = $state('dash')
	let authed = $derived(!!data.user)
	// `form` is only populated for non-redirect action responses.
	// Successful login redirects, so we shouldn't rely on `form.success` here.

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
	<AdminLoginCard {form} />
{:else}
	<div class="admin-page">
		<AdminSidebar {tab} onSelect={(nextTab) => tab = nextTab} />

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

	{#if dashboard.saved}
		<AdminToast />
	{/if}
{/if}
