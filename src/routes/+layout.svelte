<script>
	import '../app.scss'
	import '@goobits/themes/themes/bundle.css'
	import { ThemeProvider, ThemeToggle } from '@goobits/themes/svelte'
	import { themeConfig } from '$lib/config/theme.js'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'

	const { data } = $props()

	onMount(() => {
		// Toggle hamburger menu visibility
		const links = document.querySelector('links')
		if (links) {
			links.addEventListener('click', () => {
				if (window.innerWidth < 700) {
					links.classList.toggle('open')
				}
			})
		}
	})
</script>

<ThemeProvider config={themeConfig} serverPreferences={data.preferences}>
	<header>
		<center>
			<logo>
				<a href="/">
					<img src="/media/logo.svg" alt="logo" />
				</a>
			</logo>
			<links>
				<a href="/" class:active={$page.url.pathname === '/'}>Home</a>
				<a href="/about" class:active={$page.url.pathname === '/about'}>About</a>
				<a href="/contact" class:active={$page.url.pathname === '/contact'}>Contact</a>
				<theme-toggle>
					<ThemeToggle />
				</theme-toggle>
			</links>
		</center>
	</header>

	<main>
		<slot />
	</main>

	<footer>
		<a href="/journal">Journal</a> &middot;
		<a href="/labs">Labs</a> &middot;
		<a href="/privacy-policy">Privacy Policy</a>
		<br>
		Copyright © {new Date().getFullYear()} by MIKO MEOW™. All rights reserved.
	</footer>
</ThemeProvider>

<style>
	header {
		background: var(--header-bg) url('/media/hexabump.png');
		border-bottom: 1px solid var(--border);
		box-shadow: none;
		display: block;
		height: 120px;
		line-height: 120px;
		letter-spacing: 0.05em;
		white-space: nowrap;
		width: 100vw;

		center {
			margin: 0 auto;
			max-width: var(--max-width);
			width: calc(100% - 2em);
			height: inherit;

			logo {
				color: white;
				float: left;
				height: inherit;
				width: 220px;
				display: grid;
				align-items: center;

				img {
					display: inline-block;
				}

				a {
					display: inline-block;
					text-decoration: none;
					color: white;
				}
			}

			links {
				float: right;
				font-weight: 300;
				text-transform: uppercase;

				a {
					display: inline-block;
					color: white;
					border-bottom: 3px solid transparent;
					margin-right: 2em;
					line-height: 2em;
					transform: scaleY(1.1);
					text-decoration: none;

					&.active,
					&.active:hover {
						border-bottom: 3px solid white;
						color: white;
						pointer-events: none;
					}

					&:hover {
						border-bottom: 3px solid var(--link-hover);
					}

					&:visited {
						color: white;
					}
				}

				img {
					width: 40px;
				}
			}
		}
	}

	footer {
        background: var(--footer-bg) url('/media/hexabump.png');
        border-top: 1px solid var(--border);
		color: white;
		display: block;
		font-style: italic;
		font-weight: 100;
		line-height: 3rem;
		letter-spacing: 0.05em;
		margin-top: 3rem;
		padding: 2rem 0;
		text-align: center;
		white-space: nowrap;
		width: 100vw;

		a {
			color: white;
			font-weight: 300;

			&:visited {
				color: white;
			}
		}
	}

	@media (max-width: 700px) {
		header {
			center {
				links {
                    background: var(--header-bg) url('/media/hexabump.png');
                    border-radius: 5px;
					padding: 0 1em;
					position: absolute;
					right: 0;
					text-align: right;

					&:before {
						content: "🍔";
						cursor: pointer;
						display: block;
						font-size: 2em;
					}

					:global(&.open) {
						a,
						a[aria-current] {
							display: block;
						}
					}

					a,
					a[aria-current] {
						margin: 0;
						border-bottom: none !important;
						text-align: left;
						display: none;
						position: relative;
						top: -0.5em;
					}
				}
			}
		}

		footer {
			font-size: max(1em, 2.5vw);
		}
	}

	theme-toggle {
		display: inline-flex;
		align-items: center;
		margin-left: 0.5em;
		color: white;

		:global(button) {
			padding: 0;
			background: transparent;
		}

		:global(svg) {
			width: 24px;
			height: 24px;
		}
	}
</style>
