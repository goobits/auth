import { expect, test } from '@playwright/test';

test('attendee signup flow redirects to thanks', async ({ page }) => {
	await page.goto('/join');
	await page.getByLabel('Name').fill('Playwright Runner');
	await page.getByLabel('Email').fill('playwright+join@example.com');
	await page.getByLabel(/How many people\?/i).fill('3');
	await page.getByLabel(/Preferred route/i).selectOption({ label: 'Hatchling Loop' });
	await page.getByLabel(/Notes \(optional\)/i).fill('Excited for the event');
	await page.getByRole('button', { name: /submit signup/i }).click();

	await expect(page).toHaveURL(/\/thanks\?type=join$/);
	await expect(page.getByRole('heading', { name: /you are in the herd/i })).toBeVisible();
});

test('volunteer signup flow redirects to thanks', async ({ page }) => {
	await page.goto('/volunteer');
	await page.getByLabel('Name').fill('Playwright Volunteer');
	await page.getByLabel('Email').fill('playwright+volunteer@example.com');
	await page.getByLabel(/Role preference/i).selectOption({ label: 'Course Marshal' });
	await page.getByLabel(/Availability/i).selectOption({ label: '9:00am-10:30am' });
	await page.getByLabel(/Notes \(optional\)/i).fill('Happy to help with setup');
	await page.getByRole('button', { name: /submit volunteer form/i }).click();

	await expect(page).toHaveURL(/\/thanks\?type=volunteer$/);
	await expect(page.getByRole('heading', { name: /thanks for volunteering/i })).toBeVisible();
});

test('reminder form redirects to thanks', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('Email address').fill('playwright+remind@example.com');
	await page.getByRole('button', { name: /remind me/i }).click();

	await expect(page).toHaveURL(/\/thanks\?type=remind$/);
	await expect(page.getByRole('heading', { name: /reminder saved/i })).toBeVisible();
});
