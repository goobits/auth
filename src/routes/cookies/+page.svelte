<script>
	import { Cookie, KeyRound, Mail, Settings2 } from '@lucide/svelte'
	import LegalPage from '$lib/ui/LegalPage.svelte'
</script>

<svelte:head>
	<title>Cookie Policy - MIKO.ART</title>
	<meta name="description" content="Cookie policy for MIKO.ART" />
</svelte:head>

<LegalPage
	title="Cookie Policy"
	subtitle="What cookies do here, and what they do not."
	icon="/media/emoji-cookies.png"
	updatedAt="February 11, 2026"
	className="legal--cookies"
>

	<p>
		This page describes how MIKO.ART uses cookies and similar browser storage.
	</p>

	<h2><Cookie size={15} strokeWidth={2.2} /> What We Use Cookies For</h2>
	<ul>
		<li>Authentication sessions for calendar and admin features.</li>
		<li>Short-lived login context (for invite and redirect flow during sign-in).</li>
		<li>Theme preferences stored in browser local storage.</li>
	</ul>

	<h2><Cookie size={15} strokeWidth={2.2} /> Cookie Types on This Site</h2>
	<ul>
		<li><strong>Essential cookies</strong>: required for login/session behavior and security.</li>
		<li><strong>Preference storage</strong>: used to remember UI theme settings.</li>
	</ul>

	<h2><KeyRound size={15} strokeWidth={2.2} /> Current Cookie Names</h2>
	<ul>
		<li><code>csrf-token</code> for CSRF protection in authentication flows.</li>
		<li><code>calendar_session</code> for calendar authentication sessions.</li>
		<li><code>admin_session</code> for admin authentication sessions.</li>
		<li><code>calendar_invite</code> and <code>calendar_redirect</code> for short login-flow context.</li>
	</ul>

	<p>
		Some cookies (such as session cookies) appear only after login or specific auth actions. Cookie names may change
		as features evolve. This policy will be updated when material changes are made.
	</p>

	<h2><Settings2 size={15} strokeWidth={2.2} /> How to Manage Cookies</h2>
	<p>
		Most browsers let you block or delete cookies. Blocking essential cookies can break sign-in and booking features.
	</p>

	<h2><Mail size={15} strokeWidth={2.2} /> Contact</h2>
	<p>
		For cookie questions, email <a href="mailto:hello@miko.art">hello@miko.art</a>.
	</p>
</LegalPage>
