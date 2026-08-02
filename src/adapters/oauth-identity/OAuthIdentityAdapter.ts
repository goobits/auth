import type { OAuthIdentity } from '../../types/core.ts'

/** Persistence port for stable provider subjects linked to application users. */
export interface OAuthIdentityAdapter {
	getIdentity(provider: string, subject: string): Promise<OAuthIdentity | null>
	listIdentities(userId: string): Promise<OAuthIdentity[]>
	linkIdentity(identity: OAuthIdentity): Promise<void>
	unlinkIdentity(userId: string, provider: string): Promise<void>
}
