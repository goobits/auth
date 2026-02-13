<script>
	import { Archive, Baby, Cookie, Database, Globe, Mail, RefreshCw, ShieldCheck, UserCheck } from '@lucide/svelte'
	import HeroBanner from '@components/HeroBanner.svelte'
</script>

<svelte:head>
	<title>Privacy Policy - MIKO.ART</title>
	<meta name="description" content="Privacy policy for MIKO.ART" />
</svelte:head>

<HeroBanner
	title="Privacy Policy"
	subtitle="What I collect, why, and how it is protected."
	icon="/media/emoji-privacy.png"
/>

<section class="legal-page legal legal--privacy">
	<p class="legal-updated legal__updated">Last updated: February 11, 2026</p>

	<p>
		This policy explains what personal data MIKO.ART collects, why it is collected, and what choices you have.
	</p>

	<h2><Database size={15} strokeWidth={2.2} /> What We Collect</h2>
	<ul>
		<li>Contact form details: name, email address, and message.</li>
		<li>Booking details: name, email address, seats, notes, time selection, and timezone.</li>
		<li>Account data for calendar login (when enabled): email, name, avatar, and provider account IDs.</li>
		<li>Technical data sent by browsers and infrastructure: IP address, user agent, and request metadata.</li>
	</ul>

	<h2><ShieldCheck size={15} strokeWidth={2.2} /> How We Use Data</h2>
	<ul>
		<li>To respond to contact messages.</li>
		<li>To provide and manage calendar bookings.</li>
		<li>To create and maintain login sessions.</li>
		<li>To secure the site, prevent abuse, and debug issues.</li>
	</ul>

	<h2><Cookie size={15} strokeWidth={2.2} /> Cookies and Similar Storage</h2>
	<p>
		This site uses cookies for session and login flows. These cookies are used for authentication and redirects,
		not for ad targeting.
	</p>
	<p>
		See the <a href="/cookies">Cookie Policy</a> for more detail.
	</p>

	<h2><Globe size={15} strokeWidth={2.2} /> Third Parties</h2>
	<ul>
		<li>Cloudflare (hosting and edge infrastructure).</li>
		<li>Google Calendar APIs for booking and calendar event creation.</li>
		<li>OAuth providers such as Google or Apple for login, if enabled.</li>
		<li>The contact form submits to the configured contact API endpoint.</li>
	</ul>

	<h2>Do Not Track and Global Privacy Control</h2>
	<p>
		Some browsers send "Do Not Track" (DNT) or Global Privacy Control (GPC) signals. There is no universal standard
		for DNT interpretation, so this site does not currently change behavior based solely on DNT. GPC or other legally
		required preference signals will be honored where required by applicable law.
	</p>

	<h2><Archive size={15} strokeWidth={2.2} /> Data Retention</h2>
	<p>
		Data is retained only as long as needed for site operations, security, records, and legal obligations. When no
		longer needed, data is deleted or anonymized where practical.
	</p>

	<h2><UserCheck size={15} strokeWidth={2.2} /> Your Rights</h2>
	<p>
		Depending on where you live, you may have rights to request access, correction, or deletion of personal data.
		To request this, contact <a href="mailto:hello@miko.art">hello@miko.art</a>.
	</p>

	<h2><Baby size={15} strokeWidth={2.2} /> Children</h2>
	<p>
		This site is not directed to children under 13, and personal data is not knowingly collected from children under
		13.
	</p>

	<h2><RefreshCw size={15} strokeWidth={2.2} /> Changes</h2>
	<p>
		This policy may be updated from time to time. The date at the top reflects the latest revision.
	</p>

	<h2><Mail size={15} strokeWidth={2.2} /> Contact</h2>
	<p>
		Questions about this policy can be sent to
		<a href="mailto:hello@miko.art">hello@miko.art</a>
		or through <a href="/contact">/contact</a>.
	</p>

	<p class="legal-notice legal__notice">This page is informational and is not legal advice.</p>
</section>
