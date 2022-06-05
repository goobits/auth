import App from './App.svelte'

new App({
	target: document.body
})

// Toggle hamburger menu visibility
void function () {
	const $links = document.querySelector('links')
	$links.addEventListener('click', () => {
		if (window.innerWidth < 700) {
			$links.classList.toggle('open')
		}
	})
}()