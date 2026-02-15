<script>
	import Hero from '$lib/ui/Hero.svelte'
	import PageClosing from '$lib/ui/PageClosing.svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import SectionLabel from '$lib/ui/SectionLabel.svelte'
	import { formatDateMonthDayYearShort } from '$lib/utils/date'

	const { data } = $props()

	const platforms = [
		{ label: 'Spotify', href: '/contact?from=music&topic=spotify', icon: 'S' },
		{ label: 'Apple Music', href: '/contact?from=music&topic=apple_music', icon: 'A' },
		{ label: 'YouTube Music', href: '/contact?from=music&topic=youtube_music', icon: 'Y' },
		{ label: 'SoundCloud', href: '/contact?from=music&topic=soundcloud', icon: 'SC' }
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
			<SectionLabel text="Listen" className="music-page__section-label" />
			<div class="music-page__platform-row ui-chip-row">
				{#each platforms as item}
					<a href={item.href} class="music-page__platform-chip ui-chip">
						<span class="music-page__platform-icon ui-chip__icon" aria-hidden="true">{item.icon}</span>
						{item.label}
					</a>
				{/each}
			</div>
		</section>

		<section class="music-page__entries" aria-label="Music entries">
			<SectionLabel text="Entries" className="music-page__section-label" />
			<ol class="ui-entry-list">
				{#each getEntries() as entry, idx}
					<li class="ui-entry-list__item">
						<a href={entry.href} class="music-page__entry-link ui-entry-list__row">
							<span class="music-page__entry-num ui-entry-list__num">{String(idx + 1).padStart(2, '0')}</span>
							<span class="music-page__entry-title ui-entry-list__title">{entry.title}</span>
							<span class="music-page__entry-tag ui-entry-list__tag">{entry.tag}</span>
							<span class="music-page__entry-date ui-entry-list__date">{formatDateMonthDayYearShort(entry.date)}</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>

			<PageClosing
				className="music-page__closing"
				label="Collaborations"
				title="Need a custom soundtrack or audio collaboration?"
				copy="Original music for a product, visual project, or interactive experience. Reach out anytime."
				href="/contact?from=music&topic=collaboration"
				linkLabel="Start a conversation"
				maxWidth="27.5rem"
			/>
	</div>
</PageShell>

<style lang="scss">
	.music-page {
		--music-section-label-size: 0.8125rem;
		--music-platform-gap: var(--space-3);
		--music-chip-gap: var(--space-2);
		--music-chip-padding: 0.625rem 1.25rem 0.625rem 1rem;
		--music-chip-font: var(--font-size-sm);
		--music-icon-size: 1.15rem;
		--music-icon-font: 0.67rem;
		--music-list-row-padding: 0.8125rem 0;
		--music-list-gap: 0 1rem;
		--music-title-font: 0.9375rem;
		--music-tag-font: 0.6875rem;
		--music-tag-padding: 0.125rem 0.5rem;
		--music-tag-radius: 0.25rem;
		--music-date-font: 0.8125rem;
	}

	:global(.music-page__section-label) {
		margin-bottom: 1.25rem;
	}

	.music-page__platforms {
		padding-top: 4rem;
	}

	.music-page__platform-row { gap: var(--music-platform-gap); }

	.music-page__platform-chip {
		gap: var(--music-chip-gap);
		padding: var(--music-chip-padding);
		font-size: var(--music-chip-font);
	}

	.music-page__platform-icon {
		min-width: var(--music-icon-size);
		height: var(--music-icon-size);
		font-size: var(--music-icon-font);
	}

	.music-page__entries {
		padding-top: 4.5rem;
	}

	.music-page__entry-link {
		gap: var(--music-list-gap);
		padding: var(--music-list-row-padding);
	}

	.music-page__entry-num {
		font-size: var(--music-date-font);
	}

	.music-page__entry-title {
		font-size: var(--music-title-font);
	}

	.music-page__entry-tag {
		font-size: var(--music-tag-font);
		padding: var(--music-tag-padding);
		border-radius: var(--music-tag-radius);
	}

	.music-page__entry-date {
		font-size: var(--music-date-font);
		min-width: 6.2rem;
	}

	:global(.music-page__closing) {
		padding-top: 5rem;
	}

	@media (max-width: 43.75em) {
		.music-page__platform-row {
			gap: var(--space-2);
		}

		.music-page__platform-chip {
			padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3);
			font-size: var(--music-section-label-size);
		}

		.music-page__entry-link {
			grid-template-columns: 1.5rem minmax(0, 1fr) auto;
		}

		.music-page__entry-tag {
			display: none;
		}
	}
</style>
