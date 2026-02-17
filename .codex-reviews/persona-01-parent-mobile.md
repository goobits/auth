## Punchlist (Ordered By Severity)

1. **Where:** `/join` form submit + any validation/anti-bot failure (no on-page error UI) (`src/routes/join/+page.svelte:17-48`, `src/routes/join/+page.server.ts:6-13`, `src/lib/server/turnstile.ts:53-71`, `src/lib/server/submissions/validators.ts:37-41`)
- **Issue:** If anything goes wrong (Turnstile not completed, Turnstile misconfigured, honeypot trips, server validation), the action throws an error and the page has nowhere to show it inline. As a parent on a phone, seeing a generic error page (or nothing obvious) is an instant abandon.
- **Fix:** Make `/join` follow the same pattern as auth pages: return `fail(400, { success:false, error:"…" })` and render `<p class="flow-page__error">{form.error}</p>` (see how it’s done in `src/routes/auth/sign-in/+page.svelte:20-22` and `src/routes/auth/sign-in/+page.server.ts:29-44`).

2. **Where:** `/join` anti-bot block shows scary “not configured” copy (`src/lib/components/TurnstileField.svelte:7-13`)
- **Issue:** On a real signup form, “Anti-bot check is not configured yet.” reads like “this site is broken / sketchy.” I would bail immediately.
- **Fix:** If the site key is missing, don’t show that message to end users. Replace with either nothing (hide the block) or a friendly fallback like: “Verification is temporarily unavailable. Please email `hello@pdx.run` to reserve your spot.” (and ensure server behavior matches).

3. **Where:** `/join` “Preferred route” required, but options have no distance/context (`src/routes/join/+page.svelte:31-38` vs route details in `src/lib/content/event.ts:53-98`)
- **Issue:** “Hatchling Loop / Raptor Ramble / T-Rex Trek” means nothing if I’m signing up in 30 seconds. I’d worry I’m picking the wrong one for kids/stroller.
- **Fix:** Change the select labels to include the key info already in content, e.g. `Hatchling Loop (~1 mile, stroller-friendly)` etc. (`src/lib/content/event.ts:55-63`, `70-78`, `85-93`). Or add a default option `Not sure yet` and make the field optional.

4. **Where:** `/join` missing trust/privacy/cost reassurance on the actual signup screen (`src/routes/join/+page.svelte:13-16`), while “free” is only elsewhere (`src/lib/content/event.ts:23-26`, `src/lib/content/engagement.ts:42-45`, `src/lib/content/engagement.ts:69-72`)
- **Issue:** The join page asks for my email without saying “no spam,” “no selling,” and (critically) “free to participate / donation optional.” That ambiguity is high abandon for parents.
- **Fix:** Add 1–2 lines under the intro copy on `/join`: “Free to participate. Donations optional.” + “We’ll only email about this event (no marketing).” Reuse the tone from the reminder copy (“One email… That is it.” `src/lib/content/engagement.ts:71`).

5. **Where:** `/join` has no brand/footer/contact on the page (only the form + “Back Home”) (`src/routes/join/+page.svelte:10-51`), while homepage footer has contact (`src/lib/components/Footer.svelte:13-17`)
- **Issue:** On a signup form, I want an immediate “who is this / how do I reach you if something breaks.” Without visible contact, it feels risky.
- **Fix:** Include a minimal header/brand and a small footer line on `/join` with “Questions? `hello@pdx.run`” and link to Code of Conduct (footer link exists on home: `src/lib/components/Footer.svelte:16`).

6. **Where:** `/join` field friction for fast mobile entry: no autofill hints, unclear “Name” meaning, attendee count UX (`src/routes/join/+page.svelte:19-30`)
- **Issue:** In 30 seconds, I want autofill. Also “Name” could mean each attendee’s name. Number steppers can be fiddly on phones.
- **Fix:** Add `autocomplete="name"` to Name and `autocomplete="email"` to Email (auth pages already do this: `src/routes/auth/sign-in/+page.svelte:28`). Add helper text: “One contact name for your group.” Consider a simpler attendee control (preset buttons or a select), and add help text for the max: “More than 20? Email us.”

7. **Where:** Homepage mobile navigation makes “Join” less discoverable after you scroll (menu-only header + delayed CTA bar) (`src/lib/components/Header.svelte:70-79`, `src/lib/styles/components/_header.scss:30-34`, `src/lib/components/MobileCtaBar.svelte:8-22`)
- **Issue:** On mobile, the header shows only a “Menu” button (the nav with “Join the Herd” is `display:none` until wider screens). The sticky CTA appears only after scrolling past ~520px. If I scroll a bit and then decide to join, I might not find it quickly.
- **Fix:** Put a visible “Join” button in the mobile header (next to “Menu”), or lower the CTA-bar threshold (`window.scrollY > 520` in `src/lib/components/MobileCtaBar.svelte:8`) so it appears sooner.

8. **Where:** `/thanks` page doesn’t set expectations for confirmation timing or next step beyond “Back Home / Donate” (`src/routes/thanks/+page.svelte:10-13`, `43-46`)
- **Issue:** I’ll wonder: “Did it work? Will I get an email now?” If nothing arrives, I assume failure and abandon.
- **Fix:** Add a line for `/thanks?type=join`: “You won’t get an email immediately. We’ll email details closer to race day. If you need to change anything, contact `hello@pdx.run`.” Add a direct “View routes” link too.