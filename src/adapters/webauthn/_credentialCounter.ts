/** Returns whether a WebAuthn signature counter is safe to persist or compare. */
export function isValidCredentialCounter(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Rejects invalid or regressing counter transitions before they reach storage. */
export function assertCredentialCounterTransition(
	expectedCounter: unknown,
	newCounter: unknown
): asserts expectedCounter is number {
	if (!isValidCredentialCounter(expectedCounter) || !isValidCredentialCounter(newCounter)) {
		throw new RangeError('WebAuthn counters must be non-negative safe integers')
	}
	if (newCounter < expectedCounter || (expectedCounter > 0 && newCounter === expectedCounter)) {
		throw new RangeError('WebAuthn counter must advance monotonically')
	}
}
