export const donation = {
	headline: 'Donate (if you can)',
	body:
		'This event is donation-based so it stays welcoming and accessible. Your donation helps cover permits, insurance, performer tips, and supports our beneficiary mission.',
	bullets: [
		'Permits + insurance are covered first',
		'Aerial tips go directly to performers',
		'Remainder supports next year’s event operations'
	],
	disclaimer: 'Donations are community-managed and transparency updates are posted after the event.',
	onlineUrl: '/donate#online',
	venmoUrl: '/donate#venmo',
	paypalUrl: '/donate#paypal'
};

export const volunteer = {
	roles: [
		{ title: 'Course Marshal', text: 'Stand at a key turn, cheer dinos, point the way.', icon: '📣' },
		{ title: 'Check-In Buddy', text: 'Help people get oriented and answer questions.', icon: '👋' },
		{ title: 'Setup / Takedown', text: 'Place signs, tidy up, leave the park pristine.', icon: '🔧' },
		{ title: 'Sweep Walker', text: 'Bring up the rear so nobody finishes alone.', icon: '🐢' }
	],
	perks: 'Snacks, gratitude, and a volunteer patch/sticker.'
};

export const faq = [
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
];

export const remind = {
	title: 'Get a reminder the week before',
	text: 'One email with the date, parking tips, and weather plan. That is it.',
	ctaLabel: 'Remind Me'
};

export const footer = {
	brand: 'pdx.run',
	line: 'Made in Portland with dino joy',
	year: new Date().getFullYear()
};
