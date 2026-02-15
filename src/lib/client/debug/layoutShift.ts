function selectorFor(el: Element | null): string {
	if (!el) return ''
	const id = el.getAttribute('id')
	if (id) return `#${id}`
	const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2)
	if (cls.length) return `${el.tagName.toLowerCase()}.${cls.join('.')}`
	return el.tagName.toLowerCase()
}

type LayoutShiftSource = {
	node?: Element
	previousRect?: DOMRectReadOnly
	currentRect?: DOMRectReadOnly
}

type LayoutShiftEntryLike = PerformanceEntry & {
	value?: number
	hadRecentInput?: boolean
	sources?: LayoutShiftSource[]
}

export function enableLayoutShiftDebug() {
	console.log('[layout-shift] debug enabled')

	try {
		const obs = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				const ls = entry as unknown as LayoutShiftEntryLike
				if (ls.hadRecentInput) continue

				const sources = Array.isArray(ls.sources) ? ls.sources : []
				const mapped = sources.map((s) => ({
					selector: selectorFor((s?.node as Element) || null),
					previousRect: s?.previousRect ?? null,
					currentRect: s?.currentRect ?? null
				}))

				console.log('[layout-shift]', {
					value: ls.value ?? 0,
					sources: mapped
				})
			}
		})

		obs.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit)
	} catch (err) {
		console.warn('[layout-shift] observer unavailable', err)
	}
}
