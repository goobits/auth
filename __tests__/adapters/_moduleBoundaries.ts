import { readFile } from 'node:fs/promises'
import { expect } from 'vitest'

type DeclarationOwners = Record<string, readonly string[]>

const declarationPattern = (name: string) =>
	new RegExp(`(?:^|\\n)(?:export )?(?:type|interface|class|function|const) ${name}\\b`)

export async function expectSingleDeclarationOwners(
	baseUrl: URL,
	owners: DeclarationOwners
): Promise<void> {
	const sources = new Map(
		await Promise.all(
			Object.keys(owners).map(
				async (file) => [file, await readFile(new URL(file, baseUrl), 'utf8')] as const
			)
		)
	)

	for (const [expectedFile, names] of Object.entries(owners)) {
		for (const name of names) {
			expect(
				[...sources]
					.filter(([, source]) => declarationPattern(name).test(source))
					.map(([file]) => file),
				name
			).toEqual([expectedFile])
		}
	}
}
