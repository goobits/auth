import type { RequestEvent } from '@sveltejs/kit'
import { buildEnv } from '../_bridge.ts'
import { consumeOauthState, exchangeGoogleCode, requireEnv, saveConnection } from '@miko/calendar'

export async function GET(event: RequestEvent) {
	try {
		const url = new URL(event.request.url)
		const code = url.searchParams.get('code')
		const state = url.searchParams.get('state')
		if (!code || !state) {
			return new Response('Invalid OAuth callback request', { status: 400 })
		}

		const isAdminOauthState = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state)
		if (!isAdminOauthState) {
			return new Response('Invalid OAuth state', { status: 400 })
		}

		const env = await buildEnv(event.platform)
		const validState = await consumeOauthState({ db: env.DB, state })
		if (!validState) {
			return new Response('Invalid OAuth state', { status: 400 })
		}

		const token = await exchangeGoogleCode({ env, code })
		await saveConnection({
			db: env.DB,
			provider: 'google',
			token,
			base64Key: requireEnv(env, 'TOKEN_ENC_KEY')
		})

		return Response.redirect(new URL('/admin?connected=1', event.request.url), 302)
	} catch (err) {
		console.error('OAuth callback error:', err)
		return new Response('OAuth callback failed', { status: 500 })
	}
}
