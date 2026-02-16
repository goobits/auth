<script>
	import { Search } from '@lucide/svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'
	import ResultsEmpty from '$lib/ui/ResultsEmpty.svelte'
	import { filterAndSortLabs, labsCatalog } from '$lib/viewmodels/labs'
	import { formatDateMmDdYyyy } from '$lib/utils/date'

	let searchQuery = $state('')
	let sortBy = $state('title')
	const sortOptions = [
		{ value: 'title', label: 'Name' },
		{ value: 'path', label: 'Path' }
	]

	const accentColors = [
		'#ec4899',
		'#f59e0b',
		'#eab308',
		'#22c55e',
		'#14b8a6',
		'#3b82f6',
		'#8b5cf6',
		'#f43f5e',
		'#f97316'
	]

	function hashString(input) {
		// Simple deterministic hash for stable accent assignment per href.
		let h = 0
		for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
		return Math.abs(h)
	}

	function getAccentColor(lab) {
		const idx = hashString(lab.href || lab.title || '') % accentColors.length
		return accentColors[idx]
	}

	const filteredLabs = $derived(filterAndSortLabs(labsCatalog, searchQuery, 'all', sortBy))
</script>

<svelte:head>
	<title>Labs - MIKO.ART</title>
</svelte:head>

<PageShell className="labs-page">
	<div class="labs-page__inner">
		<Hero
			eyebrow="Labs"
			title="Labs"
			icon="/media/labs-flask.png"
			iconAlt="Flask icon"
			iconSize="0.95em"
			subtitle="Playful experiments, sketches, and odd ideas."
		/>

		<section class="labs-page__toolbar" aria-label="Labs filters">
			<label class="labs-page__search" aria-label="Search experiments">
				<span class="labs-page__search-icon" aria-hidden="true">
					<Search size={15} strokeWidth={2.2} />
				</span>
				<input
					class="labs-page__search-input"
					type="text"
					placeholder="Search experiments..."
					bind:value={searchQuery}
				/>
			</label>

			<div class="labs-page__chip-group" role="tablist" aria-label="Sort labs">
				{#each sortOptions as option}
					<PillButton
						type="button"
						role="tab"
						className={`labs-page__chip ${sortBy === option.value ? 'labs-page__chip--active' : ''}`}
						variant={sortBy === option.value ? 'primary' : 'secondary'}
						size="sm"
						ariaSelected={sortBy === option.value}
						onClick={() => (sortBy = option.value)}
					>
						{option.label}
					</PillButton>
				{/each}
			</div>
		</section>

		{#if filteredLabs.length === 0}
			<ResultsEmpty
				message="No experiments match your filters."
				onAction={() => {
					searchQuery = ''
					sortBy = 'title'
				}}
			/>
		{:else}
			<p class="labs-page__count">
				{filteredLabs.length} experiment{filteredLabs.length === 1 ? '' : 's'}
			</p>

			<ul class="labs-page__grid" aria-label="Experiments">
				{#each filteredLabs as lab}
					<li class="labs-page__item">
						<a
							href={lab.href}
							class="labs-page__card"
							style={`--accent:${getAccentColor(lab)};`}
						>
							<div class="labs-page__bar" aria-hidden="true"></div>

							<div class="labs-page__card-body">
								<div class="labs-page__card-head">
									<h2 class="labs-page__card-title">{lab.title}</h2>
									{#if lab.date}
										{@const parsed = new Date(lab.date)}
										<span class="labs-page__date" title={formatDateMmDdYyyy(parsed)}>
											{parsed.getFullYear()}
										</span>
									{/if}
								</div>
								<p class="labs-page__vibe">{lab.vibe}</p>
								<p class="labs-page__path">{lab.href}</p>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</PageShell>

<style>
	.labs-page__inner {
		padding-inline: 1.5rem;
	}

	.labs-page__toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.labs-page__search {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1 1 220px;
		min-width: 160px;
		border: 1.5px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-pill);
		background: transparent;
		padding: 0.1rem 0.9rem;
		transition: border-color 0.25s;
	}

	.labs-page__search:focus-within {
		border-color: color-mix(in srgb, var(--text) 55%, var(--border));
	}

	.labs-page__search-icon {
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		flex-shrink: 0;
	}

	.labs-page__search-input {
		width: 100%;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		color: var(--text);
		background: transparent;
		border: none;
		padding: 0.75rem 0;
		margin: 0;
	}

	.labs-page__search-input:focus {
		outline: none;
	}

	.labs-page__chip-group {
		display: inline-flex;
		align-items: center;
		border: 1.5px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	:global(.labs-page__chip) {
		border: none;
		background: transparent;
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-family: var(--font-sans);
		font-size: var(--font-size-xs);
		padding: 0.6rem 0.95rem;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
	}

	:global(.labs-page__chip--active) {
		background: var(--text);
		color: var(--bg);
	}

	.labs-page__count {
		margin: 1rem 0 0.5rem;
		font-size: var(--font-size-xs);
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		font-family: var(--font-sans);
	}

	.labs-page__grid {
		list-style: none;
		margin: 0;
		padding: 0.5rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.25rem;
	}

	.labs-page__item {
		margin: 0;
		padding: 0;
	}

	.labs-page__card {
		--card-border: color-mix(in srgb, var(--border) 60%, transparent);
		display: flex;
		flex-direction: column;
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid var(--card-border);
		text-decoration: none;
		color: var(--text);
		background: color-mix(in srgb, var(--card-bg) 76%, transparent);
		height: 100%;
		transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.labs-page__card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 40px color-mix(in srgb, var(--text) 10%, transparent);
		border-color: color-mix(in srgb, var(--border) 86%, transparent);
	}

	.labs-page__bar {
		height: 6px;
		background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent));
		opacity: 0.72;
	}

	.labs-page__card-body {
		padding: 1.25rem 1.375rem 1.375rem;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 10.75rem;
	}

	.labs-page__card-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		justify-content: space-between;
	}

	.labs-page__card-title {
		margin: 0 0 0.35rem;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.1875rem;
		letter-spacing: -0.015em;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}

	.labs-page__date {
		flex-shrink: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.75rem;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: 999px;
		padding: 0.22rem 0.55rem;
		background: color-mix(in srgb, var(--bg) 65%, transparent);
	}

	.labs-page__vibe {
		margin: 0 0 1rem;
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		line-height: 1.5;
		color: color-mix(in srgb, var(--muted) 88%, var(--text));
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}

	.labs-page__path {
		margin: 0;
		margin-top: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.75rem;
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
