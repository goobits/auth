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

	<p>
		This page describes how MIKO.ART uses cookies and similar browser storage. The short version: we use the
		minimum required to keep things working.
	</p>

	<h2>What we use cookies for</h2>
	<ul>
		<li>Authentication sessions for calendar and admin features</li>
		<li>Short-lived login context during sign-in flows</li>
		<li>Theme preferences stored in browser local storage</li>
	</ul>

	<h2>Cookie types on this site</h2>
	<ul>
		<li><strong>Essential cookies</strong> - required for login, session behavior, and security</li>
		<li><strong>Preference storage</strong> - remembers your UI theme setting</li>
	</ul>

	<p>We don't use analytics cookies, advertising cookies, or third-party tracking of any kind.</p>

	<h2>Current cookie names</h2>
	<table class="legal__cookie-table">
		<thead>
			<tr>
				<th>Cookie</th>
				<th>Purpose</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>csrf-token</code></td>
				<td>CSRF protection in authentication flows</td>
			</tr>
			<tr>
				<td><code>calendar_session</code></td>
				<td>Calendar authentication session</td>
			</tr>
			<tr>
				<td><code>admin_session</code></td>
				<td>Admin authentication session</td>
			</tr>
			<tr>
				<td><code>calendar_invite</code></td>
				<td>Short-lived context during calendar invite flow</td>
			</tr>
			<tr>
				<td><code>calendar_redirect</code></td>
				<td>Redirect target during sign-in</td>
			</tr>
		</tbody>
	</table>

	<p>
		Some cookies only appear after login or specific auth actions. Cookie names may change as features evolve. This
		policy will be updated when material changes are made.
	</p>

	<h2>Managing cookies</h2>
	<p>
		Most browsers let you block or delete cookies through their settings. Blocking essential cookies will break
		sign-in and booking features on this site.
	</p>

	<section class="legal__contact-block">
		<h2>Questions?</h2>
		<p>
			For anything cookie-related, email <a href="mailto:hello@miko.art">hello@miko.art</a>.
		</p>
	</section>
</LegalPage>
