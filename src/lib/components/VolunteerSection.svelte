<script lang="ts">
	let { volunteer } = $props<{
		volunteer: { roles: { title: string; text: string }[]; signupUrl: string };
	}>();
</script>

<section class="layout__section volunteer" id="volunteer">
	<div class="layout__container">
		<div class="volunteer__hero">
			<h2 class="layout__title">Volunteer for a 90-minute shift</h2>
			<p class="volunteer__copy">
				Volunteering is easy here. Most roles are stand at a turn, cheer, and help people stay on
				the route.
			</p>
			<a class="c-button c-button--primary" href={volunteer.signupUrl}>Volunteer signup</a>
			<p class="volunteer__perk">Snacks, gratitude, and a volunteer patch/sticker.</p>
		</div>
		<div class="volunteer__grid">
			{#each volunteer.roles as role}
				<article class="c-card volunteer__role">
					<h3 class="volunteer__role-title">{role.title}</h3>
					<p class="volunteer__role-copy">{role.text}</p>
				</article>
			{/each}
		</div>
	</div>
</section>
