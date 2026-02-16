<script lang="ts">
	import { enhance } from '$app/forms';
</script>

<svelte:head>
	<title>Join the Herd | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card">
			<p class="layout__eyebrow">Attendee signup</p>
			<h1 class="layout__title">Join the Herd</h1>
			<p class="flow-page__copy">Reserve your spot for PDX Dino Run. We will email event details before race day.</p>

			<form class="flow-form" method="POST" use:enhance>
				<input class="flow-form__honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
				<label class="flow-form__field">
					<span>Name</span>
					<input name="name" required maxlength="80" />
				</label>
				<label class="flow-form__field">
					<span>Email</span>
					<input name="email" type="email" required maxlength="140" />
				</label>
				<label class="flow-form__field">
					<span>How many people?</span>
					<input name="attendees" type="number" min="1" max="20" value="1" required />
				</label>
				<label class="flow-form__field">
					<span>Preferred route</span>
					<select name="routePreference" required>
						<option value="Hatchling Loop">Hatchling Loop</option>
						<option value="Raptor Ramble">Raptor Ramble</option>
						<option value="T-Rex Trek">T-Rex Trek</option>
					</select>
				</label>
				<label class="flow-form__field">
					<span>Notes (optional)</span>
					<textarea name="notes" rows="4" maxlength="1200"></textarea>
				</label>
				<div class="flow-form__actions">
					<button class="c-button c-button--primary c-button--large" type="submit">Submit Signup</button>
					<a class="c-button c-button--secondary" href="/">Back Home</a>
				</div>
			</form>
		</div>
	</div>
</section>
