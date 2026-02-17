<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/main.scss';

	let { children } = $props<{ children: Snippet }>();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

{@render children()}
