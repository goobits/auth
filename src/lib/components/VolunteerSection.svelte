<script lang="ts">
	let { volunteer } = $props<{
		volunteer: {
			roles: { title: string; text: string; icon: string }[];
			perks: string;
		};
	}>();
</script>

<section class="layout__section volunteer" id="volunteer">
	<div class="layout__container">
		<div class="volunteer__banner">
			<p class="layout__eyebrow layout__eyebrow--inverse">Get involved</p>
			<h2 class="layout__title volunteer__title">Volunteer for a 90-minute shift</h2>
			<p class="volunteer__copy">Most roles are simple: stand at a turn, cheer, and help people stay on route.</p>
			<a class="c-button c-button--inverted c-button--large" href="/volunteer">Sign Up to Volunteer</a>
			<p class="volunteer__perk">{volunteer.perks}</p>
		</div>
		<div class="volunteer__grid">
			{#each volunteer.roles as role (role.title)}
				<article class="c-card volunteer__role">
					<div class="volunteer__role-icon" aria-hidden="true">{role.icon}</div>
					<h3 class="volunteer__role-title">{role.title}</h3>
					<p class="volunteer__role-copy">{role.text}</p>
				</article>
			{/each}
		</div>
	</div>
</section>
