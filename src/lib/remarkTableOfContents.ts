/**
 * Creates a remark plugin that generates a table of contents (TOC) from markdown headings
 * @returns {import('unified').Plugin}
 */
export function remarkTableOfContents() {
	return (tree: any) => {
		const headings: Array<{ depth: number; text: string; id: string }> = []
		let tocIndex = -1
		let tocDepth = 2 // Default depth if not specified
		let tocLevel = 2 // Level of the TOC heading itself

		// First pass: find TOC marker
		tree.children.forEach((node: any, index: number) => {
			if (node.type === 'heading') {
				const headingText = node.children[0]?.value || ''

				// Check for new TOC format (## TOC:2)
				const tocMatch = headingText.match(/^TOC(?::(\d+))?$/)
				if (tocMatch) {
					tocIndex = index
					tocLevel = node.depth

					// If a depth is specified (e.g., TOC:3), use it
					// If just TOC with no number, use default depth
					if (tocMatch[1]) {
						tocDepth = Math.min(6, Math.max(0, parseInt(tocMatch[1], 10)))
					}

					// Special case: if depth is 0, include all levels
					if (tocDepth === 0) {
						tocDepth = 6
					}
					return
				}

				// Only collect headings that come after TOC marker
				if (tocIndex !== -1 && index > tocIndex) {
					const id = toId(headingText)
					node.data = {
						hProperties: { id }
					}

					headings.push({
						depth: node.depth,
						text: headingText,
						id
					})
				}
			}
		})

		// If we found a TOC marker
		if (tocIndex !== -1) {
			// Create TOC heading
			const tocHeading = {
				type: 'heading',
				depth: tocLevel,
				children: [
					{
						type: 'text',
						value: 'Table of Contents'
					}
				]
			}

			// Create TOC list
			const tocList = {
				type: 'list',
				ordered: false,
				children: headings
					.filter((h) => h.depth <= tocDepth)
					.map((heading) => ({
						type: 'listItem',
						children: [
							{
								type: 'paragraph',
								children: [
									{
										type: 'link',
										url: `#${ heading.id }`,
										children: [
											{
												type: 'text',
												value: heading.text
											}
										]
									}
								]
							}
						]
					}))
			}

			// Replace TOC marker with heading and list
			tree.children.splice(tocIndex, 1, tocHeading, tocList)
		}

		return tree
	}
}

/**
 * Converts text to a URL-friendly ID
 * @param {string} text - The text to convert
 * @returns {string} The converted text as a lowercase, hyphen-separated string
 * @private
 */
function toId(text: string) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}
