<script>
	const {
		category,
		count,
		collapsed = false,
		onToggle,
		routes = [],
		getRouteTags,
		formatDate,
		icon: Icon,
		ChevronDownIcon,
		ChevronRightIcon
	} = $props()
</script>

<section class="sitemap-page__category">
	<button class="sitemap-page__category-header" onclick={onToggle}>
		<h2>
			{#if Icon}
				<Icon class="sitemap-page__category-icon" size={14} strokeWidth={2.2} />
			{/if}
			{#if collapsed}
				<ChevronRightIcon class="sitemap-page__toggle-icon" size={14} strokeWidth={2.25} />
			{:else}
				<ChevronDownIcon class="sitemap-page__toggle-icon" size={14} strokeWidth={2.25} />
			{/if}
			{category}
			<span class="sitemap-page__count">({count})</span>
		</h2>
	</button>

	{#if !collapsed}
		<ul class="sitemap-page__route-list">
			{#each routes as route}
				<li class="sitemap-page__route">
					<div class="sitemap-page__route-main">
						{#if route.type === 'api'}
							<span class="sitemap-page__route-path">{route.path}</span>
							{#if route.httpMethods?.length > 0}
								<span class="sitemap-page__methods">
									{#each route.httpMethods as method}
										<span class={`sitemap-page__method sitemap-page__method--${method.toLowerCase()}`}>{method}</span>
									{/each}
								</span>
							{/if}
						{:else}
							{#if route.isDynamic}
								<span class="sitemap-page__route-path">{route.path}</span>
							{:else}
								<a href={route.path} class="sitemap-page__route-link">{route.path}</a>
							{/if}
						{/if}
					</div>
					<div class="sitemap-page__route-meta">
						<div class="sitemap-page__tags">
							{#each getRouteTags(route) as tag}
								<span class={`sitemap-page__tag sitemap-page__tag--${tag.toLowerCase()}`}>{tag}</span>
							{/each}
						</div>
						<span class="sitemap-page__modified">{formatDate(route.lastModified)}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
