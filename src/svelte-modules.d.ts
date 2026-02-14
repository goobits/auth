declare module '*.svelte' {
	import type { Component } from 'svelte'

	const SvelteComponent: Component
	export default SvelteComponent
}
