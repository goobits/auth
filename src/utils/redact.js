const DEFAULT_REDACT_KEYS = [
	"password",
	"token",
	"access_token",
	"refresh_token",
	"secret",
	"authorization",
	"cookie",
];

function isPlainObject(value) {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value)
	);
}

export function redactObject(input, keys = DEFAULT_REDACT_KEYS) {
	if (!input) return input;
	if (Array.isArray(input)) {
		return input.map((item) => redactObject(item, keys));
	}
	if (!isPlainObject(input)) return input;

	const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));
	const output = {};
	for (const [key, value] of Object.entries(input)) {
		if (lowerKeys.has(key.toLowerCase())) {
			output[key] = "[redacted]";
		} else if (isPlainObject(value) || Array.isArray(value)) {
			output[key] = redactObject(value, keys);
		} else {
			output[key] = value;
		}
	}
	return output;
}

export { DEFAULT_REDACT_KEYS };
