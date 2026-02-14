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
		<span class:ok={status === 'OK'} class:error={status !== 'OK'}>{status}</span>
	</div>
	<div class="health-check__row">Version: <span>{version}</span></div>
</div>

<style lang="scss">
	.health-check__row {
		font-size: 1rem;
		font-weight: 400;

		:global(span) {
			font-weight: 500;

			&.ok {
				color: var(--status-success-text);
			}

			&.error {
				color: var(--status-error-text);
			}
		}
	}
</style>
