/** Error thrown when an authenticated principal cannot be resolved. */
export class AuthPrincipalResolutionError extends Error {
	readonly code = 'AUTH_PRINCIPAL_RESOLUTION_FAILED'
	readonly status: number

	constructor(message = 'Unable to resolve authenticated principal', status = 401) {
		super(message)
		this.name = 'AuthPrincipalResolutionError'
		this.status = status
	}
}

/** Error thrown when an auth adapter lacks a required capability. */
export class AuthAdapterCapabilityError extends Error {
	readonly code = 'AUTH_ADAPTER_CAPABILITY_UNSUPPORTED'
	readonly status: number

	constructor(message = 'Adapter capability not supported', status = 501) {
		super(message)
		this.name = 'AuthAdapterCapabilityError'
		this.status = status
	}
}
