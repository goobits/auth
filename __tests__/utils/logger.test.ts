import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogger, setLogger } from "../../src/utils/logger.ts";

describe("logger", () => {
	afterEach(() => {
		setLogger(null);
	});
	it("uses a no-op logger by default", () => {
		const logger = getLogger();
		expect(logger).toBeDefined();
		expect(typeof logger.error).toBe("function");
	});

	it("allows swapping the active logger", () => {
		const error = vi.fn();
		setLogger({ error });
		getLogger().error?.("test");
		expect(error).toHaveBeenCalledWith("test");
	});
});
