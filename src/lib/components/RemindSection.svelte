<script lang="ts">
	let { remind } = $props<{ remind: { title: string; text: string; ctaLabel: string } }>();
</script>

<section class="layout__section remind" id="remind">
	<div class="layout__container">
		<div class="remind__card">
			<div>
				<h3 class="remind__title">{remind.title}</h3>
				<p class="remind__copy">{remind.text}</p>
			</div>
			<form
				class="remind__form"
				onsubmit={(event) => {
					event.preventDefault();
				}}
			>
				<input class="remind__input" type="email" placeholder="your@email.com" aria-label="Email address" />
				<button class="c-button c-button--primary" type="submit">{remind.ctaLabel}</button>
			</form>
		</div>
	</div>
</section>
