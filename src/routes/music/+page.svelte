<script>
	import { ArrowUpRight, CalendarDays, Disc3, Headphones, Radio } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'

	const { data } = $props()

	const platforms = [
		{ label: 'Spotify', href: '/contact', note: 'Request listening links' },
		{ label: 'Apple Music', href: '/contact', note: 'Request listening links' },
		{ label: 'YouTube', href: '/contact', note: 'Request listening links' },
		{ label: 'SoundCloud', href: '/contact', note: 'Request listening links' }
	]

	function formatDate(value) {
		return new Date(value).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}
</script>

<svelte:head>
	<title>Music - MIKO.ART</title>
	<meta name="description" content="Music by Miko: songs, audio experiments, and listening links." />
</svelte:head>

<HeroBanner
	title="Music"
	subtitle="Songs, sketches, and sound experiments."
/>

<div class="music-page showcase-page">
	<section class="intro showcase-section showcase-intro">
		<p>
			Melody has always been part of the build process. This page is the home for tracks, demos,
			and music-related experiments from Miko.
		</p>
	</section>

	<section class="platforms showcase-section">
		<h2 class="showcase-title"><Headphones size={17} strokeWidth={2.2} /> Listen</h2>
		<ul>
			{#each platforms as item}
				<li>
					<a href={item.href}>
						<span>{item.label}</span>
						<ArrowUpRight size={14} strokeWidth={2.2} />
					</a>
					<small>{item.note}</small>
				</li>
			{/each}
		</ul>
	</section>

	<section class="entries showcase-section">
		<h2 class="showcase-title"><Disc3 size={17} strokeWidth={2.2} /> Music Entries</h2>
		{#if data.musicPosts.length === 0}
			<p class="empty">Music posts are coming soon.</p>
		{:else}
			<ol>
				{#each data.musicPosts as post}
					<li>
						<a href={`/${post.urlPath}`}>
							<span class="title">{post.title}</span>
							<span class="meta">
								<CalendarDays size={13} strokeWidth={2.2} />
								{formatDate(post.date)}
							</span>
						</a>
					</li>
				{/each}
			</ol>
		{/if}
	</section>

	<section class="closing showcase-section">
		<h2 class="showcase-title"><Radio size={17} strokeWidth={2.2} /> Collaborations</h2>
		<p>If you want a custom soundtrack or music + product collaboration, reach out anytime.</p>
		<a href="/contact" class="pill-link">Start a conversation</a>
	</section>
</div>

<style>
	.platforms ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	.platforms li {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		background: color-mix(in srgb, var(--card-bg) 72%, transparent);
	}

	.platforms a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}

	.platforms small {
		display: block;
		margin-top: 0.2rem;
		color: var(--muted);
		font-size: 0.76rem;
	}

	.entries ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--panel-border);
	}

	.entries li {
		border-bottom: 1px solid var(--panel-border);
	}

	.entries a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.7rem 0;
		text-decoration: none;
		color: var(--text);
	}

	.entries .title {
		font-family: var(--font-serif);
		font-size: 1rem;
	}

	.entries .meta {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-sans);
		font-size: 0.78rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.closing p {
		margin: 0 0 0.75rem;
		color: var(--text);
	}
</style>
