export type NavItem = {
	href: string
	label: string
	matchPrefix?: boolean
	external?: boolean
}

export const headerNavItems: NavItem[] = [
	{ href: '/art', label: 'Art', matchPrefix: true },
	{ href: '/music', label: 'Music', matchPrefix: true },
	{ href: '/about', label: 'About' },
	{ href: '/contact?from=topbar', label: 'Contact', matchPrefix: true }
]

export const footerPrimaryItems: NavItem[] = [
	{ href: '/journal', label: 'Journal' },
	{ href: '/labs', label: 'Labs' }
]

export const footerLegalItems: NavItem[] = [
	{ href: '/cookies', label: 'Cookies' },
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Terms' }
]

export const footerElsewhereItems: NavItem[] = [
	{ href: 'https://beheremeow.app', label: 'BeHereMeow', external: true },
	{ href: 'https://colorpiano.com', label: 'ColorPiano', external: true },
	{ href: 'https://github.com/mudcube', label: 'GitHub', external: true },
	{ href: 'https://sketch.io', label: 'Sketch.IO', external: true }
]
