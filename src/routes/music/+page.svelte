<script>
	import { CalendarDays } from '@lucide/svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import { formatDateMonthDayYearShort } from '$lib/utils/date'

	const { data } = $props()

	const platforms = [
		{ label: 'Spotify', href: '/contact', note: 'Request listening links' },
		{ label: 'Apple Music', href: '/contact', note: 'Request listening links' },
		{ label: 'YouTube', href: '/contact', note: 'Request listening links' },
		{ label: 'SoundCloud', href: '/contact', note: 'Request listening links' }
	]

</script>

<svelte:head>
	<title>Music - MIKO.ART</title>
	<meta name="description" content="Music by Miko: songs, audio experiments, and listening links." />
</svelte:head>

<div class="music-page">
	<Hero
		eyebrow="Music"
		title="Songs, sketches, and sound experiments."
		subtitle="Melody has always been part of the build process. This page is the home for tracks, demos, and music-related experiments from Miko."
	/>

	<section class="music-page__platforms" aria-label="Listening platforms">
		<p class="music-page__label">Listen</p>
		<ul>
			{#each platforms as item}
				<li>
					<a href={item.href}>
						<span>{item.label}</span>
						<small>{item.note}</small>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	<section class="music-page__entries" aria-label="Music entries">
		<p class="music-page__label">Entries</p>
		{#if data.musicPosts.length === 0}
			<p class="music-page__empty">Music posts are coming soon.</p>
		{:else}
			<ol>
				{#each data.musicPosts as post}
					<li>
						<a href={`/${post.urlPath}`}>
							<span class="music-page__entry-title">{post.title}</span>
							<span class="music-page__entry-meta">
								<CalendarDays size={13} strokeWidth={2.2} />
								{formatDateMonthDayYearShort(post.date)}
							</span>
						</a>
					</li>
				{/each}
			</ol>
		{/if}
	</section>

	<section class="music-page__closing" aria-label="Collaborations">
		<div class="music-page__divider"></div>
		<p class="music-page__label">Collaborations</p>
		<h2>Need a custom soundtrack or audio collaboration?</h2>
		<p class="music-page__closing-copy">
			If you want original music for a product, visual project, or interactive experience,
			reach out anytime.
		</p>
		<a href="/contact" class="music-page__contact-link">Start a conversation</a>
	</section>
</div>

<style lang="scss">
	.music-page {
		max-width: 980px;
		margin: 0 auto;
		padding: 3.1rem 1.25rem 5.25rem;
	}

	.music-page__platforms {
		margin-bottom: 2.6rem;
	}

	.music-page__platforms ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.7rem 1rem;
	}

	.music-page__platforms a {
		display: grid;
		gap: 0.08rem;
		text-decoration: none;
		color: inherit;
	}

	.music-page__platforms span {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.01em;
	}

	.music-page__platforms small {
		font-size: 0.78rem;
		color: var(--muted);
	}

	.music-page__platforms a:hover span {
		color: var(--link);
	}

	.music-page__entries {
		margin-bottom: 3.2rem;
	}

	.music-page__entries ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}

	.music-page__entries li {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}

	.music-page__entries a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.78rem 0;
		text-decoration: none;
		color: var(--text);
	}

	.music-page__entry-title {
		font-family: var(--font-serif);
		font-size: 1.03rem;
		letter-spacing: -0.01em;
	}

	.music-page__entry-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.music-page__entries a:hover .music-page__entry-title {
		color: var(--link);
	}

	.music-page__empty {
		margin: 0;
		color: var(--muted);
	}

	.music-page__closing {
		max-width: 520px;
	}

	.music-page__divider {
		height: 1px;
		background: color-mix(in srgb, var(--border) 55%, transparent);
		margin-bottom: 2.9rem;
	}

	.music-page__closing h2 {
		margin: 0 0 0.58rem;
		font-family: var(--font-serif);
		font-size: clamp(1.55rem, 3.2vw, 1.9rem);
		font-weight: 500;
		line-height: 1.3;
		letter-spacing: -0.02em;
	}

	.music-page__closing-copy {
		margin: 0 0 1.25rem;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--muted);
	}

	.music-page__contact-link {
		display: inline-block;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid currentColor;
		padding-bottom: 0.15rem;
		transition: opacity 0.2s ease;
	}

	.music-page__contact-link:hover {
		opacity: 0.65;
	}

	@media (max-width: 760px) {
		.music-page {
			padding-top: 2.4rem;
		}

		.music-page__entries a {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.3rem;
		}
	}
</style>
