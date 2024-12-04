<script>
	import '../app.scss'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'

    onMount(() => {
        // Toggle hamburger menu visibility
		void function () {
			const $links = document.querySelector('links')
			$links.addEventListener('click', () => {
				if (window.innerWidth < 700) {
					$links.classList.toggle('open')
				}
			})
		}()
	})
</script>

<header>
    <center>
        <logo>
            <a href="/">
                <img src="/media/logo.svg" alt="logo"/>
            </a>
        </logo>
        <links>
            <a href="/" class:active={$page.url.pathname === '/'}>Home</a>
            <a href="/about" class:active={$page.url.pathname === '/about'}>About</a>
            <a href="/contact" class:active={$page.url.pathname === '/contact'}>Contact</a>
        </links>
    </center>
</header>

<main>
    <slot/>
</main>

<footer>
    <a href="/journal">Journal</a> &middot;
    <a href="/labs">Labs</a> &middot;
    <a href="/privacy-policy">Privacy Policy</a>
    <br>
    Copyright © {new Date().getFullYear()} by MIKO.ART. All rights reserved.
</footer>