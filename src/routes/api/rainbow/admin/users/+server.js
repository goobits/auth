import { onRequest } from '../../../../../../functions/api/rainbow/admin/users.js'
import { buildEnv } from '../../_bridge.js'

export async function GET({ request, platform }) {
	const env = await buildEnv(platform)
	return onRequest({ env, request })
}
