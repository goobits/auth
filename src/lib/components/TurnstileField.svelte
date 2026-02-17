<script lang="ts">
	import { env } from '$env/dynamic/public';

	let { action } = $props<{ action: 'join' | 'volunteer' | 'remind' }>();
</script>

{#if env.PUBLIC_TURNSTILE_SITE_KEY}
	<div class="turnstile-field">
		<div class="cf-turnstile" data-sitekey={env.PUBLIC_TURNSTILE_SITE_KEY} data-action={action}></div>
	</div>
{:else}
	<p class="turnstile-field__notice">Anti-bot check is not configured yet.</p>
{/if}
