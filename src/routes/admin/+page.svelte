<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Check, RefreshCw, Save, ChevronRight, Loader, Users, LogOut } from '@lucide/svelte'
	import { cancelAdminBooking, getAdminBookings, getAdminStatus, saveAdminRules } from '$lib/client/api/adminClient'
	import { createCalendarInvite, deleteCalendarInvite, getCalendarAdminInvites, getCalendarAdminUsers, startCalendarOAuth } from '$lib/client/api/calendarClient'
	import { handleUnauthorizedSessionError } from '$lib/client/routing/auth'

	let { data, form } = $props()

	let tab = $state('dash')
	let hours = $state({ from: '06:00', to: '22:00' })
	let buffer = $state(15)
	let notice = $state(24)
	let capacity = $state(4)
	let saved = $state(false)
	let saving = $state(false)
	let canceling = $state(false)
	let viewBooking = $state(null)
	let hover = $state(null)
	let connected = $state(false)
	let connectionExpired = $state(false)
	let bookings = $state([])
	let stats = $state({ upcoming: 0, seats: 0 })
	let loading = $state(true)
	let error = $state('')
	let authed = $derived(!!data.user)

	// Calendar auth tab state
	let calendarInvites = $state([])
	let calendarUsers = $state([])
	let calendarLoading = $state(false)
	let calendarError = $state('')
	let inviteEmail = $state('')
	let inviteUses = $state(1)
	let inviteExpires = $state(7)
	let creatingInvite = $state(false)

	const NAV = [
		{ label: 'Dashboard', id: 'dash' },
		{ label: 'Settings', id: 'cal' },
		{ label: 'Members', id: 'calendar-auth' }
	]

	async function loadStatus() {
		try {
			const data = await getAdminStatus()
			if (data.ok) {
				connected = data.google?.connected ?? false
				connectionExpired = data.google?.expired ?? false
				if (data.rules) {
					hours = { from: data.rules.hoursFrom, to: data.rules.hoursTo }
					buffer = data.rules.buffer
					notice = data.rules.notice
					capacity = data.rules.capacity
				}
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
			const data = await getAdminBookings()
			if (data.ok) {
				bookings = data.bookings || []
				stats = data.stats || { upcoming: 0, seats: 0 }
			} else {
				error = data.error?.message || 'Failed to load bookings'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err.message || 'Failed to load bookings'
		} finally {
			loading = false
		}
	}

	async function save() {
		saving = true
		try {
			const data = await saveAdminRules({
				hoursFrom: hours.from,
				hoursTo: hours.to,
				buffer,
				notice,
				capacity
			})
			if (data.ok) {
				saved = true
				setTimeout(() => saved = false, 2200)
			} else {
				error = data.error?.message || 'Failed to save rules'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err.message || 'Failed to save rules'
		} finally {
			saving = false
		}
	}

	async function cancelBooking(bookingId) {
		if (!confirm('Are you sure you want to cancel this booking?')) return
		canceling = true
		try {
			const data = await cancelAdminBooking(bookingId)
			if (data.ok) {
				viewBooking = null
				await loadBookings()
			} else {
				error = data.error?.message || 'Failed to cancel booking'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err.message || 'Failed to cancel booking'
		} finally {
			canceling = false
		}
	}

	async function reconnect() {
		try {
			const data = await startCalendarOAuth()
			if (data.authUrl) {
				window.location.href = data.authUrl
			} else {
				console.error('Failed to start OAuth:', data.error)
				error = data.error?.message || 'Failed to connect to Google'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			error = err.message || 'Failed to connect to Google'
		}
	}

	async function loadCalendarData() {
		calendarLoading = true
		calendarError = ''
		try {
			const [invitesData, usersData] = await Promise.all([
				getCalendarAdminInvites(),
				getCalendarAdminUsers()
			])

			if (invitesData.ok) calendarInvites = invitesData.invites || []
			else calendarError = invitesData.error?.message || 'Failed to load invites'

			if (usersData.ok) calendarUsers = usersData.users || []
			else calendarError = usersData.error?.message || 'Failed to load users'
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err.message || 'Failed to load members data'
		} finally {
			calendarLoading = false
		}
	}

	async function createInvite() {
		creatingInvite = true
		calendarError = ''
		try {
			const data = await createCalendarInvite({
				email: inviteEmail || null,
				uses: inviteUses,
				expiresInDays: inviteExpires
			})
			if (data.ok) {
				inviteEmail = ''
				inviteUses = 1
				inviteExpires = 7
				await loadCalendarData()
			} else {
				calendarError = data.error?.message || 'Failed to create invite'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err.message || 'Failed to create invite'
		} finally {
			creatingInvite = false
		}
	}

	async function deleteInvite(id) {
		if (!confirm('Delete this invite?')) return
		try {
			const data = await deleteCalendarInvite(id)
			if (data.ok) {
				await loadCalendarData()
			} else {
				calendarError = data.error?.message || 'Failed to delete invite'
			}
		} catch (err) {
			if (handleUnauthorizedSessionError(err)) return
			calendarError = err.message || 'Failed to delete invite'
		}
	}

	function copyInviteLink(code) {
		const url = `${window.location.origin}/calendar/login?invite=${code}`
		navigator.clipboard.writeText(url)
	}

	function formatDate(timestamp) {
		if (!timestamp) return 'Never'
		return new Date(timestamp * 1000).toLocaleDateString()
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
					<input type="password" name="password" placeholder="Passcode" />
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
			{#each NAV as n}
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
				<button class="admin-page__sidebar-item admin-page__side-item--logout" type="submit"><LogOut size={16} strokeWidth={1.8} /> Logout</button>
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
									<input type="time" bind:value={hours.from} aria-label="Opening time" />
									<span class="admin-page__time-separator">to</span>
									<input type="time" bind:value={hours.to} aria-label="Closing time" />
								</div>
							</div>
						</div>
						<div class="admin-page__fields-row">
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Buffer between slots
									<div class="admin-page__input-wrap">
										<input type="number" min="0" bind:value={buffer} />
										<span class="admin-page__input-suffix">min</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Minimum notice
									<div class="admin-page__input-wrap">
										<input type="number" min="1" bind:value={notice} />
										<span class="admin-page__input-suffix">hrs</span>
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Capacity per slot
									<div class="admin-page__input-wrap">
										<input type="number" min="1" bind:value={capacity} />
										<span class="admin-page__input-suffix">people</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={save} disabled={saving}>
						{#if saving}
							<Loader size={12} class="spin" />
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
						<p class="admin-page__section-description" style="color: var(--form-error)">{error}</p>
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
					<div class="admin-page__section" style="background: color-mix(in srgb, var(--form-error) 12%, transparent); border-color: color-mix(in srgb, var(--form-error) 30%, transparent);">
						<p style="color: var(--status-error-text); margin: 0;">{calendarError}</p>
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
									<input type="email" bind:value={inviteEmail} placeholder="user@example.com" />
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Uses
									<div class="admin-page__input-wrap">
										<input type="number" min="1" bind:value={inviteUses} />
									</div>
								</label>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label">
									Expires in
									<div class="admin-page__input-wrap">
										<input type="number" min="1" bind:value={inviteExpires} />
										<span class="admin-page__input-suffix">days</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="admin-page__button-secondary" onclick={createInvite} disabled={creatingInvite}>
						{#if creatingInvite}
							<Loader size={12} class="spin" />
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
								<div class="admin-page__booking-row" style="cursor: default;">
									<span class="admin-page__booking-date">
										<code style="background: var(--card-bg); padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.85em;">{invite.code}</code>
									</span>
									<span class="admin-page__booking-meta">
										{invite.uses_remaining ?? '∞'} uses left
										{#if invite.email}· {invite.email}{/if}
										{#if invite.expires_at}· expires {formatDate(invite.expires_at)}{/if}
									</span>
									<div class="admin-page__button-row" style="gap: 0.5rem;">
										<button class="admin-page__button-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick={() => copyInviteLink(invite.code)}>
											Copy Link
										</button>
										<button class="admin-page__button-secondary admin-page__button-secondary--danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick={() => deleteInvite(invite.id)}>
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
								<div class="admin-page__booking-row" style="cursor: default;">
									<span class="admin-page__booking-date" style="display: flex; align-items: center; gap: 0.5rem;">
										{#if user.avatar_url}
											<img src={user.avatar_url} alt="" style="width: 24px; height: 24px; border-radius: 50%;" />
										{/if}
										{user.name || user.email}
									</span>
									<span class="admin-page__booking-meta">
										{user.provider || 'member'} · last login {formatDate(user.last_login_at)}
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
							<Loader size={12} class="spin" />
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

<style>
	.admin-page__login {
		min-height: 70vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
	}
	.admin-page__login-card {
		width: min(420px, 100%);
		background: color-mix(in srgb, var(--color-black) 94%, var(--bg) 6%);
		border: 1px solid var(--color-white-08);
		border-radius: 16px;
		padding: 2rem;
		box-shadow: 0 20px 50px var(--overlay-black-35);
	}
	.admin-page__login-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--color-white) 97%, var(--bg) 3%);
		margin-bottom: 0.35rem;
	}
	.admin-page__login-sub {
		color: color-mix(in srgb, var(--color-white) 70%, transparent);
		margin-bottom: 1.5rem;
	}
	.admin-page__login-field input {
		width: 100%;
		background: color-mix(in srgb, var(--color-black) 92%, var(--bg) 8%);
		border: 1px solid var(--color-white-12);
		border-radius: 10px;
		padding: 0.75rem 0.85rem;
		color: color-mix(in srgb, var(--color-white) 97%, var(--bg) 3%);
		outline: none;
	}
	.admin-page__login-error {
		margin: 0.75rem 0 1rem;
		color: color-mix(in srgb, var(--form-error) 72%, var(--color-white) 28%);
	}
	.admin-page__side-item--logout {
		margin-top: auto;
		color: var(--color-white-60);
	}
</style>
