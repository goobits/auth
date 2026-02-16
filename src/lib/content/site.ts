export type Route = {
	id: string;
	title: string;
	distance: string;
	icon: string;
	description: string;
	surface: string;
	hills: string;
	note: string;
	accent: 'hatchling' | 'raptor' | 'trex';
	pdf: string;
	gpx: string;
};

export const site = {
	meta: {
		title: 'PDX Dino Run | pdx.run',
		description:
			'A wholesome family movement day at Mt. Tabor - bike in, fun run/walk, dino yoga, and a donation-based aerial showcase.',
		ogTitle: 'PDX Dino Run',
		ogDescription: 'Join the herd at Mt. Tabor. Donation-based, all ages, all paces.',
		ogImage: '/og/pdx-dino-run-1200x630.svg',
		ogImageAlt: 'Friendly dinosaurs running through Mt. Tabor pine trees.'
	},
	nav: [
		{ id: 'about', label: 'About' },
		{ id: 'schedule', label: 'Schedule' },
		{ id: 'routes', label: 'Routes' },
		{ id: 'donate', label: 'Donate' },
		{ id: 'faq', label: 'FAQ' }
	],
	hero: {
		eyebrow: 'Mt. Tabor Park · Portland, OR',
		title: 'PDX Dino Run',
		subhead:
			'A wholesome family movement day - bike in, fun run/walk, dino yoga, and a donation-based aerial showcase.',
		dateLine: 'Saturday TBD · 10am - 1pm',
		chips: ['All paces', 'Costumes encouraged', 'Family-friendly', 'Donation-based', 'Rain-or-shine'],
		reassurance: 'Not a race. No pressure. Just joyful movement and community.'
	},
	quickFacts: [
		{
			title: 'Family-friendly',
			text: 'Kids welcome. Walkers welcome. Strollers welcome on the shortest route.',
			icon: '🦕',
			accent: 'green'
		},
		{
			title: 'All paces',
			text: 'Run, walk, or do a little of both. No timing, no podium.',
			icon: '🚶',
			accent: 'green'
		},
		{
			title: 'Costume-optional',
			text: 'Wear a dino suit, dino socks, or just your normal comfy gear.',
			icon: '🎭',
			accent: 'orange'
		},
		{
			title: 'Donation-based',
			text: 'Participate for free. Donate if you can. Cheer loudly either way.',
			icon: '💚',
			accent: 'green'
		},
		{
			title: 'Portland-proof',
			text: 'Light rain is part of the charm. We adapt the schedule if needed.',
			icon: '🌧️',
			accent: 'orange'
		},
		{
			title: 'Safety-first',
			text: 'Clear routes, friendly marshals, first aid, and an aerial safety perimeter.',
			icon: '🩹',
			accent: 'green'
		}
	],
	schedule: [
		{ time: '9:30am', label: 'Arrive + check-in opens', featured: false },
		{ time: '10:00am', label: 'Welcome + herd photo', featured: true },
		{ time: '10:10am', label: 'Run/walk briefing - route options + safety', featured: false },
		{ time: '10:20am', label: 'Run/walk start window opens', featured: true },
		{ time: '11:15am', label: 'Dino + animal yoga (all levels)', featured: true },
		{ time: '12:00pm', label: 'Aerial showcase - short sets, donation-based', featured: true },
		{ time: '12:45pm', label: 'Wrap-up + thank you', featured: false },
		{ time: '1:00pm', label: 'Leave no fossils behind - cleanup complete', featured: false }
	],
	routes: [
		{
			id: 'hatchling',
			title: 'Hatchling Loop',
			distance: '~1 mile',
			icon: '🥚',
			description: 'Great for kiddos, strollers, first-timers, and anyone here for the vibes.',
			surface: 'Mostly paved',
			hills: 'Low hills',
			note: 'Stroller-friendly',
			accent: 'hatchling',
			pdf: '/routes/hatchling.pdf',
			gpx: '/routes/hatchling.gpx'
		},
		{
			id: 'raptor',
			title: 'Raptor Ramble',
			distance: '~2.5 miles',
			icon: '🦎',
			description: 'A solid loop with some hills. Good for joggers and enthusiastic walkers.',
			surface: 'Mixed terrain',
			hills: 'Moderate hills',
			note: 'Good workout',
			accent: 'raptor',
			pdf: '/routes/raptor.pdf',
			gpx: '/routes/raptor.gpx'
		},
		{
			id: 'trex',
			title: 'T-Rex Trek',
			distance: '~4 miles',
			icon: '🦖',
			description: 'The full Mt. Tabor experience. Hills, views, and mighty dino satisfaction.',
			surface: 'Mixed terrain',
			hills: 'Real hills',
			note: 'Summit views',
			accent: 'trex',
			pdf: '/routes/trex.pdf',
			gpx: '/routes/trex.gpx'
		}
	] as Route[],
	bring: [
		{ icon: '💧', label: 'Water bottle' },
		{ icon: '👟', label: 'Comfy shoes' },
		{ icon: '🧥', label: 'A layer' },
		{ icon: '🦕', label: 'Costume bits' },
		{ icon: '🍌', label: 'Kid snacks' },
		{ icon: '📱', label: 'Phone for QR' },
		{ icon: '🧺', label: 'Picnic blanket' },
		{ icon: '😎', label: 'Good energy' }
	],
	donation: {
		headline: 'Donate (if you can)',
		body:
			'This event is donation-based so it stays welcoming and accessible. Your donation helps cover permits, insurance, performer tips, and supports our beneficiary mission.',
		bullets: [
			'Permits + insurance are covered first',
			'Aerial tips go directly to performers',
			'Remainder supports [Beneficiary] / next year'
		],
		disclaimer: 'Benefiting [Beneficiary]. No endorsement implied unless explicitly stated.',
		onlineUrl: '#',
		venmoUrl: '#',
		paypalUrl: '#'
	},
	volunteer: {
		roles: [
			{ title: 'Course Marshal', text: 'Stand at a key turn, cheer dinos, point the way.', icon: '📣' },
			{ title: 'Check-In Buddy', text: 'Help people get oriented and answer questions.', icon: '👋' },
			{ title: 'Setup / Takedown', text: 'Place signs, tidy up, leave the park pristine.', icon: '🔧' },
			{ title: 'Sweep Walker', text: 'Bring up the rear so nobody finishes alone.', icon: '🐢' }
		],
		signupUrl: '#',
		perks: 'Snacks, gratitude, and a volunteer patch/sticker.'
	},
	faq: [
		{
			q: 'Is this a race?',
			a: 'Nope. It is a fun run/walk. Move at your pace. High-fives are the only competitive element.'
		},
		{
			q: 'Do I need to donate to participate?',
			a: 'No. Participation is free. Donations are welcome and appreciated, but never required.'
		},
		{
			q: 'Are kids welcome?',
			a: 'Absolutely. The Hatchling Loop is designed with little ones in mind, and yoga is all-ages friendly.'
		},
		{
			q: 'Are costumes required?',
			a: 'Encouraged, never required. Show up however feels good. Dino socks count.'
		},
		{
			q: 'What about strollers?',
			a: 'Welcome on the Hatchling Loop (mostly paved). Longer routes have mixed terrain that may be tricky.'
		},
		{
			q: 'What if it rains?',
			a: 'This is Portland. Light rain is part of the charm. We will adapt the schedule as needed.'
		},
		{
			q: 'Is the aerial show participatory?',
			a: 'Watch-only, with a clearly marked safety perimeter.'
		},
		{ q: 'Can I bring my dog?', a: 'Leashed, friendly dogs are welcome.' }
	],
	remind: {
		title: 'Get a reminder the week before',
		text: 'One email with the date, parking tips, and weather plan. That is it.',
		ctaLabel: 'Remind Me'
	},
	footer: {
		brand: 'pdx.run',
		line: 'Made in Portland with dino joy',
		year: new Date().getFullYear()
	}
};
