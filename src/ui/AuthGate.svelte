<script lang="ts">
	import type { Snippet } from 'svelte'
	import { auth } from './auth-store.js'

	let {
		user = undefined,
		loading = undefined,
		onUnauthenticated = null,
		children,
		loadingContent,
		unauthenticated
	}: {
		user?: unknown
		loading?: boolean | undefined
		onUnauthenticated?: (() => void) | null
		children?: Snippet
		loadingContent?: Snippet
		unauthenticated?: Snippet
	} = $props()

	const resolvedUser = $derived(user ?? $auth.user ?? null)
	const resolvedLoading = $derived(loading ?? $auth.loading ?? false)

	$effect(() => {
		if (!resolvedLoading && !resolvedUser && typeof onUnauthenticated === 'function') {
			onUnauthenticated()
		}
	})
</script>

{#if resolvedLoading}
	{#if loadingContent}
		{@render loadingContent()}
	{:else}
		Loading...
	{/if}
{:else if resolvedUser}
	{@render children?.()}
{:else}
	{#if unauthenticated}
		{@render unauthenticated()}
	{:else}
		Sign in required.
	{/if}
{/if}
