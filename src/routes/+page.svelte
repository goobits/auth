<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import MobileCtaBar from '$lib/components/MobileCtaBar.svelte';
	import Hero from '$lib/components/Hero.svelte';
	import QuickFacts from '$lib/components/QuickFacts.svelte';
	import Activities from '$lib/components/Activities.svelte';
	import ScheduleTimeline from '$lib/components/ScheduleTimeline.svelte';
	import RoutesTabs from '$lib/components/RoutesTabs.svelte';
	import BringList from '$lib/components/BringList.svelte';
	import DonateSection from '$lib/components/DonateSection.svelte';
	import SponsorsSection from '$lib/components/SponsorsSection.svelte';
	import VolunteerSection from '$lib/components/VolunteerSection.svelte';
	import FaqAccordion from '$lib/components/FaqAccordion.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { site } from '$lib/content/site';
</script>

<svelte:head>
	<title>{site.meta.title}</title>
	<meta name="description" content={site.meta.description} />
	<meta property="og:title" content={site.meta.ogTitle} />
	<meta property="og:description" content={site.meta.ogDescription} />
	<meta property="og:image" content={site.meta.ogImage} />
	<meta property="og:image:alt" content={site.meta.ogImageAlt} />
</svelte:head>

<Header nav={site.nav} />
<main>
	<Hero {...site.hero} />
	<QuickFacts facts={site.quickFacts} />
	<Activities activities={site.activities} />
	<ScheduleTimeline items={site.schedule} />
	<RoutesTabs routes={site.routes} />
	<BringList items={site.bring} />
	<DonateSection donation={site.donation} />
	<SponsorsSection sponsors={site.sponsors} />
	<VolunteerSection volunteer={site.volunteer} />
	<FaqAccordion faqs={site.faq} />
</main>
<Footer line={site.footer.line} year={site.footer.year} />
<MobileCtaBar />
