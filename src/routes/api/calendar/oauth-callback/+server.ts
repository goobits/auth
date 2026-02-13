import { onRequest } from '../../../../../functions/api/calendar/oauth-callback.ts'
import { buildEnv } from '../_bridge.ts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ request, platform }) => {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
