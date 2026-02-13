import type { D1DatabaseLike } from '$lib/dev/devDb.ts'
import type { Session, User } from '@goobits/auth/types'

declare global {
	namespace App {
		interface Platform {
			env?: {
				DB?: D1DatabaseLike
				[key: string]: string | D1DatabaseLike | undefined
			}
		}

		interface Locals {
			user?: User | null
			session?: Session | null
		}
	}
}

export {}
