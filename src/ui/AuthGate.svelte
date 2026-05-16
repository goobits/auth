<script>
	import { auth } from "./auth-store.js";

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
