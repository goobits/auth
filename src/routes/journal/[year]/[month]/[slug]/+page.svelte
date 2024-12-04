<script>
	let { data } = $props()
</script>

<nav>
    <a href="/journal" class="back-btn">← Back</a>
</nav>

<article>
    <div class="header">
        <h1>{data.post.metadata.fm.title}</h1>
        <div class="metadata">
            <time datetime={data.post.date.toISOString()}>
                {new Date(data.post.date).toLocaleDateString('en-US', {
					month: 'numeric',
					day: 'numeric',
					year: 'numeric'
				})}
            </time>
            {#if data.post.metadata.fm.categories}
                <div class="categories">
                    {#each data.post.metadata.fm.categories as category}
                        <span class="category">{category}</span>
                    {/each}
                </div>
            {/if}
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
			color: #666;
			text-decoration: none;
			font-family: "Source Serif Pro", serif;

			&:hover {
				text-decoration: underline;
			}
		}
	}

    article {
		font-family: "Source Serif Pro", serif;
		max-width: 700px;
		margin: 0 auto;

		:global(img) {
			max-width: 100%;
			height: auto;
		}

		.header {
			margin-bottom: 3rem;

			h1 {
				font-family: "Playfair Display", serif;
				font-size: 3rem;
				font-weight: 400;
				text-align: left;
				margin: 0;
			}

			.metadata {
				margin-top: 1rem;
				color: #666;

				.categories {
					margin-top: 0.5rem;

					.category {
						font-size: 0.875rem;
						color: #666;
						background: #f2f2f2;
						padding: 0.2rem 0.6rem;
						border-radius: 3px;
						margin: 0 0.25rem;
					}
				}
			}
		}

		.content {
			line-height: 1.6;

			:global(a) {
				color: inherit;
			}

			:global(p) {
				margin: 1.5em 0;
			}
		}
	}
</style>