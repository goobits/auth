<script>
	/** @type {[]} */
	export let posts = []
	export let category = ''
	export let showBackButton = true
	export let type = 'category' // 'category' or 'tag'

	const formatValue = (value) => {
		return value.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
	}

	const slugifyValue = (value) => {
		return value.toLowerCase().replace(/\s+/g, '-')
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
            {#if post.metadata.fm[type === 'tag' ? 'tags' : 'categories']}
                <div class="values">
                    {#each post.metadata.fm.categories as value}
                        <a href={`/journal/category/${slugifyValue(value)}`}>
                            <span class="value">{formatValue(value)}</span>
                        </a>
                    {/each}
                    {#each post.metadata.fm.tags as value}
                        <a href={`/journal/tag/${slugifyValue(value)}`}>
                            <span class="value">{formatValue(value)}</span>
                        </a>
                    {/each}
                </div>
            {/if}
        </article>
    {/each}
</div>

<style lang="scss">
	nav {
		max-width: 700px;
		margin: 0 auto 1rem;

		.back-btn {
			color: #666;
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

	h1 {
		font-family: "Playfair Display", serif;
		font-size: 3rem;
		line-height: 3rem;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 1rem;
		padding: 1rem 2rem;
		font-weight: 500;
		margin: 0 0 2rem;
		text-align: left;
		display: flex;
	}

	article {
		margin-bottom: 3rem;
		font-family: "Source Serif Pro", serif;
	}

	h2 {
		font-weight: 400;
		font-size: 2rem;
		margin: 0;
		text-align: left;
		font-family: "Playfair Display", serif;
	}

	time {
		font-family: "Source Serif Pro", serif;
		font-size: 1rem;
		color: #666;
	}

	a {
		display: block;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.values {
		margin-top: 0.5rem;
		display: flex;

		.value {
			font-size: 0.875rem;
			color: #666;
			background: #f2f2f2;
			padding: 0.2rem 0.6rem;
			border-radius: 3px;
			margin: 0 0.25rem;
			text-decoration: none;
			display: inline-block;

			&:hover {
				background: #e5e5e5;
			}
		}
	}
</style>