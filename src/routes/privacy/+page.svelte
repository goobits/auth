<script>
	import LegalPage from '$lib/ui/LegalPage.svelte'
</script>

<svelte:head>
	<title>Privacy Policy - MIKO.ART</title>
	<meta name="description" content="Privacy policy for MIKO.ART" />
</svelte:head>

<LegalPage
	title="Privacy Policy 🔒"
	subtitle="What I collect, why, and how it is protected."
	updatedAt="February 11, 2026"
	className="legal--privacy"
	showNotice={true}
>

	<p class="legal__copy">
		This policy explains what personal data MIKO.ART collects, why it is collected, and what choices you have.
	</p>

	<h2 class="legal__section-title">What we collect</h2>
	<ul class="legal__list">
		<li class="legal__list-item">Contact form details: name, email address, and message.</li>
		<li class="legal__list-item">Booking details: name, email address, seats, notes, time selection, and timezone.</li>
		<li class="legal__list-item">Account data for calendar login (when enabled): email, name, avatar, and provider account IDs.</li>
		<li class="legal__list-item">Technical data sent by browsers and infrastructure: IP address, user agent, and request metadata.</li>
	</ul>

	<h2 class="legal__section-title">How we use data</h2>
	<ul class="legal__list">
		<li class="legal__list-item">To respond to contact messages.</li>
		<li class="legal__list-item">To provide and manage calendar bookings.</li>
		<li class="legal__list-item">To create and maintain login sessions.</li>
		<li class="legal__list-item">To secure the site, prevent abuse, and debug issues.</li>
	</ul>

	<h2 class="legal__section-title">Cookies and similar storage</h2>
	<p class="legal__copy">
		This site uses cookies for session and login flows. These cookies are used for authentication and redirects,
		not for ad targeting.
	</p>
	<p class="legal__copy">
		See the <a href="/cookies">Cookie Policy</a> for more detail.
	</p>

	<h2 class="legal__section-title">Third parties</h2>
	<ul class="legal__list">
		<li class="legal__list-item">Cloudflare (hosting and edge infrastructure).</li>
		<li class="legal__list-item">Google Calendar APIs for booking and calendar event creation.</li>
		<li class="legal__list-item">OAuth providers such as Google or Apple for login, if enabled.</li>
		<li class="legal__list-item">The contact form submits to the configured contact API endpoint.</li>
	</ul>

	<h2 class="legal__section-title">Do Not Track and Global Privacy Control</h2>
	<p class="legal__copy">
		Some browsers send "Do Not Track" (DNT) or Global Privacy Control (GPC) signals. There is no universal standard
		for DNT interpretation, so this site does not currently change behavior based solely on DNT. GPC or other legally
		required preference signals will be honored where required by applicable law.
	</p>

	<h2 class="legal__section-title">Data retention</h2>
	<p class="legal__copy">
		Data is retained only as long as needed for site operations, security, records, and legal obligations. When no
		longer needed, data is deleted or anonymized where practical.
	</p>

	<h2 class="legal__section-title">Your rights</h2>
	<p class="legal__copy">
		Depending on where you live, you may have rights to request access, correction, or deletion of personal data.
		To request this, contact <a href="mailto:hello@miko.art">hello@miko.art</a>.
	</p>

	<h2 class="legal__section-title">Children</h2>
	<p class="legal__copy">
		This site is not directed to children under 13, and personal data is not knowingly collected from children under
		13.
	</p>

	<h2 class="legal__section-title">Changes</h2>
	<p class="legal__copy">
		This policy may be updated from time to time. The date at the top reflects the latest revision.
	</p>

	<h2 class="legal__section-title">Contact</h2>
	<p class="legal__copy">
		Questions about this policy can be sent to
		<a href="mailto:hello@miko.art">hello@miko.art</a>
		or through <a href="/contact">/contact</a>.
	</p>
</LegalPage>
