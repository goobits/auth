export type Route = {
	id: string;
	tab: string;
	title: string;
	distance: string;
	goodFor: string;
	surface: string;
	hills: string;
	mapLabel: string;
	pdf: string;
	gpx: string;
};

export const site = {
	meta: {
		title: 'PDX Dino Run | Family Fun Run + Dino Yoga at Mt. Tabor',
		description:
			'A wholesome, family-friendly movement day at Mt. Tabor - bike in, fun run/walk, dino yoga, and a donation-based aerial showcase. Costumes encouraged. All paces welcome.',
		ogTitle: 'PDX Dino Run',
		ogDescription: 'Join the herd at Mt. Tabor. Donation-based, all ages, all paces.',
		ogImage: '/og/pdx-dino-run-1200x630.svg',
		ogImageAlt: 'Sunglasses dinosaur running past pine trees at Mt. Tabor.'
	},
	nav: [
		{ id: 'about', label: 'About' },
		{ id: 'schedule', label: 'Schedule' },
		{ id: 'routes', label: 'Routes' },
		{ id: 'donate', label: 'Donate' },
		{ id: 'volunteer', label: 'Volunteer' },
		{ id: 'faq', label: 'FAQ' }
	],
	hero: {
		title: 'PDX Dino Run',
		subhead:
			'A wholesome family movement day at Mt. Tabor - bike in, fun run/walk, dino yoga, and a donation-based aerial showcase.',
		dateLine: 'Mt. Tabor Park, Portland | [Saturday, Month Day] | [10am-1pm]',
		chips: [
			'Costumes encouraged (optional)',
			'All paces welcome',
			'Family-friendly',
			'Donation-based',
			'Rain-or-shine plan'
		],
		reassurance: 'Not a race. No pressure. Just joyful movement and community.'
	},
	quickFacts: [
		{
			title: 'Family-friendly',
			text: 'Kids welcome. Walkers welcome. Strollers welcome on the shortest route.'
		},
		{ title: 'All paces', text: 'Run, walk, or do a little of both. No timing, no podium.' },
		{
			title: 'Costume-optional',
			text: 'Wear a dino suit, dino socks, or just your normal comfy gear.'
		},
		{ title: 'Donation-based', text: 'Participate for free. Donate if you can. Cheer loudly either way.' },
		{ title: 'Portland-proof', text: 'Light rain is part of the charm. We will adapt the schedule if needed.' },
		{
			title: 'Safety-first',
			text: 'Clear routes, friendly marshals, first aid station, and watch-only aerial with a safety perimeter.'
		}
	],
	activities: [
		{
			title: 'Bike-in herd (optional)',
			icon: 'bike',
			text: 'Join a group ride to Mt. Tabor or meet us there. Costumes encouraged. Good vibes guaranteed.',
			detail: ''
		},
		{
			title: 'Dino fun run/walk',
			icon: 'run',
			text: 'Choose a loop. Move at your pace. High fives welcome.',
			detail: ''
		},
		{
			title: 'Dino + animal yoga',
			icon: 'yoga',
			text: 'Beginner-friendly yoga with joyful pose names. Zero intensity, lots of kindness.',
			detail: ''
		},
		{
			title: 'Donation-based aerial showcase',
			icon: 'aerial',
			text: 'Short sets from performers on a freestanding rig. Watch-only, with a clearly marked safety perimeter.',
			detail:
				'The aerial area is watch-only. No public participation. Please keep kiddos behind the boundary line.'
		}
	],
	schedule: [
		'[9:30am] Arrive + check-in opens',
		'[10:00am] Welcome + herd photo',
		'[10:10am] Run/walk briefing (route options + safety)',
		'[10:20am] Run/walk start window opens',
		'[11:15am] Dino + animal yoga (all levels)',
		'[12:00pm] Aerial showcase (short sets, donation-based)',
		'[12:45pm] Wrap + thank-you + last donations',
		'[1:00pm] Cleanup complete'
	],
	routes: [
		{
			id: 'hatchling',
			tab: 'Hatchling Loop',
			title: 'Hatchling Loop',
			distance: '~1 mile',
			goodFor: 'kiddos, strollers (route-dependent), first-timers, vibes-first',
			surface: '[Mostly paved / mixed]',
			hills: '[Low / moderate]',
			mapLabel: 'Route map - Hatchling Loop',
			pdf: '/routes/hatchling.pdf',
			gpx: '/routes/hatchling.gpx'
		},
		{
			id: 'raptor',
			tab: 'Raptor Ramble',
			title: 'Raptor Ramble',
			distance: '~1.7 miles',
			goodFor: 'walkers + joggers, families, steady pace',
			surface: '[Mixed]',
			hills: '[Moderate]',
			mapLabel: 'Route map - Raptor Ramble',
			pdf: '/routes/raptor.pdf',
			gpx: '/routes/raptor.gpx'
		},
		{
			id: 'trex',
			tab: 'T-Rex Trek',
			title: 'T-Rex Trek',
			distance: '~3 miles (fun run loop)',
			goodFor: 'runners, joggers, full-loop energy',
			surface: '[Mixed]',
			hills: '[Moderate / spicy]',
			mapLabel: 'Route map - T-Rex Trek',
			pdf: '/routes/trex.pdf',
			gpx: '/routes/trex.gpx'
		}
	] as Route[],
	bring: [
		'Water bottle',
		'Comfy shoes',
		'A layer (Portland weather has range)',
		'Costume bits if you want',
		'Snacks for little dinos',
		'Cash or phone for donation QR',
		'Optional: picnic blanket for hanging out'
	],
	donation: {
		headline: 'Donate (if you can)',
		body:
			'This event is donation-based so it can stay welcoming and accessible. If you are able, your donation helps cover permits, insurance, performer tips, and [beneficiary mission].',
		bullets: [
			'[X]% goes to [Beneficiary]',
			'Permits + insurance are covered first',
			'Aerial tips go directly to performers',
			'Any remainder supports [Beneficiary / next year]'
		],
		disclaimer:
			'Benefiting [Beneficiary]. No endorsement implied unless explicitly stated.',
		onlineUrl: '#',
		venmoUrl: '#',
		paypalUrl: '#'
	},
	sponsors: {
		list: [
			'Water + electrolyte drinks',
			'Fruit + simple snacks',
			'Route markers + signage printing',
			'Volunteer patches/stickers',
			'First aid supplies',
			'Kids prizes (tiny and joyful)'
		],
		contactEmail: 'hello@pdxdinorun.org'
	},
	volunteer: {
		roles: [
			{ title: 'Course Marshal', text: 'Stand at a key turn or crossing, cheer dinos, point the way.' },
			{ title: 'Check-In Buddy', text: 'Help people get oriented, answer questions, share route info.' },
			{ title: 'Setup / Takedown Crew', text: 'Place signs, tidy up, and help us leave the park pristine.' },
			{ title: 'Sweep Walker', text: 'Bring up the rear so nobody finishes alone.' }
		],
		signupUrl: '#'
	},
	faq: [
		{ q: 'Is this a race?', a: 'Nope. It is a fun run/walk. Move at your pace.' },
		{
			q: 'Do I need to donate to participate?',
			a: 'No. Participation is free. Donations are appreciated, never required.'
		},
		{ q: 'Are kids welcome?', a: 'Yes. This is designed to be family-friendly.' },
		{ q: 'Are costumes required?', a: 'Not at all. Costume bits are optional and celebrated.' },
		{
			q: 'What about strollers?',
			a: 'The shortest route is the best bet. Check route details for surface notes.'
		},
		{ q: 'What if it rains?', a: 'Light rain is normal here. We will adapt if weather gets intense.' },
		{
			q: 'Is the aerial show participatory?',
			a: 'No. Watch-only, with a clear safety perimeter.'
		},
		{ q: 'Can I bring my dog?', a: '[Yes, if leashed] or [Please leave dogs at home].' },
		{
			q: 'Is there a code of conduct?',
			a: 'Yes. Be kind, share the path, and help keep the event welcoming for everyone.'
		}
	],
	footer: {
		line: 'Made in Portland with dino joy',
		year: new Date().getFullYear()
	}
};
