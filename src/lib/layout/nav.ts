export type NavItem = {
	href: string
	label: string
}

export const headerNavItems: NavItem[] = [
	{ href: '/', label: 'Home' },
	{ href: '/about', label: 'About' },
	{ href: '/art', label: 'Art' },
	{ href: '/music', label: 'Music' },
	{ href: '/contact', label: 'Contact' }
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
