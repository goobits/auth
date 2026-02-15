/**
 * ★ IMPORTANT ★
 * Sync with NGINX configuration:
 * /etc/nginx/sites-available/miko.art
 */

/** @type {Array<Object>} */
export const redirects = [
	{ from: '/privacy-policy*', to: '/privacy', status: 301 },
	{ from: '/bg*', to: '/labs/zen-bg/', status: 301 },
	{ from: '/journal/human*', to: '/about/', status: 301 },
	{ from: '/labs/piano*', to: 'https://colorpiano.com', status: 301 },
	{ from: '/labs/Color-Vision*', to: '/labs/color-vision/', status: 301 },
	{ from: '/labs/HTML5Rocks*', to: '/labs/html5rocks/', status: 301 },
	{ from: '/labs/Music-Box*', to: '/labs/', status: 301 },
	{ from: '/labs/Typography*', to: '/labs/typography/', status: 301 },
	{ from: '/midi-js*', to: '/labs/midi-js/', status: 301 },
	{ from: '/piano*', to: 'https://colorpiano.com', status: 301 },
	{ from: '/sketch-js*', to: '/labs/sketch-js/', status: 301 },
	{ from: '/sketchpad*', to: '/labs/sketchpad-1.0/', status: 301 },
	{ from: '/software*', to: '/', status: 301 },
	{ from: '/software/Thumbnailer*', to: '/labs/thumbnailer/', status: 301 },
	{ from: '/sphere*', to: 'https://colorsphere.app', status: 301 }
]
