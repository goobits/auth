import { onRequest } from '../../../../../functions/api/calendar/book.ts'
import { buildEnv } from '../_bridge.ts'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
