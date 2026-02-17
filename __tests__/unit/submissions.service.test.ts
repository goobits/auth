import { describe, expect, it, vi } from 'vitest';
import { saveJoin, saveReminder, saveVolunteer } from '../../src/lib/server/submissions/service';

type RunFn = ReturnType<typeof vi.fn>;
type FirstFn = ReturnType<typeof vi.fn>;
type AllFn = ReturnType<typeof vi.fn>;
type BindFn = ReturnType<typeof vi.fn>;
type PrepareFn = ReturnType<typeof vi.fn>;

function makePlatform() {
	const run: RunFn = vi.fn(() => Promise.resolve({}));
	const first: FirstFn = vi.fn(() => Promise.resolve(null));
	const all: AllFn = vi.fn(() => Promise.resolve({ results: [] }));
	const bind: BindFn = vi.fn(() => ({ run, first, all }));
	const prepare: PrepareFn = vi.fn(() => ({ bind }));

	const platform = {
		env: {
			DB: {
				prepare
			}
		}
	};

	return { platform, prepare, bind, run };
}

describe('submissions service', () => {
	it('saves join payload with expected values', async () => {
		const { platform, bind, run } = makePlatform();
		const form = new FormData();
		form.set('name', 'Test User');
		form.set('email', 'test@example.com');
		form.set('attendees', '2');
		form.set('routePreference', 'Hatchling Loop');
		form.set('notes', 'See you there');

		await saveJoin(platform, form);

		expect(bind).toHaveBeenCalledWith('Test User', 'test@example.com', 2, 'Hatchling Loop', 'See you there');
		expect(run).toHaveBeenCalledOnce();
	});

	it('rejects invalid attendee count', async () => {
		const { platform } = makePlatform();
		const form = new FormData();
		form.set('name', 'Test User');
		form.set('email', 'test@example.com');
		form.set('attendees', '99');
		form.set('routePreference', 'Hatchling Loop');
		form.set('notes', '');

		await expect(saveJoin(platform, form)).rejects.toThrow();
	});

	it('saves volunteer payload', async () => {
		const { platform, bind, run } = makePlatform();
		const form = new FormData();
		form.set('name', 'Volunteer User');
		form.set('email', 'vol@example.com');
		form.set('rolePreference', 'Course Marshal');
		form.set('availability', '9:00am-10:30am');
		form.set('notes', 'Can help early');

		await saveVolunteer(platform, form);

		expect(bind).toHaveBeenCalledWith(
			'Volunteer User',
			'vol@example.com',
			'Course Marshal',
			'9:00am-10:30am',
			'Can help early'
		);
		expect(run).toHaveBeenCalledOnce();
	});

	it('saves reminder payload', async () => {
		const { platform, bind, run } = makePlatform();
		const form = new FormData();
		form.set('email', 'remind@example.com');

		await saveReminder(platform, form);

		expect(bind).toHaveBeenCalledWith('remind@example.com');
		expect(run).toHaveBeenCalledOnce();
	});

	it('fails when DB binding is missing', async () => {
		const form = new FormData();
		form.set('email', 'remind@example.com');

		await expect(saveReminder(undefined, form)).rejects.toThrow();
	});
});
