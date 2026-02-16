import { requireEnabledProgram } from '../_programGate.server'

export async function load({ platform }: { platform: App.Platform }) {
	await requireEnabledProgram(platform, 'gym')
}
