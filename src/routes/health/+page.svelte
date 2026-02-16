<script>
	const status = 'OK'
	const version = import.meta.env.PACKAGE_VERSION
</script>

<svelte:head>
	<title>Health Check - MIKO.ART</title>
</svelte:head>

<div class="health-check">
	<div class="health-check__row">
		Status:
		<span class="health-check__status" class:health-check__status--ok={status === 'OK'} class:health-check__status--error={status !== 'OK'}>{status}</span>
	</div>
	<div class="health-check__row">Version: <span class="health-check__value">{version}</span></div>
</div>

<style lang="scss">
	.health-check__row {
		font-size: 1rem;
		font-weight: 400;
	}

	.health-check__status,
	.health-check__value {
		font-weight: 500;
	}

	.health-check__status--ok {
		color: var(--status-success-text);
	}

	.health-check__status--error {
		color: var(--status-error-text);
	}
</style>
