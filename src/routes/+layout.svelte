<script>
	import '../app.scss'
	import '@goobits/themes/themes/bundle.css'
	import { ThemeProvider } from '@goobits/themes/svelte'
	import { themeConfig } from '$lib/config/theme.js'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import ThemeSelect from '$lib/ui/ThemeSelect.svelte'
	import { footerLegalItems, footerPrimaryItems, headerNavItems } from '$lib/layout/nav'

	const { data, children } = $props()

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
	<div class="code-theme">
		<header>
			<center>
				<logo>
					<a href="/">
						<img src="/media/logo.svg" alt="logo" />
					</a>
				</logo>
				<links>
					{#each headerNavItems as item}
						<a href={item.href} class:active={$page.url.pathname === item.href}>{item.label}</a>
					{/each}
					<theme-toggle>
						<ThemeSelect />
					</theme-toggle>
				</links>
			</center>
		</header>

		<main>
			{@render children()}
		</main>

		<footer>
			<nav>
				<span class="layout-footer__group">
					{#each footerPrimaryItems as item}
						<a href={item.href}>{item.label}</a>
					{/each}
				</span>
				<span class="layout-footer__divider" aria-hidden="true"></span>
				<span class="layout-footer__group">
					{#each footerLegalItems as item}
						<a href={item.href}>{item.label}</a>
					{/each}
				</span>
			</nav>
			<small>© {new Date().getFullYear()} Miko Meow™</small>
		</footer>
	</div>
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
				color: var(--color-white);
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
					color: var(--color-white);
				}
			}

			links {
				float: right;
				font-weight: 300;
				text-transform: uppercase;

				a {
					display: inline-block;
					color: var(--color-white);
					border-bottom: 3px solid transparent;
					margin-right: 2em;
					line-height: 2em;
					text-decoration: none;

					&.active,
					&.active:hover {
						border-bottom: 3px solid var(--color-white);
						color: var(--color-white);
						pointer-events: none;
					}

					&:hover {
						border-bottom: 3px solid var(--link-hover);
					}

					&:visited {
						color: var(--color-white);
					}
				}
			}
		}
	}

	footer {
		background: var(--footer-bg) url('/media/hexabump.png');
		border-top: 1px solid var(--border);
		color: var(--color-white);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		letter-spacing: 0.05em;
		margin-top: 3rem;
		padding: 2.5rem 1rem;
		width: 100vw;

		nav {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			justify-content: center;
			gap: 0.8rem;
		}

		.layout-footer__group {
			display: inline-flex;
			align-items: center;
			gap: 1.1rem;
			flex-wrap: wrap;
			justify-content: center;
		}

		.layout-footer__divider {
			display: inline-block;
			width: 1px;
			height: 0.95rem;
			background: var(--color-white-60);
			opacity: 0.55;
		}

		a {
			color: var(--color-white);
			font-weight: 300;
			text-decoration: none;
			text-transform: uppercase;
			font-size: 0.9rem;
			border-bottom: 2px solid transparent;
			padding-bottom: 2px;
			transition: border-color 0.2s;

			&:hover {
				border-color: var(--color-white);
			}

			&:visited {
				color: var(--color-white);
			}
		}

		small {
			color: var(--color-white-60);
			font-size: 0.8rem;
			font-weight: 300;
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
						a {
							display: block;
						}
					}

					a {
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
			nav {
				gap: 0.7rem;
			}

			.layout-footer__group {
				gap: 0.9rem;
			}

			.layout-footer__divider {
				height: 0.8rem;
			}

			a {
				font-size: 0.85rem;
			}
		}
	}

	theme-toggle {
		display: inline-flex;
		align-items: center;
		margin-left: 0.5em;
		color: var(--color-white);

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
