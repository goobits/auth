<script>
	import LegalPage from '$lib/ui/LegalPage.svelte'
</script>

<svelte:head>
	<title>Cookie Policy - MIKO.ART</title>
	<meta name="description" content="Cookie policy for MIKO.ART" />
</svelte:head>

<LegalPage
	title="Cookie Policy 🍪"
	subtitle="What cookies do here, and what they don't."
	updatedAt="February 11, 2026"
	className="legal--cookies"
>

	<p class="legal__copy">
		This page describes how MIKO.ART uses cookies and similar browser storage. The short version: we use the
		minimum required to keep things working.
	</p>

	<h2 class="legal__section-title">What we use cookies for</h2>
	<ul class="legal__list">
		<li class="legal__list-item">Authentication sessions for calendar and admin features</li>
		<li class="legal__list-item">Short-lived login context during sign-in flows</li>
		<li class="legal__list-item">Theme preferences stored in browser local storage</li>
	</ul>

	<h2 class="legal__section-title">Cookie types on this site</h2>
	<ul class="legal__list">
		<li class="legal__list-item"><strong class="legal__strong">Essential cookies</strong> - required for login, session behavior, and security</li>
		<li class="legal__list-item"><strong class="legal__strong">Preference storage</strong> - remembers your UI theme setting</li>
	</ul>

	<p class="legal__copy">We don't use analytics cookies, advertising cookies, or third-party tracking of any kind.</p>

	<h2 class="legal__section-title">Current cookie names</h2>
	<table class="legal__cookie-table">
		<thead>
			<tr>
				<th class="legal__cookie-header">Cookie</th>
				<th class="legal__cookie-header">Purpose</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td class="legal__cookie-cell legal__cookie-cell--name"><code class="legal__inline-code">csrf-token</code></td>
				<td class="legal__cookie-cell">CSRF protection in authentication flows</td>
			</tr>
			<tr>
				<td class="legal__cookie-cell legal__cookie-cell--name"><code class="legal__inline-code">calendar_session</code></td>
				<td class="legal__cookie-cell">Calendar authentication session</td>
			</tr>
			<tr>
				<td class="legal__cookie-cell legal__cookie-cell--name"><code class="legal__inline-code">admin_session</code></td>
				<td class="legal__cookie-cell">Admin authentication session</td>
			</tr>
			<tr>
				<td class="legal__cookie-cell legal__cookie-cell--name"><code class="legal__inline-code">calendar_invite</code></td>
				<td class="legal__cookie-cell">Short-lived context during calendar invite flow</td>
			</tr>
			<tr>
				<td class="legal__cookie-cell legal__cookie-cell--name"><code class="legal__inline-code">calendar_redirect</code></td>
				<td class="legal__cookie-cell">Redirect target during sign-in</td>
			</tr>
		</tbody>
	</table>

	<p class="legal__copy">
		Some cookies only appear after login or specific auth actions. Cookie names may change as features evolve. This
		policy will be updated when material changes are made.
	</p>

	<h2 class="legal__section-title">Managing cookies</h2>
	<p class="legal__copy">
		Most browsers let you block or delete cookies through their settings. Blocking essential cookies will break
		sign-in and booking features on this site.
	</p>

	<section class="legal__contact-block">
		<h2 class="legal__section-title legal__section-title--compact">Questions?</h2>
		<p class="legal__copy">
			For anything cookie-related, email <a href="mailto:hello@miko.art">hello@miko.art</a>.
		</p>
	</section>
</LegalPage>
