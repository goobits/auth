<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/main.scss';

	let { children } = $props<{ children: Snippet }>();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
