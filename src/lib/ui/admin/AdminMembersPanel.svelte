<script>
	import { Loader } from '@lucide/svelte'
	const { members, formatDate } = $props()
</script>

<h1 class="admin-page__title">Members</h1>
<p class="admin-page__subtitle">Manage invite codes and users.</p>

{#if members.error}
	<div class="admin-page__section admin-page__section--error">
		<p class="admin-page__calendar-error">{members.error}</p>
	</div>
{/if}

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
						{#if invite.expires_at}· expires {formatDate(invite.expires_at)}{/if}
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
						{user.provider || 'member'} · last login {formatDate(user.last_login_at)}
					</span>
				</div>
				{#if i < members.users.length - 1}
					<div class="admin-page__booking-divider"></div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
