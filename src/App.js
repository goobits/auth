import App from './App.svelte'

new App({
	target: document.body
})

document.querySelector('links').addEventListener('click', () => {
	if (window.innerWidth < 700) {
		document.querySelector('links').classList.toggle('open')
	}
})