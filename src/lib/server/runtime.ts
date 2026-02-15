import { dev } from '$app/environment'
import { getDevDb, type D1DatabaseLike } from '$lib/dev/devDb'

type PlatformEnv = {
	DB?: D1DatabaseLike
	PUBLIC_BASE_URL?: string
	BASE_URL?: string
	[key: string]: string | D1DatabaseLike | undefined
}

export function mergeRuntimeEnv(platformEnv?: PlatformEnv) {
	return {
		...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string')),
		...(platformEnv ?? {})
	} as Record<string, string | undefined>
}

export async function resolveRuntimeDb(platformEnv?: PlatformEnv) {
	if (dev) return getDevDb()
	return platformEnv?.DB || null
}

export function resolveBaseUrl(url: URL, env: Record<string, string | undefined>) {
	return env['PUBLIC_BASE_URL'] || env['BASE_URL'] || url.origin
}
