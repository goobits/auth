import { onRequest } from '../../../../../functions/api/calendar/book.ts'
import { buildEnv } from '../_bridge.ts'

export async function POST({ request, platform }: { request: Request; platform: any }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
