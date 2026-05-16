<script>
	import { readable } from "svelte/store";

	const emptyAuth = readable({ user: null, loading: false });

	export let auth = emptyAuth;
	export let user = undefined;
	export let loading = undefined;
	export let onUnauthenticated = null;

	$: resolvedUser = user ?? $auth.user ?? null;
	$: resolvedLoading = loading ?? $auth.loading ?? false;

	$: if (!resolvedLoading && !resolvedUser && typeof onUnauthenticated === "function") {
		onUnauthenticated();
	}
</script>

{#if resolvedLoading}
	<slot name="loading">Loading…</slot>
{:else if resolvedUser}
	<slot />
{:else}
	<slot name="unauthenticated">Sign in required.</slot>
{/if}
