import { onRequest } from '../../../../../functions/api/calendar/oauth-start.js'
import { buildEnv } from '../_bridge.js'

export async function GET({ request }) {
	const env = buildEnv()
	return onRequest({ env, request })
}
