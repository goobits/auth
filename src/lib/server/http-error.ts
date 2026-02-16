import { error } from '@sveltejs/kit';

export function raise(status: number, message: string): never {
	// eslint-disable-next-line @typescript-eslint/only-throw-error
	throw error(status, message);
}
