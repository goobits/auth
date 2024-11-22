import { mount } from 'svelte'
import App from './App.svelte'

const app = mount(App, { target: document.body })

export default app

// Toggle hamburger menu visibility
void function () {
    const $links = document.querySelector('links')
    $links.addEventListener('click', () => {
        if (window.innerWidth < 700) {
            $links.classList.toggle('open')
        }
    })
}()