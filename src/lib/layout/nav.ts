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
	{ href: '/labs', label: 'Labs' },
	{ href: '/contact?from=footer', label: 'Contact' }
]

export const footerLegalItems: NavItem[] = [
	{ href: '/cookies', label: 'Cookies' },
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Terms' }
]

export const footerElsewhereItems: NavItem[] = [
	{ href: 'https://github.com/mudcube', label: 'GitHub', external: true },
	{ href: 'https://sketch.io', label: 'Sketch.IO', external: true }
]
