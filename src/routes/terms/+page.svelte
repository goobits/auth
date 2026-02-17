<script>
	import { LegalPage } from '@miko/ui'
</script>

<svelte:head>
	<title>Terms of Use - MIKO.ART</title>
	<meta name="description" content="Terms of use for MIKO.ART" />
</svelte:head>

<LegalPage
	title="Terms of Use"
	icon="/media/terms-justice.png"
	subtitle="A quick guide to using this site smoothly."
	updatedAt="February 11, 2026"
	className="legal--terms"
	showNotice={true}
>

	<p class="legal__copy">
		By using MIKO.ART, you agree to these terms. If you do not agree, do not use the site.
	</p>

	<h2 class="legal__section-title">Use of the site</h2>
	<ul class="legal__list">
		<li class="legal__list-item">Use the site lawfully and in good faith.</li>
		<li class="legal__list-item">Do not attempt to disrupt, overload, or abuse site infrastructure.</li>
		<li class="legal__list-item">Do not attempt unauthorized access to accounts, sessions, or admin areas.</li>
	</ul>

	<h2 class="legal__section-title">Bookings and accounts</h2>
	<ul class="legal__list">
		<li class="legal__list-item">When booking events, provide accurate information.</li>
		<li class="legal__list-item">You are responsible for activity associated with your session or account.</li>
		<li class="legal__list-item">Bookings may be changed or canceled according to the booking flow and availability rules.</li>
	</ul>

	<h2 class="legal__section-title">Intellectual property</h2>
	<p class="legal__copy">
		Unless otherwise noted, site content is owned by MIKO.ART and protected by applicable intellectual property laws.
	</p>

	<h2 class="legal__section-title">Third-party services</h2>
	<p class="legal__copy">
		The site may rely on third-party services (for example, Cloudflare, Google, Apple). Their terms and policies
		also apply where relevant.
	</p>

	<h2 class="legal__section-title">No warranty</h2>
	<p class="legal__copy">
		The site is provided "as is" and "as available" without warranties of any kind, to the extent permitted by
		law.
	</p>

	<h2 class="legal__section-title">Limitation of liability</h2>
	<p class="legal__copy">
		To the maximum extent permitted by law, MIKO.ART is not liable for indirect, incidental, special, consequential,
		or punitive damages arising from use of the site.
	</p>

	<h2 class="legal__section-title">Governing law</h2>
	<p class="legal__copy">
		These terms are governed by the laws of the State of Oregon, United States, without regard to conflict of law
		principles.
	</p>

	<h2 class="legal__section-title">Changes to terms</h2>
	<p class="legal__copy">
		These terms may be updated at any time. Continued use after updates means you accept the revised terms.
	</p>

	<h2 class="legal__section-title">Contact</h2>
	<p class="legal__copy">
		Questions about these terms can be sent to <a href="mailto:hello@miko.art">hello@miko.art</a>.
	</p>
</LegalPage>
