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

<div class="journal-post journal-entry">
	<nav class="journal-entry__nav">
		<a href="/journal" class="back-btn journal-entry__back-btn">← Back to Journal</a>
	</nav>

	<article class="journal-entry__article">
		<header class="header journal-entry__header">
			<p class="kicker journal-entry__kicker">
				<BookOpen size={14} strokeWidth={2.2} />
				<span>Journal Entry</span>
			</p>
			<h1>{data.post.metadata.fm.title}</h1>
			<div class="metadata journal-entry__metadata">
				<time datetime={data.post.date.toISOString()}>
					<Clock3 size={13} strokeWidth={2.2} />
					<span>{new Date(data.post.date).toLocaleDateString('en-US', {
						month: 'long',
						day: 'numeric',
						year: 'numeric'
					})}</span>
				</time>
				<div class="chips journal-entry__chips">
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
				class="cover-image journal-entry__cover-image"
			/>
		{/if}

		<div class="content journal-entry__content">
			{@html data.post.content}
		</div>
	</article>
</div>

<style lang="scss">
	.journal-post {
		max-width: var(--max-width);
		margin: 0 auto;
	}

	nav {
		margin: 0 auto 1rem;

		.back-btn {
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
	}

	article {
		background: var(--panel-bg);
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		box-shadow: 0 8px 30px var(--shadow-softest);
		padding: clamp(1rem, 2.5vw, 2rem);

		.header {
			margin-bottom: 1.5rem;
			border-bottom: 1px solid var(--panel-border);
			padding-bottom: 1.15rem;
		}

		.kicker {
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

		.metadata {
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

		.chips {
			display: inline-flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.2rem;
		}

		.cover-image {
			width: 100%;
			height: auto;
			margin-bottom: 1.5rem;
			border-radius: 0.6rem;
			border: 1px solid var(--border);
			box-shadow: 0 12px 28px var(--shadow-softest);
		}

		.content {
			font-family: var(--font-serif);
			font-size: clamp(1.07rem, 1.08vw, 1.18rem);
			line-height: 1.85;
			color: var(--text);
		}

		:global(.content > *) {
			max-width: 70ch;
			margin-left: auto;
			margin-right: auto;
		}

		:global(.content > p:first-child) {
			font-size: 1.18em;
			line-height: 1.72;
			color: color-mix(in srgb, var(--text) 92%, var(--muted) 8%);
		}

		:global(.content h2),
		:global(.content h3),
		:global(.content h4) {
			font-family: var(--font-display);
			letter-spacing: -0.01em;
			line-height: 1.2;
			margin-top: 2.4rem;
			margin-bottom: 0.8rem;
			text-align: left;
		}

		:global(.content h2) {
			font-size: clamp(1.5rem, 2.3vw, 2rem);
		}

		:global(.content p) {
			margin: 0 0 1.15rem;
		}

		:global(.content p + p) {
			text-wrap: pretty;
		}

		:global(.content a) {
			color: var(--link);
			text-decoration-thickness: 1px;
			text-underline-offset: 0.12em;
		}

		:global(.content a:hover) {
			color: var(--link-hover);
		}

		:global(.content blockquote) {
			border-left: 3px solid var(--border);
			margin: 1.75rem auto;
			padding: 0.35rem 1rem;
			color: color-mix(in srgb, var(--text) 88%, var(--muted) 12%);
			font-style: italic;
		}

		:global(.content ul),
		:global(.content ol) {
			margin: 1rem auto 1.25rem;
			padding-left: 1.4rem;
		}

		:global(.content li) {
			margin-bottom: 0.45rem;
		}

		:global(.content hr) {
			border: 0;
			border-top: 1px solid var(--panel-border);
			margin: 2rem auto;
		}

		:global(.content pre) {
			background: var(--card-bg);
			border: 1px solid var(--panel-border);
			border-radius: 8px;
			padding: 0.9rem 1rem;
			overflow-x: auto;
			line-height: 1.55;
		}

		:global(.content :not(pre) > code) {
			background: var(--card-bg);
			border: 1px solid var(--panel-border);
			border-radius: 4px;
			padding: 0.1rem 0.35rem;
			font-size: 0.88em;
		}

		:global(.content img) {
			width: 100%;
			max-width: 76ch;
			margin: 1.4rem auto;
			display: block;
			height: auto;
			border-radius: 0.45rem;
			border: 1px solid var(--border);
			box-shadow: 0 10px 24px var(--shadow-softest);
		}
	}

	@media (max-width: 760px) {
		article {
			border-radius: 8px;
			padding: 1rem;

			h1 {
				max-width: none;
			}

			:global(.content > *) {
				max-width: none;
			}
		}
	}
</style>
