<script>
	import '../app.scss'
	import '@goobits/themes/themes/bundle.css'
	import { ThemeProvider } from '@goobits/themes/svelte'
	import { themeConfig } from '$lib/config/theme.js'
	import { page } from '$app/stores'
	import { browser } from '$app/environment'
	import { onMount } from 'svelte'
	import Topbar from '$lib/ui/Topbar.svelte'
	import FooterNav from '$lib/ui/FooterNav.svelte'
	import { footerElsewhereItems, footerLegalItems, footerPrimaryItems, headerNavItems } from '$lib/layout/nav'
	import { enableLayoutShiftDebug } from '$lib/client/debug/layoutShift'

	const { data, children } = $props()

	const isCalendarRoute = $derived(
		$page.url.pathname.startsWith('/calendar') ||
			$page.url.pathname.startsWith('/calendar-gym') ||
			$page.url.pathname.startsWith('/admin')
	)

	onMount(() => {
		if (!browser) return
		const url = new URL(window.location.href)
		if (url.searchParams.has('debugLayoutShift')) enableLayoutShiftDebug()
	})
</script>

<ThemeProvider config={themeConfig} serverPreferences={data.preferences}>
	<div class="code-theme">
		{#if isCalendarRoute}
			{@render children()}
		{:else}
			<Topbar items={headerNavItems} currentPath={$page.url.pathname} />

			<main>
				{@render children()}
			</main>

			<FooterNav
				primaryItems={footerPrimaryItems}
				elsewhereItems={footerElsewhereItems}
				legalItems={footerLegalItems}
			/>
		{/if}
	</div>
</ThemeProvider>
