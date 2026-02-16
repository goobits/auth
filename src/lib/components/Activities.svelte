<script lang="ts">
	let { activities } = $props<{
		activities: { title: string; text: string; detail: string; icon: string }[];
	}>();
	let open = $state<number | null>(null);
</script>

<section class="layout__section activities" id="activities">
	<div class="layout__container">
		<h2 class="layout__title">The day at a glance</h2>
		<div class="activities__grid">
			{#each activities as item, i}
				<article class="c-card activities__card">
					<p class="activities__icon" aria-hidden="true">
						{item.icon === 'bike'
							? '🚲'
							: item.icon === 'run'
								? '🏃'
								: item.icon === 'yoga'
									? '🧘'
									: '🎪'}
					</p>
					<h3 class="activities__title">{item.title}</h3>
					<p class="activities__copy">{item.text}</p>
					{#if item.detail}
						<button
							class="activities__toggle"
							type="button"
							onclick={() => (open = open === i ? null : i)}
							aria-expanded={open === i}
						>
							Learn more
						</button>
						{#if open === i}
							<p class="activities__detail">{item.detail}</p>
						{/if}
					{/if}
				</article>
			{/each}
		</div>
	</div>
</section>
