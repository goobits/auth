export class AuthPrincipalResolutionError extends Error {
	readonly code = "AUTH_PRINCIPAL_RESOLUTION_FAILED";
	readonly status: number;

	constructor(message = "Unable to resolve authenticated principal", status = 401) {
		super(message);
		this.name = "AuthPrincipalResolutionError";
		this.status = status;
	}
}

export class AuthAdapterCapabilityError extends Error {
	readonly code = "AUTH_ADAPTER_CAPABILITY_UNSUPPORTED";
	readonly status: number;

	constructor(message = "Adapter capability not supported", status = 501) {
		super(message);
		this.name = "AuthAdapterCapabilityError";
		this.status = status;
	}
}
