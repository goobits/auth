import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { mergeRuntimeEnv, resolveBaseUrl, resolveRuntimeDb } from '$lib/server/runtime'
import { runRegisterAntiAbuse } from '$lib/server/antiabuse'
import { registerUser } from '$lib/server/auth/register'
import { dev } from '$app/environment'

function getClientIp(request: Request, getClientAddress?: () => string) {
	const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')
	if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
	if (getClientAddress) return getClientAddress()
	return 'unknown'
}

function getAsn(request: Request) {
	const cfRequest = request as Request & { cf?: { asn?: number } }
	const asn = cfRequest.cf?.asn
	return typeof asn === 'number' ? String(asn) : 'unknown'
}

export const load: PageServerLoad = async ({ platform }) => {
	const env = mergeRuntimeEnv(platform?.env)
	const localWidgetEnabled = env['TURNSTILE_ENABLE_LOCALHOST'] === 'true'
	const turnstileSiteKey = dev && !localWidgetEnabled ? '' : env['PUBLIC_TURNSTILE_SITE_KEY'] || ''
	return {
		turnstileSiteKey,
		antiAbuseEnabled: env['ANTIABUSE_ENABLED'] !== 'false'
	}
}

export const actions: Actions = {
	default: async (event) => {
		const env = mergeRuntimeEnv(event.platform?.env)
		const db = await resolveRuntimeDb(event.platform?.env)
		if (!db) {
			return fail(503, { error: 'Registration is temporarily unavailable.' })
		}

		const formData = await event.request.formData()
		const name = String(formData.get('name') || '').trim()
		const email = String(formData.get('email') || '').trim()
		const password = String(formData.get('password') || '')
		const honeypot = String(formData.get('website') || '')
		const startedAtMs = Number.parseInt(String(formData.get('started_at') || '0'), 10)
		const turnstileToken = String(formData.get('cf-turnstile-response') || '').trim()
		const deviceId = String(formData.get('device_id') || '').trim()

		const antiAbuse = await runRegisterAntiAbuse({
			email,
			ip: getClientIp(event.request, event.getClientAddress),
			asn: getAsn(event.request),
			deviceId,
			honeypot,
			startedAtMs,
			turnstileToken,
			env
		})

		if (!antiAbuse.ok) {
			return fail(400, {
				error: antiAbuse.message || 'We could not complete that request. Please try again later.',
				requiresChallenge: antiAbuse.requiresChallenge,
				name,
				email
			})
		}

		const result = await registerUser(db, {
			name,
			email,
			password,
			baseUrl: resolveBaseUrl(event.url, env),
			env
		})

		if (!result.ok) {
			return fail(400, {
				error: result.error || 'We could not complete that request. Please try again later.',
				name,
				email
			})
		}

		throw redirect(303, '/register/success')
	}
}
