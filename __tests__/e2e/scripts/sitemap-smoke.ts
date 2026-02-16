import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3610';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const NAV_TIMEOUT_MS = Number(process.env.E2E_NAV_TIMEOUT_MS || 20000);

function unique(values) {
	return [...new Set(values)];
}

function parseSitemapLocs(xmlText) {
	const matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]?.trim()).filter(Boolean);
	return unique(matches);
}

async function fetchSitemapUrls() {
	const res = await fetch(SITEMAP_URL);
	if (!res.ok) {
		throw new Error(`Failed to load sitemap.xml (${res.status}) at ${SITEMAP_URL}`);
	}
	const xml = await res.text();
	const urls = parseSitemapLocs(xml);
	if (urls.length === 0) {
		throw new Error(`No <loc> entries found in sitemap.xml at ${SITEMAP_URL}`);
	}
	return urls;
}

function shouldIgnoreConsoleError(text) {
	const knownNoise = [
		'Failed to load resource: the server responded with a status of 404',
		'favicon.ico'
	];
	return knownNoise.some((entry) => text.includes(entry));
}

export async function runSitemapSmoke() {
	const urls = await fetchSitemapUrls();
	console.log(`[sitemap-smoke] Checking ${urls.length} URL(s) from ${SITEMAP_URL}`);

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();

	const failures = [];

	for (const url of urls) {
		const page = await context.newPage();
		const pageIssues = [];

		page.on('console', (msg) => {
			if (msg.type() !== 'error') return;
			const text = msg.text();
			if (shouldIgnoreConsoleError(text)) return;
			pageIssues.push({ type: 'console-error', detail: text });
		});

		page.on('pageerror', (err) => {
			pageIssues.push({ type: 'page-error', detail: err?.message || String(err) });
		});

		page.on('response', (res) => {
			const status = res.status();
			if (status >= 500) {
				pageIssues.push({ type: 'response-5xx', detail: `${status} ${res.url()}` });
			}
		});

		try {
			const response = await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
			if (!response) {
				pageIssues.push({ type: 'navigation', detail: 'No response from page.goto()' });
			} else {
				const status = response.status();
				if (status >= 500) {
					pageIssues.push({ type: 'navigation-5xx', detail: `${status} ${url}` });
				}
			}
		} catch (error) {
			pageIssues.push({ type: 'navigation-exception', detail: error?.message || String(error) });
		}

		await page.close();

		if (pageIssues.length > 0) {
			failures.push({ url, issues: pageIssues });
		}
	}

	await context.close();
	await browser.close();

	if (failures.length > 0) {
		console.error(`\n[sitemap-smoke] FAIL: ${failures.length} URL(s) reported issues.`);
		for (const failure of failures) {
			console.error(`\n- ${failure.url}`);
			for (const issue of failure.issues) {
				console.error(`  [${issue.type}] ${issue.detail}`);
			}
		}
		process.exit(1);
	}

	console.log('[sitemap-smoke] PASS: no console errors, page errors, or 5xx responses detected.');
}
