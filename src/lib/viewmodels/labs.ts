import { localeSort, matchesQuery, normalizeQuery } from '$lib/utils/collections'

export type LabItem = {
	href: string
	title: string
	vibe: string
	/** ISO YYYY-MM-DD when we know the first journal mention/publish date. */
	date?: string
}

export type LabScope = 'all' | 'internal' | 'external'
export type LabSort = 'title' | 'path'

export const labsCatalog: LabItem[] = [
	{ href: '/labs/color-galaxy/', title: 'Color Galaxy', vibe: 'A dreamy generative playground for color.' },
	{
		href: '/labs/js1k/BreathingGalaxies.html',
		title: 'JS1k - Breathing Galaxies',
		vibe: 'A 1KB cosmic sketch that breathes and shifts.',
		date: '2010-08-07'
	},
	{
		href: '/labs/js1k/Daltonize.html',
		title: 'JS1k - Daltonize',
		vibe: 'A tiny tool for exploring color-vision accessibility.',
		date: '2011-10-20'
	},
	{
		href: '/labs/js1k/MicroSketchpad.html',
		title: 'JS1k - Micro Sketchpad',
		vibe: 'A pocket sketchpad in 1KB. Click, drag, scribble.',
		date: '2010-08-07'
	},
	{
		href: '/labs/js1k/SpectrumDJ.html',
		title: 'JS1k - Spectrum DJ',
		vibe: 'A responsive spectrum toy for colorful audio-visual play.',
		date: '2010-08-07'
	},
	{ href: '/labs/midi-js/', title: 'MIDI.js', vibe: 'Make the browser sing. MIDI tools + demos.', date: '2012-02-16' },
	{ href: '/labs/sketch-js/', title: 'Sketch.js', vibe: 'A lightweight creative-coding toolkit for the web.' },
	{ href: '/labs/sketchpad-1.0/', title: 'Sketchpad v1.0', vibe: 'An early Sketchpad prototype from the canvas days.', date: '2009-10-27' },
	{ href: '/labs/thumbnailer/', title: 'Thumbnailer', vibe: 'Batch thumbnail generation, zipped and ready to ship.', date: '2011-11-24' },
	{ href: '/labs/zen-bg/', title: 'Zen BG', vibe: 'Build ambient, textured backgrounds with a few sliders.', date: '2011-01-06' }
]

export function isExternalLab(href: string) {
	return href.endsWith('.html')
}

function matchesScope(lab: LabItem, selectedScope: LabScope) {
	if (selectedScope === 'external') return isExternalLab(lab.href)
	if (selectedScope === 'internal') return !isExternalLab(lab.href)
	return true
}

export function filterAndSortLabs(
	labs: LabItem[],
	searchQuery: string,
	selectedScope: LabScope,
	sortBy: LabSort
) {
	const query = normalizeQuery(searchQuery)
	const filtered = labs.filter((lab) => {
		if (!matchesScope(lab, selectedScope)) return false
		return matchesQuery(query, [lab.title, lab.href, lab.vibe])
	})

	return filtered.sort((a, b) => {
		if (sortBy === 'path') return localeSort(a.href, b.href)
		return localeSort(a.title, b.title)
	})
}
