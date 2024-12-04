/** @type {Array<Object>} */
export const redirects = [
	{ from: '/bg*', to: '/labs/zen-bg', status: 301 },
	{ from: '/journal/human*', to: '/about', status: 301 },
	{ from: '/labs/js1k(.*)', to: '/labs/js1k$1', status: 301 },
	{ from: '/labs/piano*', to: 'https://colorpiano.com', status: 301 },
	{ from: '/midi-js*', to: '/labs/midi-js', status: 301 },
	{ from: '/piano*', to: 'https://colorpiano.com', status: 301 },
	{ from: '/sketch-js*', to: '/labs/sketch-js', status: 301 },
	{ from: '/sketchpad*', to: '/labs/sketchpad-1.0', status: 301 },
	{ from: '/software*', to: '/', status: 301 },
	{ from: '/software/Thumbnailer*', to: '/labs/thumbnailer', status: 301 },
	{ from: '/sphere*', to: 'https://colorsphere.app', status: 301 }
]