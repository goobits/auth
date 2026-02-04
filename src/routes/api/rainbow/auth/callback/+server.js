import { onRequest } from '../../../../../../functions/api/calendar/calendar/auth/callback.js'
import { buildEnv } from '../../../calendar/_bridge.js'

// Legacy OAuth callback to support older authorized redirect URIs.
export async function GET({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}

export async function POST({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
