<script lang="ts">
	let { faqs } = $props<{ faqs: { q: string; a: string }[] }>();
	let open = $state<number | null>(0);
</script>

<section class="layout__section faq" id="faq">
	<div class="layout__container">
		<p class="layout__eyebrow">Questions</p>
		<h2 class="layout__title faq__title">FAQ</h2>
		<div class="faq__list">
			{#each faqs as item, i (item.q)}
				<article class={`faq__item ${open === i ? 'faq__item--open' : ''}`}>
					<button class="faq__button" type="button" onclick={() => (open = open === i ? null : i)} aria-expanded={open === i}>
						<span>{item.q}</span>
						<span class="faq__chevron" aria-hidden="true">▾</span>
					</button>
					<div class="faq__answer-wrap">
						{#if open === i}
							<p class="faq__answer">{item.a}</p>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>
