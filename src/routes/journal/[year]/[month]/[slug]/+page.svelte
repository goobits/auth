<script>
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

<nav>
    <a href="/journal" class="back-btn">← Back</a>
</nav>

<article>
    <div class="header">
        {#if data.post.metadata.fm.coverImage}
            <img
                    src={coverImage}
                    alt={data.post.metadata.fm.title}
                    class="cover-image"
            />
        {/if}
        <h1>{data.post.metadata.fm.title}</h1>
        <div class="metadata">
            <time datetime={data.post.date.toISOString()}>
                {new Date(data.post.date).toLocaleDateString('en-US', {
					month: 'numeric',
					day: 'numeric',
					year: 'numeric'
				})}
            </time>
            <div style="display: flex">
                {#if data.post.metadata.fm.categories}
                    <MetadataValues values={data.post.metadata.fm.categories} type="category"/>
                {/if}
                {#if data.post.metadata.fm.tags}
                    <MetadataValues values={data.post.metadata.fm.tags} type="tag"/>
                {/if}
            </div>
        </div>
    </div>
    <div class="content">
        {@html data.post.content}
    </div>
</article>

<style lang="scss">
	nav {
		max-width: 700px;
		margin: 0 auto 1rem;

		.back-btn {
			color: var(--muted);
			text-decoration: none;
			font-family: "Source Serif Pro", serif;

			&:hover {
				text-decoration: underline;
			}
		}
	}

	article {
		font-family: "Source Serif Pro", serif;
		margin: 0 auto;
		max-width: 700px;
		line-height: 1.6em;

		:global(h2) {
			text-align: left;
		}

		:global(img) {
			max-width: 100%;
			height: auto;
			display: block;
		}

		.cover-image {
			width: 100%;
			height: auto;
			margin-bottom: 2rem;
			border-radius: 0.5rem;
			border: 1px solid var(--border);
		}

		.header {
			margin-bottom: 2rem;

			h1 {
				font-family: "Playfair Display", serif;
				font-size: 3rem;
				font-weight: 500;
				margin: 0;
				text-align: left;
			}

			.metadata {
				margin-top: 1rem;
				color: var(--muted);
			}
		}
	}
</style>