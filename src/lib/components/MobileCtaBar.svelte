<script lang="ts">
	import { onMount } from 'svelte';

	let visible = $state(false);

	onMount(() => {
		const onScroll = () => {
			visible = window.scrollY > 520;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
		};
	});
</script>

{#if visible}
	<div class="mobile-cta" aria-label="Quick actions">
		<a href="/join" class="mobile-cta__link mobile-cta__link--join">Join</a>
		<a href="/donate" class="mobile-cta__link mobile-cta__link--donate">Donate</a>
	</div>
{/if}
