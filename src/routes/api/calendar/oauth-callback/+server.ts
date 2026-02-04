import { onRequest } from '../../../../../functions/api/calendar/oauth-callback.ts'
import { buildEnv } from '../_bridge.ts'

export async function GET({ request, platform }: { request: Request; platform: any }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
