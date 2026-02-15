<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Check, RefreshCw, Save, ChevronRight, Loader, Users, LogOut } from '@lucide/svelte'
	import { handleUnauthorizedSessionError } from '$lib/client/routing/auth'
	import {
		ADMIN_NAV,
		DEFAULT_ADMIN_RULES,
		DEFAULT_ADMIN_STATS,
		DEFAULT_INVITE_DRAFT,
		formatAdminDate
	} from '$lib/viewmodels/admin'
	import {
		cancelDashboardBooking,
		createInviteShareLink,
		createMemberInvite,
		deleteMemberInvite,
		getCalendarReconnectUrl,
		loadDashboardBookings,
		loadDashboardStatus,
		loadMembersData,
		saveDashboardRules
	} from '$lib/viewmodels/admin-dashboard'

	let { data, form } = $props()

	let tab = $state('dash')
	let hours = $state(DEFAULT_ADMIN_RULES.hours)
	let buffer = $state(DEFAULT_ADMIN_RULES.buffer)
	let notice = $state(DEFAULT_ADMIN_RULES.notice)
	let capacity = $state(DEFAULT_ADMIN_RULES.capacity)
	let saved = $state(false)
	let saving = $state(false)
	let canceling = $state(false)
	let viewBooking = $state(null)
	let hover = $state(null)
	let connected = $state(false)
	let connectionExpired = $state(false)
	let bookings = $state([])
	let stats = $state(DEFAULT_ADMIN_STATS)
	let loading = $state(true)
	let error = $state('')
	let authed = $derived(!!data.user)

	// Calendar auth tab state
	let calendarInvites = $state([])
	let calendarUsers = $state([])
	let calendarLoading = $state(false)
	let calendarError = $state('')
	let inviteEmail = $state('')
	let inviteUses = $state(DEFAULT_INVITE_DRAFT.uses)
	let inviteExpires = $state(DEFAULT_INVITE_DRAFT.expiresInDays)
	let creatingInvite = $state(false)

	async function loadStatus() {
		try {
			const dashboardStatus = await loadDashboardStatus()
			connected = dashboardStatus.connected
			connectionExpired = dashboardStatus.connectionExpired
			if (dashboardStatus.rules) {
				hours = { from: dashboardStatus.rules.hoursFrom, to: dashboardStatus.rules.hoursTo }
				buffer = dashboardStatus.rules.buffer
				notice = dashboardStatus.rules.notice
				capacity = dashboardStatus.rules.capacity
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			console.error('Failed to load status:', err)
		}
	}

	async function loadBookings() {
		loading = true
		error = ''
		try {
			const dashboardBookings = await loadDashboardBookings()
			bookings = dashboardBookings.bookings
			stats = dashboardBookings.stats || DEFAULT_ADMIN_STATS
			error = dashboardBookings.error
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err instanceof Error ? err.message : 'Failed to load bookings'
		} finally {
			loading = false
		}
	}

	async function save() {
		saving = true
		try {
			const saveResult = await saveDashboardRules({ hours: { ...hours }, buffer, notice, capacity })
			if (saveResult.ok) {
				saved = true
				setTimeout(() => saved = false, 2200)
			} else {
				error = saveResult.error
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err instanceof Error ? err.message : 'Failed to save rules'
		} finally {
			saving = false
		}
	}

	async function cancelBooking(bookingId) {
		if (!confirm('Are you sure you want to cancel this booking?')) return
		canceling = true
		try {
			const cancellationResult = await cancelDashboardBooking(bookingId)
			if (cancellationResult.ok) {
				viewBooking = null
				await loadBookings()
			} else {
				error = cancellationResult.error
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err instanceof Error ? err.message : 'Failed to cancel booking'
		} finally {
			canceling = false
		}
	}

	async function reconnect() {
		try {
			const reconnectResult = await getCalendarReconnectUrl()
			if (reconnectResult.ok) {
				window.location.href = reconnectResult.authUrl
			} else {
				error = reconnectResult.error
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err instanceof Error ? err.message : 'Failed to connect to Google'
		}
	}

	async function loadCalendarData() {
		calendarLoading = true
		calendarError = ''
		try {
			const membersData = await loadMembersData()
			calendarInvites = membersData.invites
			calendarUsers = membersData.users
			calendarError = membersData.error
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err instanceof Error ? err.message : 'Failed to load members data'
		} finally {
			calendarLoading = false
		}
	}

	async function createInvite() {
		creatingInvite = true
		calendarError = ''
		try {
			const inviteResult = await createMemberInvite({
				email: inviteEmail || null,
				uses: inviteUses,
				expiresInDays: inviteExpires
			})
			if (inviteResult.ok) {
				inviteEmail = ''
				inviteUses = DEFAULT_INVITE_DRAFT.uses
				inviteExpires = DEFAULT_INVITE_DRAFT.expiresInDays
				await loadCalendarData()
			} else {
				calendarError = inviteResult.error
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err instanceof Error ? err.message : 'Failed to create invite'
		} finally {
			creatingInvite = false
		}
	}

	async function deleteInvite(id) {
		if (!confirm('Delete this invite?')) return
		try {
			const inviteDeletion = await deleteMemberInvite(id)
			if (inviteDeletion.ok) {
				await loadCalendarData()
			} else {
				calendarError = inviteDeletion.error
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err instanceof Error ? err.message : 'Failed to delete invite'
		}
	}

	function copyInviteLink(code) {
		const url = createInviteShareLink(window.location.origin, code)
		navigator.clipboard.writeText(url)
	}

	$effect(() => {
		if (authed) {
			loadStatus()
			loadBookings()
		}
	})

	$effect(() => {
		if (tab === 'calendar-auth') {
			loadCalendarData()
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
						<div class="admin-page__stat-value">{stats.upcoming}</div>
						<div class="admin-page__stat-label">Upcoming bookings</div>
					</div>
					<div class="admin-page__stat-card">
						<div class="admin-page__stat-value">{stats.seats}</div>
						<div class="admin-page__stat-label">Seats reserved</div>
					</div>
					<div class="admin-page__stat-card">
						<div class="admin-page__stat-value" class:admin-page__stat-value--synced={connected && !connectionExpired}>
							{#if connected && !connectionExpired}Synced{:else if connected && connectionExpired}Expired{:else}Offline{/if}
						</div>
						<div class="admin-page__stat-label">Google Calendar</div>
					</div>
				</div>

				<!-- Calendar connection -->
				<div class="admin-page__section">
					<div class="admin-page__section-head">
						<h3 class="admin-page__section-title">Google Calendar</h3>
						<span class="admin-page__status-badge" class:admin-page__status-badge--connected={connected && !connectionExpired}>
							{#if connected && !connectionExpired}
								<Check size={14} strokeWidth={2.5} />
								Connected
							{:else if connected && connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="admin-page__section-description">Availability and bookings stay in sync with your Google Calendar — automatically.</p>
					<div class="admin-page__button-row">
						<button class="admin-page__button-secondary" onclick={reconnect}>
							<RefreshCw size={14} />
							{connected ? 'Reconnect' : 'Connect'}
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
									<input class="admin-page__input" type="time" bind:value={hours.from} aria-label="Opening time" />
									<span class="admin-page__time-separator">to</span>
									<input class="admin-page__input" type="time" bind:value={hours.to} aria-label="Closing time" />
								</div>
							</div>
						</div>
						<div class="admin-page__fields-row">
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Buffer between slots
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="0" bind:value={buffer} />
										<span class="admin-page__input-suffix">min</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Minimum notice
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={notice} />
										<span class="admin-page__input-suffix">hrs</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Capacity per slot
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={capacity} />
										<span class="admin-page__input-suffix">people</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={save} disabled={saving}>
						{#if saving}
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
						<span class="admin-page__section-count">{bookings.length} total</span>
					</div>
					{#if loading}
						<p class="admin-page__section-description">Loading bookings...</p>
					{:else if error}
						<p class="admin-page__section-description admin-page__section-description--error">{error}</p>
						<button class="admin-page__button-secondary" onclick={loadBookings}>Retry</button>
					{:else if bookings.length === 0}
						<p class="admin-page__section-description">No upcoming bookings yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each bookings as b, i}
								<button
									class="admin-page__booking-row"
									class:admin-page__booking-row--hovered={hover === b.id}
									onmouseenter={() => hover = b.id}
									onmouseleave={() => hover = null}
									onclick={() => viewBooking = b}
								>
									<span class="admin-page__booking-date">{b.date} · {b.time}</span>
									<span class="admin-page__booking-meta">{b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.name}</span>
									<span class="admin-page__status-badge" class:admin-page__status-badge--confirmed={b.status === 'confirmed'} class:admin-page__status-badge--pending={b.status === 'pending'}>
										{b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
									</span>
									<ChevronRight class="admin-page__booking-arrow" size={14} />
								</button>
								{#if i < bookings.length - 1}
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
						<span class="admin-page__status-badge" class:admin-page__status-badge--connected={connected && !connectionExpired}>
							{#if connected && !connectionExpired}
								<Check size={14} strokeWidth={2.5} />
								Connected
							{:else if connected && connectionExpired}
								Token expired
							{:else}
								Not connected
							{/if}
						</span>
					</div>
					<p class="admin-page__section-description">Your bookings automatically appear on your calendar. Blocked times on your calendar automatically remove availability from clients.</p>
					<div class="admin-page__button-row">
						<button class="admin-page__button-secondary" onclick={reconnect}>
							<RefreshCw size={14} />
							Reconnect
						</button>
					</div>
				</div>
			{/if}

			{#if tab === 'calendar-auth'}
				<h1 class="admin-page__title">Members</h1>
				<p class="admin-page__subtitle">Manage invite codes and users.</p>

				{#if calendarError}
					<div class="admin-page__section admin-page__section--error">
						<p class="admin-page__calendar-error">{calendarError}</p>
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
									<input class="admin-page__input" type="email" bind:value={inviteEmail} placeholder="user@example.com" />
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Uses
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={inviteUses} />
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Expires in
									<div class="admin-page__input-wrap">
										<input class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={inviteExpires} />
										<span class="admin-page__input-suffix">days</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={createInvite} disabled={creatingInvite}>
						{#if creatingInvite}
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
						<span class="admin-page__section-count">{calendarInvites.length} total</span>
					</div>
					{#if calendarLoading}
						<p class="admin-page__section-description">Loading invites...</p>
					{:else if calendarInvites.length === 0}
						<p class="admin-page__section-description">No invites created yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each calendarInvites as invite, i}
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
										<button class="admin-page__button-secondary admin-page__button-secondary--compact" onclick={() => copyInviteLink(invite.code)}>
											Copy Link
										</button>
										<button class="admin-page__button-secondary admin-page__button-secondary--danger admin-page__button-secondary--compact" onclick={() => deleteInvite(invite.id)}>
											Delete
										</button>
									</div>
								</div>
								{#if i < calendarInvites.length - 1}
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
						<span class="admin-page__section-count">{calendarUsers.length} total</span>
					</div>
					{#if calendarLoading}
						<p class="admin-page__section-description">Loading users...</p>
					{:else if calendarUsers.length === 0}
						<p class="admin-page__section-description">No users have signed up yet.</p>
					{:else}
						<div class="admin-page__bookings-list">
							{#each calendarUsers as user, i}
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
								{#if i < calendarUsers.length - 1}
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
	{#if viewBooking}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="admin-page__modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={() => viewBooking = null} onkeydown={(e) => e.key === 'Escape' && (viewBooking = null)}>
			<div class="admin-page__modal-card" role="document" onkeydown={() => {}} onclick={(e) => e.stopPropagation()}>
				<h3 class="admin-page__modal-title">Booking details</h3>
				<p class="admin-page__modal-subtitle">Here's what we have on file.</p>
				<div class="admin-page__modal-rows">
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Date</span>
						<span class="admin-page__modal-value">{viewBooking.date}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Time</span>
						<span class="admin-page__modal-value">{viewBooking.time}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Guest</span>
						<span class="admin-page__modal-value">{viewBooking.name}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Email</span>
						<span class="admin-page__modal-value">{viewBooking.email}</span>
					</div>
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Seats</span>
						<span class="admin-page__modal-value">{viewBooking.seats}</span>
					</div>
					{#if viewBooking.note}
						<div class="admin-page__modal-row">
							<span class="admin-page__modal-label">Note</span>
							<span class="admin-page__modal-value">{viewBooking.note}</span>
						</div>
					{/if}
					<div class="admin-page__modal-row">
						<span class="admin-page__modal-label">Status</span>
						<span class="admin-page__modal-value">{viewBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
					</div>
				</div>
				<div class="admin-page__modal-actions">
					<button class="admin-page__button-primary" onclick={() => viewBooking = null}>Done</button>
					<button class="admin-page__button-secondary admin-page__button-secondary--danger" onclick={() => cancelBooking(viewBooking.id)} disabled={canceling}>
						{#if canceling}
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
{#if saved}
		<div class="admin-page__toast">
			<Check size={14} strokeWidth={2.5} />
			Rules saved successfully.
		</div>
	{/if}
{/if}
