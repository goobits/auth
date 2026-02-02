<script>
	const status = 'OK'
	const version = import.meta.env.PACKAGE_VERSION
</script>

<svelte:head>
	<title>Health Check - MIKO.ART</title>
</svelte:head>

<div class="health">
	<div class="info-row">Status: <span class={status.toLowerCase()}>{status}</span></div>
	<div class="info-row">Version: <span>{version}</span></div>
</div>

<style lang="scss">
	.health {
		.info-row {
			font-size: 1rem;
			font-weight: 400;

			span {
				font-weight: 500;

				&.ok {
					color: var(--status-success-text);
				}

				&.error {
					color: var(--status-error-text);
				}
			}
		}
	}
</style>