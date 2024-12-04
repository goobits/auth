<svelte:head>
    <title>MIKO.ART - 404</title>
</svelte:head>

<div class="error-container">
    <a href="/">
        <img
                src="/media/404-cat.svg"
                alt="404 Cat"
        />
    </a>
</div>

<style>
	.error-container {
		align-items: center;
		display: flex;
		justify-content: center;
		width: 100%;

		a {
			width: 100%;
		}

		img {
			width: inherit;
			max-height: calc(100vh - 300px);
		}
	}
</style>