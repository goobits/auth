import { onRequest } from '../../../../../../functions/api/calendar/calendar/auth/callback.js'
import { buildEnv } from '../../_bridge.js'

export async function GET({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}

export async function POST({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
