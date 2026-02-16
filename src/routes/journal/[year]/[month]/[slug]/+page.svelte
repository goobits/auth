<script>
	import { BookOpen, Clock3 } from '@lucide/svelte'
	import MetadataValues from '@components/Journal/MetadataValues.svelte'

	const { data } = $props()
	const coverImage = $derived.by(() => {
		const rawImage = data.post.metadata.fm.coverImage || ''
		return rawImage.startsWith('http') || rawImage.startsWith('/') ? rawImage : `images/${rawImage}`
	})
</script>

<svelte:head>
    <title>{data.post.metadata.fm.title} - MIKO.ART</title>
</svelte:head>

<div class="journal-entry">
	<nav class="journal-entry__nav">
		<a href="/journal" class="journal-entry__back-btn">← Back to Journal</a>
	</nav>

	<article class="journal-entry__article">
		<header class="journal-entry__header">
			<p class="journal-entry__kicker">
				<BookOpen size={14} strokeWidth={2.2} />
				<span>Journal Entry</span>
			</p>
			<h1>{data.post.metadata.fm.title}</h1>
			<div class="journal-entry__metadata">
				<time datetime={data.post.date.toISOString()}>
					<Clock3 size={13} strokeWidth={2.2} />
					<span>{new Date(data.post.date).toLocaleDateString('en-US', {
						month: 'long',
						day: 'numeric',
						year: 'numeric'
					})}</span>
				</time>
				<div class="journal-entry__chips">
					{#if data.post.metadata.fm.categories}
						<MetadataValues values={data.post.metadata.fm.categories} type="category" />
					{/if}
					{#if data.post.metadata.fm.tags}
						<MetadataValues values={data.post.metadata.fm.tags} type="tag" />
					{/if}
				</div>
			</div>
		</header>

		{#if data.post.metadata.fm.coverImage}
			<img
				src={coverImage}
				alt={data.post.metadata.fm.title}
				class="journal-entry__cover-image"
			/>
		{/if}

		<div class="journal-entry__content">
			{@html data.post.content}
		</div>
	</article>
</div>

<style lang="scss">
	.journal-entry {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	.journal-entry__nav {
		margin: 0 auto 1rem;
	}

	.journal-entry__back-btn {
		display: inline-block;
		background: var(--card-bg);
		border: 1px solid var(--card-border);
		border-radius: 999px;
		color: var(--muted);
		text-decoration: none;
		font-family: var(--font-sans);
		font-size: 0.82rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		padding: 0.38rem 0.75rem;
		transition: all 0.15s ease;

		&:hover {
			border-color: var(--link);
			color: var(--text);
		}
	}

	.journal-entry__article {
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		box-shadow: 0 8px 30px var(--shadow-softest);
		padding: clamp(1rem, 2.5vw, 2rem);
	}

	.journal-entry__header {
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--panel-border);
		padding-bottom: 1.15rem;
	}

	.journal-entry__kicker {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
		margin: 0 0 0.6rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 3.25rem);
		line-height: 1.08;
		font-weight: 500;
		letter-spacing: -0.01em;
		margin: 0;
		max-width: 18ch;
		text-wrap: balance;
	}

	.journal-entry__metadata {
		margin-top: 0.9rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		color: var(--muted);

		time {
			display: inline-flex;
			align-items: center;
			gap: 0.35rem;
			font-family: var(--font-sans);
			font-size: 0.8rem;
			font-weight: 500;
			letter-spacing: 0.01em;
		}
	}

	.journal-entry__chips {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.2rem;
	}

	.journal-entry__cover-image {
		width: 100%;
		height: auto;
		margin-bottom: 1.5rem;
		border-radius: 0.6rem;
		border: 1px solid var(--border);
		box-shadow: 0 12px 28px var(--shadow-softest);
	}

	.journal-entry__content {
		font-family: var(--font-serif);
		font-size: clamp(1.07rem, 1.08vw, 1.18rem);
		line-height: 1.85;
		color: var(--text);
	}

	@media (max-width: 760px) {
		.journal-entry__article {
			border-radius: 8px;
			padding: 1rem;

			h1 {
				max-width: none;
			}
		}
	}
</style>
