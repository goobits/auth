import { expect, test } from '@playwright/test';

const routes = ['/', '/join', '/volunteer', '/donate', '/routes', '/code-of-conduct', '/thanks', '/auth/sign-in', '/auth/sign-up'];

test.describe('page availability', () => {
	for (const path of routes) {
		test(`GET ${path} renders`, async ({ page }) => {
			await page.goto(path);
			await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}$`));
		});
	}
});

test('home page has core CTAs', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: /join the herd/i }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: /^donate$/i }).first()).toBeVisible();
});
