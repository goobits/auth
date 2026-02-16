<script lang="ts">
	import { House, LogIn } from '@lucide/svelte'
	import PageShell from '$lib/ui/PageShell.svelte'
	import PillButton from '$lib/ui/buttons/PillButton.svelte'

	type SuccessPageProps = {
		title: string
		copy: string
		buttonHref: string
		buttonLabel: string
		imageSrc?: string
		imageAlt?: string
		buttonIcon?: 'home' | 'login' | 'none'
		className?: string
	}

	const {
		title,
		copy,
		buttonHref,
		buttonLabel,
		imageSrc = '/media/contact-thank-you.svg',
		imageAlt = 'Success illustration',
		buttonIcon = 'none',
		className = ''
	}: SuccessPageProps = $props()
</script>

<PageShell className={`success-page ${className}`.trim()}>
	<section class="success-page__section">
		<div class="success-page__inner">
			<img class="success-page__image" src={imageSrc} alt={imageAlt} />
			<h1 class="success-page__title">{title}</h1>
			<p class="success-page__copy">{copy}</p>
			<div class="success-page__button-row">
				<PillButton className="success-page__button" href={buttonHref} variant="primary" size="lg">
					{buttonLabel}
					{#if buttonIcon === 'home'}
						<House size={16} strokeWidth={2.2} aria-hidden="true" />
					{:else if buttonIcon === 'login'}
						<LogIn size={16} strokeWidth={2.2} aria-hidden="true" />
					{/if}
				</PillButton>
			</div>
		</div>
	</section>
</PageShell>

<style>
	.success-page__section {
		min-height: min(72vh, 42rem);
		display: grid;
		place-items: center;
		padding: var(--space-8) var(--space-6);
	}

	.success-page__inner {
		width: min(100%, 42rem);
		text-align: center;
	}

	.success-page__image {
		width: clamp(16rem, 42vw, 40rem);
		max-width: 100%;
		max-height: min(58vh, 36rem);
		height: auto;
		margin: 0 auto var(--space-8);
		display: block;
	}

	.success-page__title {
		margin: 0 0 var(--space-3);
		font-family: var(--font-serif);
		font-size: clamp(2rem, 4.2vw, 2.625rem);
		font-weight: 400;
		line-height: 1.18;
		letter-spacing: -0.025em;
		color: var(--text);
		text-wrap: balance;
	}

	.success-page__copy {
		margin: 0 0 var(--space-8);
		font-family: var(--font-sans);
		font-size: var(--font-size-base);
		line-height: 1.65;
		color: var(--muted);
		text-wrap: pretty;
	}

	.success-page__button-row {
		display: grid;
		justify-items: center;
	}

</style>
