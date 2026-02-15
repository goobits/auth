<svelte:head>
    <title>Thank You - MIKO.ART</title>
</svelte:head>

<div class="home__hero thank-you thank-you__hero">
    <style>
		body {
			background: var(--accent-bg);
		}

		main {
			h1 {
				img {
					max-height: calc(100vh - 28.125rem);
				}
			}

			h2 {
				line-height: 1.33em;
				margin-top: 0;
				color: var(--button-text);
				text-shadow: none;
			}
		}
    </style>
    <h1>
        <img class="thank-you__image" src="/media/contact-thank-you.svg" alt=""/>
    </h1>
    <h2 class="thank-you__message">
        Thank you for your message!<br>
        I'll get back to you as soon as possible :)
    </h2>
</div>
