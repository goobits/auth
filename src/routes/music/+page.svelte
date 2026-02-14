<script>
	import { CalendarDays, Disc3, Headphones, Radio } from '@lucide/svelte'
	import ConversationCta from '$lib/ui/ConversationCta.svelte'
	import Hero from '$lib/ui/Hero.svelte'
	import ShowcaseSection from '$lib/ui/ShowcaseSection.svelte'

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

<Hero
	title="Music"
	subtitle="Songs, sketches, and sound experiments."
/>

<div class="music showcase__page">
	<section class="showcase__section showcase__intro music__intro">
		<p>
			Melody has always been part of the build process. This page is the home for tracks, demos,
			and music-related experiments from Miko.
		</p>
	</section>

	<ShowcaseSection className="music__platforms" titleClassName="music__title" title="Listen">
		{#snippet icon()}
			<Headphones size={17} strokeWidth={2.2} />
		{/snippet}
		<ul>
			{#each platforms as item}
				<li>
					<a href={item.href}>
						<span>{item.label}</span>
					</a>
					<small>{item.note}</small>
				</li>
			{/each}
		</ul>
	</ShowcaseSection>

	<ShowcaseSection className="music__entries" titleClassName="music__title" title="Music Entries">
		{#snippet icon()}
			<Disc3 size={17} strokeWidth={2.2} />
		{/snippet}
		{#if data.musicPosts.length === 0}
			<p class="empty music__empty">Music posts are coming soon.</p>
		{:else}
			<ol>
				{#each data.musicPosts as post}
					<li>
						<a href={`/${post.urlPath}`}>
							<span class="title music__entry-title">{post.title}</span>
							<span class="meta music__entry-meta">
								<CalendarDays size={13} strokeWidth={2.2} />
								{formatDate(post.date)}
							</span>
						</a>
					</li>
				{/each}
			</ol>
		{/if}
	</ShowcaseSection>

	<ShowcaseSection className="music__closing" titleClassName="music__title" title="Collaborations">
		{#snippet icon()}
			<Radio size={17} strokeWidth={2.2} />
		{/snippet}
		<p>If you want a custom soundtrack or music + product collaboration, reach out anytime.</p>
		<ConversationCta withIcon={false} />
	</ShowcaseSection>
</div>

<style>
	:global(.music__platforms ul) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	:global(.music__platforms li) {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.65rem 0.75rem;
		background: color-mix(in srgb, var(--card-bg) 72%, transparent);
	}

	:global(.music__platforms a) {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-sans);
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}

	:global(.music__platforms small) {
		display: block;
		margin-top: 0.2rem;
		color: var(--muted);
		font-size: 0.76rem;
	}

	:global(.music__entries ol) {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--panel-border);
	}

	:global(.music__entries li) {
		border-bottom: 1px solid var(--panel-border);
	}

	:global(.music__entries a) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.7rem 0;
		text-decoration: none;
		color: var(--text);
	}

	.music__entry-title {
		font-family: var(--font-serif);
		font-size: 1rem;
	}

	.music__entry-meta {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-sans);
		font-size: 0.78rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.music__empty {
		margin: 0;
		color: var(--muted);
	}

	:global(.music__closing p) {
		margin: 0 0 0.75rem;
		color: var(--text);
	}
</style>
