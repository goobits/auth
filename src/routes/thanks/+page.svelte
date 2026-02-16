<script lang="ts">
	let { data } = $props<{ data: { type: string } }>();

	const fallbackCopy = {
		title: 'Thank you',
		body: 'Your submission was received.'
	};

	const copyMap: Record<string, { title: string; body: string }> = {
		join: {
			title: 'You are in the herd!',
			body: 'Your attendee signup was received. We will send event details before race day.'
		},
		volunteer: {
			title: 'Thanks for volunteering!',
			body: 'Your volunteer form is in. We will follow up with role and shift details.'
		},
		remind: {
			title: 'Reminder saved',
			body: 'You are on the reminder list. We will send one pre-event email.'
		},
		donate: {
			title: 'Thank you for donating',
			body: 'Your support helps keep the event welcoming and community-powered.'
		},
		general: fallbackCopy
	};

	const copy = $derived.by<{ title: string; body: string }>(
		() => copyMap[data.type] ?? fallbackCopy
	);
</script>

<svelte:head>
	<title>Thanks | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card flow-page__card--narrow">
			<h1 class="layout__title">{copy.title}</h1>
			<p class="flow-page__copy">{copy.body}</p>
			<div class="flow-links">
				<a class="c-button c-button--primary" href="/">Back Home</a>
				<a class="c-button c-button--secondary" href="/donate">Donate</a>
			</div>
		</div>
	</div>
</section>
