<script lang="ts">
	import AuthGate from '../../../src/ui/AuthGate.svelte'

	let {
		user = null,
		loading = false,
		onUnauthenticated = () => {}
	}: {
		user?: unknown
		loading?: boolean
		onUnauthenticated?: () => void
	} = $props()
</script>

{#snippet authenticated()}
	<p>Account ready</p>
{/snippet}

{#snippet loadingContent()}
	<p>Checking account</p>
{/snippet}

{#snippet unauthenticated()}
	<p>Please sign in</p>
{/snippet}

<AuthGate
	{user}
	{loading}
	{onUnauthenticated}
	children={authenticated}
	{loadingContent}
	{unauthenticated}
/>
