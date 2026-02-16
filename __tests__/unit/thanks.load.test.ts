import { describe, expect, it } from 'vitest';
import { load } from '../../src/routes/thanks/+page.server';

describe('thanks page load', () => {
	it('passes through allowed type values', () => {
		const result = load({
			url: new URL('http://localhost/thanks?type=join')
		} as Parameters<typeof load>[0]);

		expect(result.type).toBe('join');
	});

	it('normalizes unknown values to general', () => {
		const result = load({
			url: new URL('http://localhost/thanks?type=unknown')
		} as Parameters<typeof load>[0]);

		expect(result.type).toBe('general');
	});
});
