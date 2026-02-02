import { onRequest } from '../../../../../functions/api/calendar/cancel.js'
import { buildEnv } from '../_bridge.js'

export async function POST({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
