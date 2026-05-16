/** Error thrown when auth cannot resolve an expected principal. */
export class AuthPrincipalResolutionError extends Error {
	readonly code = "AUTH_PRINCIPAL_RESOLUTION_FAILED";
	readonly status: number;

	/** Create a principal resolution error. */
	constructor(message = "Unable to resolve authenticated principal", status = 401) {
		super(message);
		this.name = "AuthPrincipalResolutionError";
		this.status = status;
	}
}

/** Error thrown when an adapter does not support a requested capability. */
export class AuthAdapterCapabilityError extends Error {
	readonly code = "AUTH_ADAPTER_CAPABILITY_UNSUPPORTED";
	readonly status: number;

	/** Create an adapter capability error. */
	constructor(message = "Adapter capability not supported", status = 501) {
		super(message);
		this.name = "AuthAdapterCapabilityError";
		this.status = status;
	}
}
