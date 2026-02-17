import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { createOauthState, getGoogleAuthUrl } from '@miko/calendar'
import { enforceSameOrigin, requireAdminSession, unauthorized } from '../../admin/_helpers.ts'
import { apiError, apiOk, logApiError } from '$lib/server/http/api'

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

		return apiOk({ authUrl })
	} catch (err) {
		logApiError('calendar.oauth.start', err)
		return apiError('Failed to start OAuth')
	}
}
