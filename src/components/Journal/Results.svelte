<script>
	import MetadataValues from '@components/Journal/MetadataValues.svelte'

	/** @type {[]} */
	export let posts = []
	export let category = ''
	export let showBackButton = true
	/** @type {'category' | 'tag'} */
	export const type = 'category'

	const formatValue = (value) => {
		return value.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}
</script>

<svelte:head>
    <title>{formatValue(category)} - MIKO.ART</title>
</svelte:head>

{#if showBackButton}
    <nav>
        <a href="/journal" class="back-btn">← Back</a>
    </nav>
{/if}

<div class="posts">
    <h1>
        {formatValue(category)}
    </h1>
    {#each posts as post}
        <article>
            <h2>
                <a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
                <time>{new Date(post.date).toLocaleDateString('en-US', {
					month: 'numeric',
					day: 'numeric',
					year: 'numeric'
				})}</time>
            </h2>
            <div style="display: flex">
                {#if post.metadata.fm.categories}
                    <MetadataValues values={post.metadata.fm.categories} type="category"/>
                {/if}
                {#if post.metadata.fm.tags}
                    <MetadataValues values={post.metadata.fm.tags} type="tag"/>
                {/if}
            </div>
        </article>
    {/each}
</div>

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

	.posts {
		max-width: 700px;
		margin: 0 auto;
	}

	article {
		margin-bottom: 3rem;
		font-family: "Source Serif Pro", serif;
	}

	h1 {
		font-family: "Playfair Display", serif;
		font-size: 3rem;
		line-height: 3rem;
		background: var(--shadow-panel);
		border-radius: 1rem;
		padding: 1rem 2rem;
		font-weight: 500;
		margin: 0 0 2rem;
		text-align: left;
		display: flex;
	}

	h2 {
		font-weight: 400;
		font-size: 2rem;
		margin: 0;
		text-align: left;
		font-family: "Playfair Display", serif;

		a {
			display: block;
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}
	}

	time {
		font-family: "Source Serif Pro", serif;
		font-size: 1rem;
		color: var(--muted);
	}
</style>