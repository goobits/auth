import { json, type RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { createOauthState, getGoogleAuthUrl } from '@packages/calendar/src/index.ts'
import { enforceSameOrigin, noStoreHeaders, requireAdminSession, unauthorized } from '../../admin/_helpers.ts'

export async function GET(event: RequestEvent) {
	try {
		const csrf = enforceSameOrigin(event)
		if (csrf) return csrf

		const auth = await requireAdminSession({ event })
		if (!auth.ok) return unauthorized()

		const env = await buildEnv(event.platform)
		const state = crypto.randomUUID()
		await createOauthState({ db: env.DB, state })
		const authUrl = getGoogleAuthUrl({ env, state })

		return json({ ok: true, authUrl }, { headers: noStoreHeaders })
	} catch (err) {
		console.error('OAuth start error:', err)
		return json({ ok: false, error: { message: 'Failed to start OAuth' } }, { status: 500, headers: noStoreHeaders })
	}
}
