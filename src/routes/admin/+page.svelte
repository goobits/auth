<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Check, RefreshCw, Save, ChevronRight, Loader, Users, LogOut } from '@lucide/svelte'
	import { handleUnauthorizedSessionError } from '$lib/client/routing/auth'
	import {
		ADMIN_NAV,
		formatAdminDate
	} from '$lib/viewmodels/admin'
	import { createAdminDashboardController } from '$lib/viewmodels/admin-dashboard-controller.svelte'
	import { createAdminMembersController } from '$lib/viewmodels/admin-members.svelte'

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
				<h1 class="admin-page__title">Dashboard</h1>
				<p class="admin-page__subtitle">Everything about your gym, at a glance.</p>

				<!-- Stats row -->
				<div class="admin-page__stats">
					<div class="admin-page__stat-card">
						<div class="admin-page__stat-value">{dashboard.stats.upcoming}</div>
						<div class="admin-page__stat-label">Upcoming bookings</div>
					</div>
					<div class="admin-page__stat-card">
						<div class="admin-page__stat-value">{dashboard.stats.seats}</div>
						<div class="admin-page__stat-label">Seats reserved</div>
					</div>
					<div class="admin-page__stat-card">
						<div class="admin-page__stat-value" class:admin-page__stat-value--synced={dashboard.connected && !dashboard.connectionExpired}>
							{#if dashboard.connected && !dashboard.connectionExpired}Synced{:else if dashboard.connected && dashboard.connectionExpired}Expired{:else}Offline{/if}
						</div>
						<div class="admin-page__stat-label">Google Calendar</div>
					</div>
				</div>

				<!-- Calendar connection -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Google Calendar</h3>
						<span class="admin-page__status-badge" class:admin-page__status-badge--connected={dashboard.connected && !dashboard.connectionExpired}>
							{#if dashboard.connected && !dashboard.connectionExpired}
								<Check size={14} strokeWidth={2.5} />
								Connected
							{:else if dashboard.connected && dashboard.connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="admin-page__section-description">Availability and bookings stay in sync with your Google Calendar — automatically.</p>
					<div class="admin-page__button-row">
						<button class="admin-page__button-secondary" onclick={dashboard.reconnect}>
							<RefreshCw size={14} />
							{dashboard.connected ? 'Reconnect' : 'Connect'}
						</button>
					</div>
				</div>

				<!-- Availability -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Availability rules</h3>
					</div>
					<p class="admin-page__section-description">Define when friends can book, and how much runway you need between sessions.</p>
					<div class="admin-page__fields-grid">
						<div class="admin-page__fields-row">
							<div class="admin-page__field">
								<span class="admin-page__field-label">Operating hours</span>
								<div class="admin-page__time-row">
									<input class="admin-page__input" type="time" bind:value={dashboard.hours.from} aria-label="Opening time" />
									<span class="admin-page__time-separator">to</span>
									<input class="admin-page__input" type="time" bind:value={dashboard.hours.to} aria-label="Closing time" />
								</div>
							</div>
						</div>
						<div class="admin-page__fields-row">
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Buffer between slots
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="0" bind:value={dashboard.buffer} />
										<span class="admin-page__input-suffix">min</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Minimum notice
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.notice} />
										<span class="admin-page__input-suffix">hrs</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Capacity per slot
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={dashboard.capacity} />
										<span class="admin-page__input-suffix">people</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={dashboard.save} disabled={dashboard.saving}>
						{#if dashboard.saving}
							<Loader size={12} class="admin-page__spin" />
							Saving...
						{:else}
							<Save size={12} />
							Save rules
						{/if}
					</button>
				</div>

				<!-- Bookings -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Recent bookings</h3>
						<span class="admin-page__section-count">{dashboard.bookings.length} total</span>
					</div>
					{#if dashboard.loading}
						<p class="admin-page__section-description">Loading bookings...</p>
					{:else if dashboard.error}
						<p class="admin-page__section-description admin-page__section-description--error">{dashboard.error}</p>
						<button class="admin-page__button-secondary" onclick={loadBookings}>Retry</button>
					{:else if dashboard.bookings.length === 0}
						<p class="admin-page__section-description">No upcoming bookings yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each dashboard.bookings as b, i}
								<button
									class="admin-page__booking-row"
									class:admin-page__booking-row--hovered={dashboard.hover === b.id}
									onmouseenter={() => dashboard.hover = b.id}
									onmouseleave={() => dashboard.hover = null}
									onclick={() => dashboard.viewBooking = b}
								>
									<span class="admin-page__booking-date">{b.date} · {b.time}</span>
									<span class="admin-page__booking-meta">{b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.name}</span>
									<span class="admin-page__status-badge" class:admin-page__status-badge--confirmed={b.status === 'confirmed'} class:admin-page__status-badge--pending={b.status === 'pending'}>
										{b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
									</span>
									<ChevronRight class="admin-page__booking-arrow" size={14} />
								</button>
								{#if i < dashboard.bookings.length - 1}
									<div class="admin-page__booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if tab === 'cal'}
				<h1 class="admin-page__title">Calendar</h1>
				<p class="admin-page__subtitle">Manage your Google Calendar connection and sync preferences.</p>
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Google Calendar</h3>
						<span class="admin-page__status-badge" class:admin-page__status-badge--connected={dashboard.connected && !dashboard.connectionExpired}>
							{#if dashboard.connected && !dashboard.connectionExpired}
								<Check size={14} strokeWidth={2.5} />
								Connected
							{:else if dashboard.connected && dashboard.connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="admin-page__section-description">Your bookings automatically appear on your calendar. Blocked times on your calendar automatically remove availability from clients.</p>
					<div class="admin-page__button-row">
						<button class="admin-page__button-secondary" onclick={dashboard.reconnect}>
							<RefreshCw size={14} />
							Reconnect
						</button>
					</div>
				</div>
			{/if}

			{#if tab === 'calendar-auth'}
				<h1 class="admin-page__title">Members</h1>
				<p class="admin-page__subtitle">Manage invite codes and users.</p>

				{#if members.error}
					<div class="admin-page__section admin-page__section--error">
						<p class="admin-page__calendar-error">{members.error}</p>
					</div>
				{/if}

				<!-- Create Invite -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Create Invite</h3>
					</div>
					<p class="admin-page__section-description">Generate invite codes for new members.</p>
					<div class="admin-page__fields-grid">
						<div class="admin-page__fields-row">
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Email (optional)
									<input class="admin-page__input" type="email" bind:value={members.inviteEmail} placeholder="user@example.com" />
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Uses
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={members.inviteUses} />
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Expires in
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={members.inviteExpires} />
										<span class="admin-page__input-suffix">days</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={members.createInvite} disabled={members.creating}>
						{#if members.creating}
							<Loader size={12} class="admin-page__spin" />
							Creating...
						{:else}
							Create Invite
						{/if}
					</button>
				</div>

				<!-- Invites List -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Invites</h3>
						<span class="admin-page__section-count">{members.invites.length} total</span>
					</div>
					{#if members.loading}
						<p class="admin-page__section-description">Loading invites...</p>
					{:else if members.invites.length === 0}
						<p class="admin-page__section-description">No invites created yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each members.invites as invite, i}
								<div class="admin-page__booking-row admin-page__booking-row--static">
									<span class="admin-page__booking-date">
										<code class="admin-page__invite-code">{invite.code}</code>
									</span>
									<span class="admin-page__booking-meta">
										{invite.uses_remaining ?? '∞'} uses left
										{#if invite.email}· {invite.email}{/if}
										{#if invite.expires_at}· expires {formatAdminDate(invite.expires_at)}{/if}
									</span>
									<div class="admin-page__button-row admin-page__button-row--compact">
										<button class="admin-page__button-secondary admin-page__button-secondary--compact" onclick={() => members.copyInvite(invite.code)}>
											Copy Link
										</button>
										<button class="admin-page__button-secondary admin-page__button-secondary--danger admin-page__button-secondary--compact" onclick={() => members.deleteInvite(invite.id)}>
											Delete
										</button>
									</div>
								</div>
								{#if i < members.invites.length - 1}
									<div class="admin-page__booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<!-- Users List -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Users</h3>
						<span class="admin-page__section-count">{members.users.length} total</span>
					</div>
					{#if members.loading}
						<p class="admin-page__section-description">Loading users...</p>
					{:else if members.users.length === 0}
						<p class="admin-page__section-description">No users have signed up yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each members.users as user, i}
								<div class="admin-page__booking-row admin-page__booking-row--static">
									<span class="admin-page__booking-date admin-page__booking-date--with-avatar">
										{#if user.avatar_url}
											<img src={user.avatar_url} alt="" class="admin-page__booking-avatar" />
										{/if}
										{user.name || user.email}
									</span>
									<span class="admin-page__booking-meta">
										{user.provider || 'member'} · last login {formatAdminDate(user.last_login_at)}
									</span>
								</div>
								{#if i < members.users.length - 1}
									<div class="admin-page__booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</main>
	</div>

	<!-- Booking detail modal -->
	{#if dashboard.viewBooking}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="admin-page__modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={() => dashboard.viewBooking = null} onkeydown={(e) => e.key === 'Escape' && (dashboard.viewBooking = null)}>
			<div class="admin-page__modal-card" role="document" onkeydown={() => {}} onclick={(e) => e.stopPropagation()}>
				<h3 class="admin-page__modal-title">Booking details</h3>
				<p class="admin-page__modal-subtitle">Here's what we have on file.</p>
				<div class="admin-page__modal-rows">
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Date</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.date}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Time</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.time}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Guest</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.name}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Email</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.email}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Seats</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.seats}</span>
					</div>
					{#if dashboard.viewBooking.note}
						<div class="admin-page__modal-row">
							<span class="admin-page__modal-label">Note</span>
							<span class="admin-page__modal-value">{dashboard.viewBooking.note}</span>
						</div>
					{/if}
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Status</span>
						<span class="admin-page__modal-value">{dashboard.viewBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
					</div>
				</div>
				<div class="admin-page__modal-actions">
					<button class="admin-page__button-primary" onclick={() => dashboard.viewBooking = null}>Done</button>
					<button class="admin-page__button-secondary admin-page__button-secondary--danger" onclick={() => dashboard.cancelBooking(dashboard.viewBooking.id)} disabled={dashboard.canceling}>
						{#if dashboard.canceling}
							<Loader size={12} class="admin-page__spin" />
							Canceling...
						{:else}
							Cancel booking
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Save toast -->
{#if dashboard.saved}
		<div class="admin-page__toast">
			<Check size={14} strokeWidth={2.5} />
			Rules saved successfully.
		</div>
	{/if}
{/if}
