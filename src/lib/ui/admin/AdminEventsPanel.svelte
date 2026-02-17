<script>
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	const { dashboard } = $props()
	let memoryDrafts = $state({})

	function formatDateTime(iso) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})
	}
</script>

<h1 class="admin-page__title">Events</h1>
<p class="admin-page__subtitle">Create recurring sessions, monitor attendance pressure, and override capacity.</p>

{#if dashboard.error}
	<div class="admin-page__section admin-page__section--error">
		<p class="admin-page__calendar-error">{dashboard.error}</p>
	</div>
{/if}

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Batch creator</h3>
	</div>
	<p class="admin-page__section-description">Create one event or a weekly series in a single action.</p>

	<div class="admin-page__fields-grid">
		<div class="admin-page__fields-row admin-page__fields-row--invite">
			<div class="admin-page__field admin-page__field--email">
				<label class="admin-page__field-label" for="event-draft-activity">Activity</label>
				<select
					id="event-draft-activity"
					class="admin-page__input"
					value={dashboard.eventDraft.activitySlug}
					onchange={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, activitySlug: event.currentTarget.value }}
				>
					{#each dashboard.enabledPrograms as activity}
						<option value={activity.slug}>{activity.label}</option>
					{/each}
				</select>
			</div>
			<div class="admin-page__field admin-page__field--email">
				<label class="admin-page__field-label" for="event-draft-title">Title</label>
				<input
					id="event-draft-title"
					class="admin-page__input"
					type="text"
					placeholder="Leg Day Crew"
					value={dashboard.eventDraft.title}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, title: event.currentTarget.value }}
				/>
			</div>
		</div>

		<div class="admin-page__fields-row admin-page__fields-row--invite">
			<div class="admin-page__field">
				<label class="admin-page__field-label" for="event-draft-starts">Starts</label>
				<input
					id="event-draft-starts"
					class="admin-page__input"
					type="datetime-local"
					value={dashboard.eventDraft.startsAt}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, startsAt: event.currentTarget.value }}
				/>
			</div>
			<div class="admin-page__field">
				<label class="admin-page__field-label" for="event-draft-ends">Ends</label>
				<input
					id="event-draft-ends"
					class="admin-page__input"
					type="datetime-local"
					value={dashboard.eventDraft.endsAt}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, endsAt: event.currentTarget.value }}
				/>
			</div>
			<div class="admin-page__field admin-page__field--uses">
				<label class="admin-page__field-label" for="event-draft-capacity">Capacity</label>
				<input
					id="event-draft-capacity"
					class="admin-page__input admin-page__input--number"
					type="number"
					min="1"
					max="50"
					value={dashboard.eventDraft.capacity}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, capacity: Number(event.currentTarget.value) || 1 }}
				/>
			</div>
			<div class="admin-page__field admin-page__field--expires">
				<label class="admin-page__field-label" for="event-draft-repeat">Repeat weeks</label>
				<input
					id="event-draft-repeat"
					class="admin-page__input admin-page__input--number"
					type="number"
					min="0"
					max="24"
					value={dashboard.eventDraft.repeatWeeks}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, repeatWeeks: Number(event.currentTarget.value) || 0 }}
				/>
			</div>
			<div class="admin-page__field admin-page__field--uses">
				<label class="admin-page__field-label" for="event-draft-cost">Cost (cents)</label>
				<input
					id="event-draft-cost"
					class="admin-page__input admin-page__input--number"
					type="number"
					min="0"
					max="200000"
					value={dashboard.eventDraft.costCents}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, costCents: Number(event.currentTarget.value) || 0 }}
				/>
			</div>
			<div class="admin-page__field admin-page__field--expires">
				<label class="admin-page__field-label" for="event-draft-provider">Pay provider</label>
				<select
					id="event-draft-provider"
					class="admin-page__input"
					value={dashboard.eventDraft.paymentProvider}
					onchange={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, paymentProvider: event.currentTarget.value }}
				>
					<option value="venmo">Venmo</option>
					<option value="cashapp">Cash App</option>
					<option value="paypal">PayPal</option>
					<option value="">None</option>
				</select>
			</div>
			<div class="admin-page__field admin-page__field--email">
				<label class="admin-page__field-label" for="event-draft-handle">Payment handle</label>
				<input
					id="event-draft-handle"
					class="admin-page__input"
					type="text"
					placeholder="@mudcube"
					value={dashboard.eventDraft.paymentHandle}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, paymentHandle: event.currentTarget.value }}
				/>
			</div>
			<div class="admin-page__field admin-page__field--email">
				<label class="admin-page__field-label" for="event-draft-note-template">Payment note</label>
				<input
					id="event-draft-note-template"
					class="admin-page__input"
					type="text"
					placeholder="Adventure ticket"
					value={dashboard.eventDraft.paymentNoteTemplate}
					oninput={(event) => dashboard.eventDraft = { ...dashboard.eventDraft, paymentNoteTemplate: event.currentTarget.value }}
				/>
			</div>
		</div>
	</div>

	<PillButton className="admin-page__button-secondary" variant="secondary" onClick={dashboard.createEvents} disabled={dashboard.eventsCreating || dashboard.enabledPrograms.length === 0}>
		{dashboard.eventsCreating ? 'Creating...' : 'Create Events'}
	</PillButton>
	{#if dashboard.enabledPrograms.length === 0}
		<p class="admin-page__section-description">Enable at least one program before creating events.</p>
	{/if}
</div>

<div class="admin-page__divider" aria-hidden="true"></div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Memory feed (recent events)</h3>
		<span class="admin-page__section-count">{dashboard.recentEvents.length} total</span>
	</div>
	{#if dashboard.recentEvents.length === 0}
		<p class="admin-page__section-description">No recent events to annotate yet.</p>
	{:else}
		<div class="admin-page__members-list">
			{#each dashboard.recentEvents as session, i}
				<div class="admin-page__members-row">
					<div class="admin-page__members-main admin-page__members-main--full">
						<div class="admin-page__members-code-row">
							<strong>{session.title}</strong>
							<span class="admin-page__members-meta"> · {session.activityLabel} · {formatDateTime(session.startsAt)}</span>
						</div>
						<div class="admin-page__members-meta">{session.seatsTaken}/{session.capacity} attended</div>
						<div class="admin-page__fields-grid admin-page__fields-grid--memory">
							<div class="admin-page__field">
								<label class="admin-page__field-label" for={`memory-recap-${session.id}`}>Recap text</label>
								<textarea
									id={`memory-recap-${session.id}`}
									class="admin-page__input"
									rows="2"
									value={memoryDrafts[session.id]?.recapText ?? session.recapText ?? ''}
									oninput={(event) => memoryDrafts[session.id] = {
										recapText: event.currentTarget.value,
										heroImageUrl: memoryDrafts[session.id]?.heroImageUrl ?? session.heroImageUrl ?? ''
									}}
								></textarea>
							</div>
							<div class="admin-page__field">
								<label class="admin-page__field-label" for={`memory-image-${session.id}`}>Hero image URL</label>
								<input
									id={`memory-image-${session.id}`}
									class="admin-page__input"
									type="text"
									value={memoryDrafts[session.id]?.heroImageUrl ?? session.heroImageUrl ?? ''}
									oninput={(event) => memoryDrafts[session.id] = {
										heroImageUrl: event.currentTarget.value,
										recapText: memoryDrafts[session.id]?.recapText ?? session.recapText ?? ''
									}}
								/>
							</div>
						</div>
					</div>
					<div class="admin-page__members-actions">
						<PillButton
							className="admin-page__button-secondary admin-page__button-secondary--compact"
							variant="secondary"
							size="sm"
							onClick={() => dashboard.updateEventMemory(
								session.id,
								memoryDrafts[session.id]?.recapText ?? session.recapText ?? '',
								memoryDrafts[session.id]?.heroImageUrl ?? session.heroImageUrl ?? ''
							)}
							disabled={dashboard.eventUpdatingId === session.id}
						>
							{dashboard.eventUpdatingId === session.id ? 'Saving...' : 'Save memory'}
						</PillButton>
					</div>
				</div>
				{#if i < dashboard.recentEvents.length - 1}<div class="admin-page__booking-divider"></div>{/if}
			{/each}
		</div>
	{/if}
</div>

<div class="admin-page__divider" aria-hidden="true"></div>

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Upcoming sessions</h3>
		<span class="admin-page__section-count">{dashboard.events.length} total</span>
	</div>
	{#if dashboard.eventsLoading}
		<p class="admin-page__section-description">Loading events...</p>
	{:else if dashboard.events.length === 0}
		<p class="admin-page__section-description">No sessions yet. Create your first one above.</p>
	{:else}
		<div class="admin-page__members-list">
			{#each dashboard.events as session, i}
				<div class="admin-page__members-row">
					<div class="admin-page__members-main">
						<div class="admin-page__members-code-row">
							<strong>{session.title}</strong>
							<span class="admin-page__members-meta"> · {session.activityLabel} · {formatDateTime(session.startsAt)}</span>
						</div>
						<div class="admin-page__members-meta">
							{session.seatsTaken}/{session.capacity} seats
							{#if session.waitlistCount > 0} · waitlist {session.waitlistCount}{/if}
							{#if session.costCents > 0} · ${(session.costCents / 100).toFixed(2)} {session.currency}{/if}
						</div>
					</div>
					<div class="admin-page__members-actions">
						<input
							class="admin-page__input admin-page__input--number admin-page__input--capacity"
							type="number"
							min="1"
							max="50"
							value={session.capacity}
							onchange={(event) => dashboard.updateEventCapacity(session.id, Number(event.currentTarget.value) || session.capacity)}
							disabled={dashboard.eventUpdatingId === session.id}
						/>
					</div>
				</div>
				{#if i < dashboard.events.length - 1}<div class="admin-page__booking-divider"></div>{/if}
			{/each}
		</div>
	{/if}
</div>
