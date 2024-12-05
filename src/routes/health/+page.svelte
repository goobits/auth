<script>
	let status = 'OK'
</script>

<svelte:head>
    <title>Health Check - MIKO.ART</title>
</svelte:head>

<div class="health">
    <h1>Status: <span class={status.toLowerCase()}>{status}</span></h1>
</div>

<style lang="scss">
	.health {
		h1 {
			font-size: 1rem;
			font-weight: 400;

			span.ok {
				color: #22c55e;
			}

			span.error {
				color: #ef4444;
			}
		}
	}
</style>