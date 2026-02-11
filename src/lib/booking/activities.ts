export type CalendarActivityConfig = {
	slug: 'gym' | 'circus' | 'adventure' | 'movie-night'
	href: `/calendar/${'gym' | 'circus' | 'adventure' | 'movie-night'}`
	label: string
	activityName: string
	pageTitle: string
	eyebrow: string
	eyebrowClass?: string
	glowClass?: string
	formGlowClass?: string
	heroTitleLines: [string] | [string, string]
	heroSubtitle: string
	description: string
	icon: string
}

export const CALENDAR_ACTIVITIES: Record<CalendarActivityConfig['slug'], CalendarActivityConfig> = {
	gym: {
		slug: 'gym',
		href: '/calendar/gym',
		label: 'Gym',
		activityName: 'Rainbow Gym',
		pageTitle: 'Gym | Rainbow Gym | MIKO.ART',
		eyebrow: 'Rainbow Gym',
		heroTitleLines: ['Hang out. Work out.', 'Whatever.'],
		heroSubtitle: "Grab a time slot and let's do something fun together.",
		description: 'Book sessions and work out together',
		icon: '💪'
	},
	circus: {
		slug: 'circus',
		href: '/calendar/circus',
		label: 'Circus',
		activityName: 'Rainbow Circus',
		pageTitle: 'Circus | Rainbow Gym | MIKO.ART',
		eyebrow: 'Rainbow Circus',
		eyebrowClass: 'eyebrow-circus',
		glowClass: 'glow-circus',
		formGlowClass: 'form-glow-circus',
		heroTitleLines: ['Fly high. Spin fast.', 'Be brave.'],
		heroSubtitle: 'Aerial arts and circus skills training for all levels.',
		description: 'Aerial arts and circus skills',
		icon: '🎪'
	},
	adventure: {
		slug: 'adventure',
		href: '/calendar/adventure',
		label: 'Adventure',
		activityName: 'Rainbow Adventure',
		pageTitle: 'Adventure | Rainbow Gym | MIKO.ART',
		eyebrow: 'Rainbow Adventure',
		eyebrowClass: 'eyebrow-adventure',
		glowClass: 'glow-adventure',
		formGlowClass: 'form-glow-adventure',
		heroTitleLines: ['Get outside.', 'Find something new.'],
		heroSubtitle: 'Outdoor excursions and group adventures in the Pacific Northwest.',
		description: 'Outdoor excursions and trips',
		icon: '🏔️'
	},
	'movie-night': {
		slug: 'movie-night',
		href: '/calendar/movie-night',
		label: 'Movies',
		activityName: 'Movie Night',
		pageTitle: 'Movie Night | Rainbow Gym | MIKO.ART',
		eyebrow: 'Movie Night',
		eyebrowClass: 'eyebrow-movie',
		glowClass: 'glow-movie',
		formGlowClass: 'form-glow-movie',
		heroTitleLines: ['Grab some snacks.', 'Watch together.'],
		heroSubtitle: 'Community movie screenings and cozy film nights.',
		description: 'Community film screenings',
		icon: '🎬'
	}
}

export const CALENDAR_ACTIVITY_LIST: CalendarActivityConfig[] = [
	CALENDAR_ACTIVITIES.gym,
	CALENDAR_ACTIVITIES.circus,
	CALENDAR_ACTIVITIES.adventure,
	CALENDAR_ACTIVITIES['movie-night']
]
