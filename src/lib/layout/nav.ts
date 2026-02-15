export type NavItem = {
	href: string
	label: string
	matchPrefix?: boolean
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
	{ href: '/sitemap', label: 'Sitemap' }
]

export const footerLegalItems: NavItem[] = [
	{ href: '/cookies', label: 'Cookies' },
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/terms', label: 'Terms' }
]
