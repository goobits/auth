<script>
	import Hero from '$lib/ui/Hero.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import { formatDateMonthDayYearShort } from '$lib/utils/date'

	const { data } = $props()

	const platforms = [
		{ label: 'Spotify', href: '/contact', icon: 'S' },
		{ label: 'Apple Music', href: '/contact', icon: 'A' },
		{ label: 'YouTube Music', href: '/contact', icon: 'Y' },
		{ label: 'SoundCloud', href: '/contact', icon: 'SC' }
	]

	const fallbackEntries = [
		{ title: 'Neon Drift — synth ambient', href: '/music', date: '2025-01-12', tag: 'Track' },
		{ title: 'Sunroom — acoustic sketch', href: '/music', date: '2024-08-04', tag: 'Demo' },
		{ title: 'Color Piano Loops — generative audio', href: '/music', date: '2023-11-19', tag: 'Experiment' },
		{ title: 'Quiet Machines — lo-fi electronic', href: '/music', date: '2022-05-30', tag: 'Track' },
		{ title: 'Portland Rain — piano + field recording', href: '/music', date: '2018-03-14', tag: 'Demo' },
		{ title: 'Sketch Theme — product soundtrack', href: '/music', date: '2015-06-07', tag: 'Track' },
		{ title: 'Time Traveler — piano song', href: '/music', date: '2012-08-31', tag: 'Track' }
	]

	function getEntries() {
		if (data.musicPosts.length === 0) return fallbackEntries
		const liveEntries = data.musicPosts.map((post) => ({
			title: post.title,
			href: `/${post.urlPath}`,
			date: post.date,
			tag: 'Entry'
		}))
		return [...liveEntries, ...fallbackEntries].slice(0, 10)
	}
</script>

<svelte:head>
	<title>Music - MIKO.ART</title>
	<meta name="description" content="Music by Miko: songs, audio experiments, and listening links." />
</svelte:head>

<PageShell className="music-page">
	<div class="music-page">
		<Hero
			eyebrow="Music"
			title="Songs, sketches, and sound experiments 🎹"
			subtitle="Melody has always been part of the build process. Tracks, demos, and music-related experiments from Miko."
		/>

		<section class="music-page__platforms" aria-label="Listening platforms">
			<p class="music-page__section-label">Listen</p>
			<div class="music-page__platform-row">
				{#each platforms as item}
					<a href={item.href} class="music-page__platform-chip">
						<span class="music-page__platform-icon" aria-hidden="true">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
		</section>

		<section class="music-page__entries" aria-label="Music entries">
			<p class="music-page__section-label">Entries</p>
			<ol>
				{#each getEntries() as entry, idx}
					<li>
						<a href={entry.href} class="music-page__entry-link">
							<span class="music-page__entry-num">{String(idx + 1).padStart(2, '0')}</span>
							<span class="music-page__entry-title">{entry.title}</span>
							<span class="music-page__entry-tag">{entry.tag}</span>
							<span class="music-page__entry-date">{formatDateMonthDayYearShort(entry.date)}</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>

		<section class="music-page__cta" aria-label="Collaborations">
			<div class="music-page__divider"></div>
			<div class="music-page__cta-content">
				<p class="music-page__section-label">Collaborations</p>
				<h2>Need a custom soundtrack or audio collaboration?</h2>
				<p>
					Original music for a product, visual project, or interactive experience. Reach out anytime.
				</p>
				<a href="/contact" class="music-page__cta-link">Start a conversation</a>
			</div>
		</section>
	</div>
</PageShell>

<style lang="scss">
	.music-page__section-label {
		margin: 0 0 1.25rem;
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted) 85%, var(--text));
	}

	.music-page__platforms {
		padding-top: 4rem;
	}

	.music-page__platform-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.music-page__platform-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem 0.625rem 1rem;
		border-radius: var(--radius-pill);
		border: var(--border-width) solid color-mix(in srgb, var(--border) 80%, transparent);
		font-size: 0.875rem;
		font-weight: 500;
		letter-spacing: -0.005em;
		color: var(--text);
		text-decoration: none;
		transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease;
	}

	.music-page__platform-chip:hover {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
		opacity: 1;
	}

	.music-page__platform-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.15rem;
		height: 1.15rem;
		font-size: 0.67rem;
		font-weight: 700;
		line-height: 1;
		border-radius: 999px;
		border: var(--border-width) solid currentColor;
		padding: 0 0.2rem;
	}

	.music-page__entries {
		padding-top: 4.5rem;
	}

	.music-page__entries ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.music-page__entry-link {
		display: grid;
		grid-template-columns: 1.75rem minmax(0, 1fr) auto auto;
		align-items: baseline;
		gap: 0 1rem;
		padding: 0.8125rem 0;
		border-top: var(--border-width) solid color-mix(in srgb, var(--border) 70%, transparent);
		text-decoration: none;
		transition: opacity 0.2s;
	}

	.music-page__entries li:last-child .music-page__entry-link {
		border-bottom: var(--border-width) solid color-mix(in srgb, var(--border) 70%, transparent);
	}

	.music-page__entry-link:hover {
		opacity: 0.65;
	}

	.music-page__entry-num {
		font-size: 0.8125rem;
		color: color-mix(in srgb, var(--muted) 82%, var(--text));
		font-variant-numeric: tabular-nums;
	}

	.music-page__entry-title {
		font-size: 0.9375rem;
		font-weight: 400;
		letter-spacing: -0.005em;
		color: var(--text);
	}

	.music-page__entry-tag {
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted) 88%, var(--text));
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		background: color-mix(in srgb, var(--text) 5%, transparent);
		white-space: nowrap;
	}

	.music-page__entry-date {
		font-size: 0.8125rem;
		color: color-mix(in srgb, var(--muted) 85%, var(--text));
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		min-width: 6.2rem;
		text-align: right;
	}

	.music-page__cta {
		padding-top: 5rem;
	}

	.music-page__divider {
		width: 100%;
		height: var(--border-width);
		background: color-mix(in srgb, var(--border) 70%, transparent);
		margin-bottom: 3.5rem;
	}

	.music-page__cta-content {
		max-width: 27.5rem;
		padding-bottom: 7.5rem;
	}

	.music-page__cta-content h2 {
		margin: 0 0 0.75rem;
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-weight: 400;
		letter-spacing: -0.02em;
		line-height: 1.35;
		color: var(--text);
	}

	.music-page__cta-content p {
		margin: 0 0 1.5rem;
		font-size: 0.9375rem;
		color: var(--muted);
		line-height: 1.6;
	}

	.music-page__cta-link {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		border-bottom: var(--border-width) solid currentColor;
		padding-bottom: 0.125rem;
	}

	.music-page__cta-link:hover {
		opacity: 0.65;
	}

	@media (max-width: 700px) {
		.music-page__platform-row {
			gap: 0.5rem;
		}

		.music-page__platform-chip {
			padding: 0.5rem 1rem 0.5rem 0.75rem;
			font-size: 0.8125rem;
		}

		.music-page__entry-link {
			grid-template-columns: 1.5rem minmax(0, 1fr) auto;
		}

		.music-page__entry-tag {
			display: none;
		}
	}
</style>
