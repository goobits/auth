<script>
	import { enhance } from '$app/forms'
	import { Clock, Calendar, Check, RefreshCw, Save, ChevronRight, Loader, Users, LogOut } from '@lucide/svelte'

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
			const res = await fetch('/api/admin/status')
			if (res.status === 401) {
				window.location.reload()
				return
			}
			const data = await res.json()
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
			console.error('Failed to load status:', err)
		}
	}

	async function loadBookings() {
		loading = true
		error = ''
		try {
			const res = await fetch('/api/admin/bookings')
			if (res.status === 401) {
				window.location.reload()
				return
			}
			const data = await res.json()
			if (data.ok) {
				bookings = data.bookings || []
				stats = data.stats || { upcoming: 0, seats: 0 }
			} else {
				error = data.error?.message || 'Failed to load bookings'
			}
		} catch (err) {
			error = err.message || 'Failed to load bookings'
		} finally {
			loading = false
		}
	}

	async function save() {
		saving = true
		try {
			const res = await fetch('/api/admin/rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hoursFrom: hours.from,
					hoursTo: hours.to,
					buffer,
					notice,
					capacity
				})
			})
			if (res.status === 401) {
				window.location.reload()
				return
			}
			const data = await res.json()
			if (data.ok) {
				saved = true
				setTimeout(() => saved = false, 2200)
			} else {
				error = data.error?.message || 'Failed to save rules'
			}
		} catch (err) {
			error = err.message || 'Failed to save rules'
		} finally {
			saving = false
		}
	}

	async function cancelBooking(bookingId) {
		if (!confirm('Are you sure you want to cancel this booking?')) return
		canceling = true
		try {
			const res = await fetch('/api/admin/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookingId })
			})
			if (res.status === 401) {
				window.location.reload()
				return
			}
			const data = await res.json()
			if (data.ok) {
				viewBooking = null
				await loadBookings()
			} else {
				error = data.error?.message || 'Failed to cancel booking'
			}
		} catch (err) {
			error = err.message || 'Failed to cancel booking'
		} finally {
			canceling = false
		}
	}

	async function reconnect() {
		const res = await fetch('/api/calendar/oauth-start')
		if (res.status === 401) {
			window.location.reload()
			return
		}
		const data = await res.json()
		if (data.authUrl) {
			window.location.href = data.authUrl
		} else {
			console.error('Failed to start OAuth:', data.error)
			error = data.error?.message || 'Failed to connect to Google'
		}
	}

	async function loadCalendarData() {
		calendarLoading = true
		calendarError = ''
		try {
			const [invitesRes, usersRes] = await Promise.all([
				fetch('/api/calendar/admin/invites'),
				fetch('/api/calendar/admin/users')
			])
			const invitesData = await invitesRes.json()
			const usersData = await usersRes.json()

			if (invitesData.ok) calendarInvites = invitesData.invites || []
			else calendarError = invitesData.error?.message || 'Failed to load invites'

			if (usersData.ok) calendarUsers = usersData.users || []
			else calendarError = usersData.error?.message || 'Failed to load users'
		} catch (err) {
			calendarError = err.message || 'Failed to load members data'
		} finally {
			calendarLoading = false
		}
	}

	async function createInvite() {
		creatingInvite = true
		calendarError = ''
		try {
			const res = await fetch('/api/calendar/admin/invites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: inviteEmail || null,
					uses: inviteUses,
					expiresInDays: inviteExpires
				})
			})
			const data = await res.json()
			if (data.ok) {
				inviteEmail = ''
				inviteUses = 1
				inviteExpires = 7
				await loadCalendarData()
			} else {
				calendarError = data.error?.message || 'Failed to create invite'
			}
		} catch (err) {
			calendarError = err.message || 'Failed to create invite'
		} finally {
			creatingInvite = false
		}
	}

	async function deleteInvite(id) {
		if (!confirm('Delete this invite?')) return
		try {
			const res = await fetch(`/api/calendar/admin/invites?id=${id}`, {
				method: 'DELETE'
			})
			const data = await res.json()
			if (data.ok) {
				await loadCalendarData()
			} else {
				calendarError = data.error?.message || 'Failed to delete invite'
			}
		} catch (err) {
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
	<div class="admin-login">
		<div class="login-card">
			<div class="login-title">Admin access</div>
			<div class="login-sub">Enter the admin passcode to continue.</div>
			<form method="POST" action="?/login" use:enhance>
				<input type="hidden" name="email" value="admin@miko.art" />
				<div class="login-field">
					<input type="password" name="password" placeholder="Passcode" />
				</div>
				{#if form?.error}
					<div class="login-error">{form.error}</div>
				{/if}
				<button class="btn-sec" type="submit">Unlock</button>
			</form>
		</div>
	</div>
{:else}
<div class="admin-shell">
		<!-- Sidebar -->
		<aside class="sidebar">
			<div class="side-title">Manage</div>
			{#each NAV as n}
				<button
					class="side-item"
					class:active={tab === n.id}
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
				<button class="side-item logout" type="submit"><LogOut size={16} strokeWidth={1.8} /> Logout</button>
			</form>
		</aside>

		<!-- Content -->
		<main class="admin-main">
			{#if tab === 'dash'}
				<h1 class="page-title">Dashboard</h1>
				<p class="page-sub">Everything about your gym, at a glance.</p>

				<!-- Stats row -->
				<div class="stats-row">
					<div class="stat-card">
						<div class="stat-val">{stats.upcoming}</div>
						<div class="stat-label">Upcoming bookings</div>
					</div>
					<div class="stat-card">
						<div class="stat-val">{stats.seats}</div>
						<div class="stat-label">Seats reserved</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" class:synced={connected && !connectionExpired}>
							{#if connected && !connectionExpired}Synced{:else if connected && connectionExpired}Expired{:else}Offline{/if}
						</div>
						<div class="stat-label">Google Calendar</div>
					</div>
				</div>

				<!-- Calendar connection -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Google Calendar</h3>
						<span class="badge" class:connected={connected && !connectionExpired}>
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
					<p class="section-desc">Availability and bookings stay in sync with your Google Calendar — automatically.</p>
					<div class="btn-row">
						<button class="btn-sec" onclick={reconnect}>
							<RefreshCw size={14} />
							{connected ? 'Reconnect' : 'Connect'}
						</button>
					</div>
				</div>

				<!-- Availability -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Availability rules</h3>
					</div>
					<p class="section-desc">Define when friends can book, and how much runway you need between sessions.</p>
					<div class="fields-grid">
						<div class="fields-row">
							<div class="field">
								<span class="field-label">Operating hours</span>
								<div class="time-row">
									<input type="time" bind:value={hours.from} aria-label="Opening time" />
									<span class="time-sep">to</span>
									<input type="time" bind:value={hours.to} aria-label="Closing time" />
								</div>
							</div>
						</div>
						<div class="fields-row">
							<div class="field">
								<label class="field-label">
									Buffer between slots
									<div class="input-wrap">
										<input type="number" min="0" bind:value={buffer} />
										<span class="input-suffix">min</span>
									</div>
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Minimum notice
									<div class="input-wrap">
										<input type="number" min="1" bind:value={notice} />
										<span class="input-suffix">hrs</span>
									</div>
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Capacity per slot
									<div class="input-wrap">
										<input type="number" min="1" bind:value={capacity} />
										<span class="input-suffix">people</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="btn-sec" onclick={save} disabled={saving}>
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
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Recent bookings</h3>
						<span class="section-count">{bookings.length} total</span>
					</div>
					{#if loading}
						<p class="section-desc">Loading bookings...</p>
					{:else if error}
						<p class="section-desc" style="color: var(--form-error)">{error}</p>
						<button class="btn-sec" onclick={loadBookings}>Retry</button>
					{:else if bookings.length === 0}
						<p class="section-desc">No upcoming bookings yet.</p>
					{:else}
						<div class="bookings-list">
							{#each bookings as b, i}
								<button
									class="booking-row"
									class:hovered={hover === b.id}
									onmouseenter={() => hover = b.id}
									onmouseleave={() => hover = null}
									onclick={() => viewBooking = b}
								>
									<span class="booking-date">{b.date} · {b.time}</span>
									<span class="booking-meta">{b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.name}</span>
									<span class="badge" class:confirmed={b.status === 'confirmed'} class:pending={b.status === 'pending'}>
										{b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
									</span>
									<ChevronRight class="booking-arrow" size={14} />
								</button>
								{#if i < bookings.length - 1}
									<div class="booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if tab === 'cal'}
				<h1 class="page-title">Calendar</h1>
				<p class="page-sub">Manage your Google Calendar connection and sync preferences.</p>
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Google Calendar</h3>
						<span class="badge" class:connected={connected && !connectionExpired}>
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
					<p class="section-desc">Your bookings automatically appear on your calendar. Blocked times on your calendar automatically remove availability from clients.</p>
					<div class="btn-row">
						<button class="btn-sec" onclick={reconnect}>
							<RefreshCw size={14} />
							Reconnect
						</button>
					</div>
				</div>
			{/if}

			{#if tab === 'calendar-auth'}
				<h1 class="page-title">Members</h1>
				<p class="page-sub">Manage invite codes and users.</p>

				{#if calendarError}
					<div class="admin-section" style="background: #fee2e2; border-color: #fecaca;">
						<p style="color: #dc2626; margin: 0;">{calendarError}</p>
					</div>
				{/if}

				<!-- Create Invite -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Create Invite</h3>
					</div>
					<p class="section-desc">Generate invite codes for new members.</p>
					<div class="fields-grid">
						<div class="fields-row">
							<div class="field">
								<label class="field-label">
									Email (optional)
									<input type="email" bind:value={inviteEmail} placeholder="user@example.com" />
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Uses
									<div class="input-wrap">
										<input type="number" min="1" bind:value={inviteUses} />
									</div>
								</label>
							</div>
							<div class="field">
								<label class="field-label">
									Expires in
									<div class="input-wrap">
										<input type="number" min="1" bind:value={inviteExpires} />
										<span class="input-suffix">days</span>
									</div>
								</label>
							</div>
						</div>
					</div>
					<button class="btn-sec" onclick={createInvite} disabled={creatingInvite}>
						{#if creatingInvite}
							<Loader size={12} class="spin" />
							Creating...
						{:else}
							Create Invite
						{/if}
					</button>
				</div>

				<!-- Invites List -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Invites</h3>
						<span class="section-count">{calendarInvites.length} total</span>
					</div>
					{#if calendarLoading}
						<p class="section-desc">Loading invites...</p>
					{:else if calendarInvites.length === 0}
						<p class="section-desc">No invites created yet.</p>
					{:else}
						<div class="bookings-list">
							{#each calendarInvites as invite, i}
								<div class="booking-row" style="cursor: default;">
									<span class="booking-date">
										<code style="background: var(--bg-muted); padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.85em;">{invite.code}</code>
									</span>
									<span class="booking-meta">
										{invite.uses_remaining ?? '∞'} uses left
										{#if invite.email}· {invite.email}{/if}
										{#if invite.expires_at}· expires {formatDate(invite.expires_at)}{/if}
									</span>
									<div class="btn-row" style="gap: 0.5rem;">
										<button class="btn-sec" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick={() => copyInviteLink(invite.code)}>
											Copy Link
										</button>
										<button class="btn-sec danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick={() => deleteInvite(invite.id)}>
											Delete
										</button>
									</div>
								</div>
								{#if i < calendarInvites.length - 1}
									<div class="booking-divider"></div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<!-- Users List -->
				<div class="admin-section">
					<div class="section-head">
						<h3 class="section-title">Users</h3>
						<span class="section-count">{calendarUsers.length} total</span>
					</div>
					{#if calendarLoading}
						<p class="section-desc">Loading users...</p>
					{:else if calendarUsers.length === 0}
						<p class="section-desc">No users have signed up yet.</p>
					{:else}
						<div class="bookings-list">
							{#each calendarUsers as user, i}
								<div class="booking-row" style="cursor: default;">
									<span class="booking-date" style="display: flex; align-items: center; gap: 0.5rem;">
										{#if user.avatar_url}
											<img src={user.avatar_url} alt="" style="width: 24px; height: 24px; border-radius: 50%;" />
										{/if}
										{user.name || user.email}
									</span>
									<span class="booking-meta">
										{user.provider || 'member'} · last login {formatDate(user.last_login_at)}
									</span>
								</div>
								{#if i < calendarUsers.length - 1}
									<div class="booking-divider"></div>
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
		<div class="modal-overlay" role="dialog" aria-modal="true" tabindex="-1" onclick={() => viewBooking = null} onkeydown={(e) => e.key === 'Escape' && (viewBooking = null)}>
			<div class="modal-card" role="document" onkeydown={() => {}} onclick={(e) => e.stopPropagation()}>
				<h3 class="modal-title">Booking details</h3>
				<p class="modal-sub">Here's what we have on file.</p>
				<div class="modal-rows">
					<div class="modal-row">
						<span class="modal-label">Date</span>
						<span class="modal-val">{viewBooking.date}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Time</span>
						<span class="modal-val">{viewBooking.time}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Guest</span>
						<span class="modal-val">{viewBooking.name}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Email</span>
						<span class="modal-val">{viewBooking.email}</span>
					</div>
					<div class="modal-row">
						<span class="modal-label">Seats</span>
						<span class="modal-val">{viewBooking.seats}</span>
					</div>
					{#if viewBooking.note}
						<div class="modal-row">
							<span class="modal-label">Note</span>
							<span class="modal-val">{viewBooking.note}</span>
						</div>
					{/if}
					<div class="modal-row">
						<span class="modal-label">Status</span>
						<span class="modal-val">{viewBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
					</div>
				</div>
				<div class="modal-actions">
					<button class="btn-pri" onclick={() => viewBooking = null}>Done</button>
					<button class="btn-sec danger" onclick={() => cancelBooking(viewBooking.id)} disabled={canceling}>
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
		<div class="toast">
			<Check size={14} strokeWidth={2.5} />
			Rules saved successfully.
		</div>
	{/if}
{/if}

<style>
	.admin-login {
		min-height: 70vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3rem 1.5rem;
	}
	.login-card {
		width: min(420px, 100%);
		background: color-mix(in srgb, var(--color-black) 94%, var(--bg) 6%);
		border: 1px solid var(--color-white-08);
		border-radius: 16px;
		padding: 2rem;
		box-shadow: 0 20px 50px var(--overlay-black-35);
	}
	.login-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--color-white) 97%, var(--bg) 3%);
		margin-bottom: 0.35rem;
	}
	.login-sub {
		color: color-mix(in srgb, var(--color-white) 70%, transparent);
		margin-bottom: 1.5rem;
	}
	.login-field input {
		width: 100%;
		background: color-mix(in srgb, var(--color-black) 92%, var(--bg) 8%);
		border: 1px solid var(--color-white-12);
		border-radius: 10px;
		padding: 0.75rem 0.85rem;
		color: color-mix(in srgb, var(--color-white) 97%, var(--bg) 3%);
		outline: none;
	}
	.login-error {
		margin: 0.75rem 0 1rem;
		color: color-mix(in srgb, var(--form-error) 72%, var(--color-white) 28%);
	}
	.side-item.logout {
		margin-top: auto;
		color: var(--color-white-60);
	}
</style>
