<script>
	import { Loader } from '@lucide/svelte'
	const { dashboard } = $props()
</script>

<h1 class="admin-page__title">Programs</h1>
<p class="admin-page__subtitle">Control which calendar programs are visible and bookable.</p>

{#if dashboard.error}
	<div class="admin-page__section admin-page__section--error">
		<p class="admin-page__calendar-error">{dashboard.error}</p>
	</div>
{/if}

<div class="admin-page__section">
	<div class="admin-page__section-head">
		<h3 class="admin-page__section-title">Available programs</h3>
		<span class="admin-page__section-count">{dashboard.programs.length} total</span>
	</div>
	{#if dashboard.programsLoading}
		<p class="admin-page__section-description">Loading programs...</p>
	{:else}
		<div class="admin-page__members-list">
			{#each dashboard.programs as program, i}
				<div class="admin-page__members-row">
					<div class="admin-page__members-main">
						<div class="admin-page__members-code-row">
							<strong>{program.label}</strong>
							<span class="admin-page__members-meta"> · {program.href}</span>
						</div>
						<div class="admin-page__members-meta">{program.description}</div>
					</div>
					<div class="admin-page__members-actions">
						<a
							class="admin-page__button-secondary admin-page__button-secondary--compact"
							href={program.href}
							target="_blank"
							rel="noopener noreferrer"
						>
							Open
						</a>
						<button
							class="admin-page__button-secondary admin-page__button-secondary--compact"
							class:admin-page__button-secondary--danger={program.enabled}
							onclick={() => dashboard.toggleProgram(program.slug, !program.enabled)}
							disabled={dashboard.programUpdatingSlug === program.slug}
						>
							{#if dashboard.programUpdatingSlug === program.slug}
								<Loader size={12} class="admin-page__spin" />
								Saving...
							{:else if program.enabled}
								Disable
							{:else}
								Enable
							{/if}
						</button>
					</div>
				</div>
				{#if i < dashboard.programs.length - 1}<div class="admin-page__booking-divider"></div>{/if}
			{/each}
		</div>
	{/if}
</div>

