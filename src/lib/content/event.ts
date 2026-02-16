import type { Route } from './types';

export const quickFacts = [
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
];

export const schedule = [
	{ time: '9:30am', label: 'Arrive + check-in opens', featured: false },
	{ time: '10:00am', label: 'Welcome + herd photo', featured: true },
	{ time: '10:10am', label: 'Run/walk briefing - route options + safety', featured: false },
	{ time: '10:20am', label: 'Run/walk start window opens', featured: true },
	{ time: '11:15am', label: 'Dino + animal yoga (all levels)', featured: true },
	{ time: '12:00pm', label: 'Aerial showcase - short sets, donation-based', featured: true },
	{ time: '12:45pm', label: 'Wrap-up + thank you', featured: false },
	{ time: '1:00pm', label: 'Leave no fossils behind - cleanup complete', featured: false }
];

export const routes: Route[] = [
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
];

export const bring = [
	{ icon: '💧', label: 'Water bottle' },
	{ icon: '👟', label: 'Comfy shoes' },
	{ icon: '🧥', label: 'A layer' },
	{ icon: '🦕', label: 'Costume bits' },
	{ icon: '🍌', label: 'Kid snacks' },
	{ icon: '📱', label: 'Phone for QR' },
	{ icon: '🧺', label: 'Picnic blanket' },
	{ icon: '😎', label: 'Good energy' }
];
