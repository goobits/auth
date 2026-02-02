<script>
	let { data } = $props()
</script>

<svelte:head>
    <title>Journal - MIKO.ART</title>
</svelte:head>


<div class="posts">
    <h1>Journal</h1>
    {#each data.posts as post}
        <article>
            <h2>
                <a href={`/${post.urlPath}`}>{post.metadata.fm.title}</a>
                <time>{new Date(post.date).toLocaleDateString('en-US', {
					month: 'numeric',
					day: 'numeric',
					year: 'numeric'
				})}</time>
            </h2>
            {#if post.metadata.fm.categories}
                <div class="categories">
                    {#each post.metadata.fm.categories as category}
                        <span class="category">{category}</span>
                    {/each}
                </div>
            {/if}
        </article>
    {/each}
</div>

<style>
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
		border-bottom: 3px solid var(--border);
		padding-bottom: 1rem;
		font-weight: 500;
		margin: 0 0 2rem;
		text-align: left;
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
		color: var(--muted);
	}

	a {
		display: block;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.categories {
		margin-top: 0.5rem;
	}

	.category {
		font-size: 0.875rem;
		color: var(--muted);
		background: var(--tag-bg);
		padding: 0.2rem 0.6rem;
		border-radius: 3px;
		margin-right: 0.5rem;
	}
</style>