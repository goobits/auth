import { onRequest } from '../../../../../functions/api/calendar/cancel.js'
import { buildEnv } from '../_bridge.js'

export async function POST({ request }) {
	const env = buildEnv()
	return onRequest({ env, request })
}
