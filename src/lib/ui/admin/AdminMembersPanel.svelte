<script>
	import { Loader } from '@lucide/svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
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
		<h3 class="admin-page__section-title">Create invite</h3>
	</div>
	<p class="admin-page__section-description">Generate invite codes for new members.</p>
	<div class="admin-page__fields-grid">
		<div class="admin-page__fields-row admin-page__fields-row--invite">
			<div class="admin-page__field admin-page__field--email">
				<label class="admin-page__field-label" for="invite-email">
					Email <span class="admin-page__field-label-muted">(optional)</span>
				</label>
				<input id="invite-email" class="admin-page__input" type="email" bind:value={members.inviteEmail} placeholder="user@example.com" />
			</div>
			<div class="admin-page__field admin-page__field--uses">
				<label class="admin-page__field-label" for="invite-uses">Uses</label>
				<div class="admin-page__input-wrap">
					<input id="invite-uses" class="admin-page__input admin-page__input--number" type="number" min="1" bind:value={members.inviteUses} />
				</div>
			</div>
			<div class="admin-page__field admin-page__field--expires">
				<label class="admin-page__field-label" for="invite-expires">Expires in</label>
				<div class="admin-page__input-wrap">
					<input id="invite-expires" class="admin-page__input admin-page__input--number admin-page__input--days" type="number" min="1" bind:value={members.inviteExpires} />
					<span class="admin-page__input-suffix">days</span>
				</div>
			</div>
		</div>
	</div>
	<PillButton className="admin-page__button-secondary" variant="secondary" onClick={members.createInvite} disabled={members.creating}>
		{#if members.creating}
			<Loader size={12} class="admin-page__spin" />
			Creating...
		{:else}
			Create Invite
		{/if}
	</PillButton>
</div>

<div class="admin-page__divider" aria-hidden="true"></div>

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
		<div class="admin-page__members-list">
			{#each members.invites as invite, i}
				<div class="admin-page__members-row">
					<div class="admin-page__members-main">
						<div class="admin-page__members-code-row">
							<code class="admin-page__invite-code">{invite.code}</code>
						</div>
						<div class="admin-page__members-meta">
							{invite.uses_remaining ?? '∞'} use{invite.uses_remaining === 1 ? '' : 's'} left
							{#if invite.email} · {invite.email}{/if}
							{#if invite.expires_at} · expires {formatDate(invite.expires_at)}{/if}
						</div>
					</div>
					<div class="admin-page__members-actions">
						<PillButton className="admin-page__button-secondary admin-page__button-secondary--compact" variant="secondary" size="sm" onClick={() => members.copyInvite(invite.code)}>
							Copy Link
						</PillButton>
						<PillButton className="admin-page__button-secondary admin-page__button-secondary--danger admin-page__button-secondary--compact" variant="danger" size="sm" onClick={() => members.deleteInvite(invite.id)}>
							Delete
						</PillButton>
					</div>
				</div>
				{#if i < members.invites.length - 1}<div class="admin-page__booking-divider"></div>{/if}
			{/each}
		</div>
	{/if}
</div>

<div class="admin-page__divider" aria-hidden="true"></div>

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
		<div class="admin-page__members-list">
			{#each members.users as user, i}
				<div class="admin-page__members-row">
					<div class="admin-page__members-user">
						{#if user.avatar_url}
							<img src={user.avatar_url} alt="" class="admin-page__members-avatar" />
						{/if}
						<span class="admin-page__members-user-name">{user.name || user.email}</span>
					</div>
					<div class="admin-page__members-meta">
						{user.provider || 'member'} · last login {formatDate(user.last_login_at)}
					</div>
				</div>
				{#if i < members.users.length - 1}<div class="admin-page__booking-divider"></div>{/if}
			{/each}
		</div>
	{/if}
</div>
