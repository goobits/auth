import { localeSort, matchesQuery, normalizeQuery } from '$lib/utils/collections'

export type LabItem = {
	href: string
	title: string
	vibe: string
}

export type LabScope = 'all' | 'internal' | 'external'
export type LabSort = 'title' | 'path'

export const labsCatalog: LabItem[] = [
	{ href: '/labs/color-galaxy/', title: 'Color Galaxy', vibe: 'Generative color playground' },
	{ href: '/labs/js1k/BreathingGalaxies.html', title: 'JS1k - Breathing Galaxies', vibe: 'Tiny code, cosmic motion' },
	{ href: '/labs/js1k/Daltonize.html', title: 'JS1k - Daltonize', vibe: 'Color accessibility experiment' },
	{ href: '/labs/js1k/MicroSketchpad.html', title: 'JS1k - Micro Sketchpad', vibe: 'Pocket-sized drawing toy' },
	{ href: '/labs/js1k/SpectrumDJ.html', title: 'JS1k - Spectrum DJ', vibe: 'Music + visuals mashup' },
	{ href: '/labs/midi-js/', title: 'MIDI.js', vibe: 'Browser MIDI tooling' },
	{ href: '/labs/sketch-js/', title: 'Sketch.js', vibe: 'Creative coding toolkit' },
	{ href: '/labs/sketchpad-1.0/', title: 'Sketchpad v1.0', vibe: 'Early product prototype' },
	{ href: '/labs/thumbnailer/', title: 'Thumbnailer', vibe: 'Image utility experiment' },
	{ href: '/labs/zen-bg/', title: 'Zen BG', vibe: 'Ambient background generator' }
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
