<script lang="ts">
	import { enhance } from '$app/forms';
</script>

<svelte:head>
	<title>Volunteer | pdx.run</title>
</svelte:head>

<section class="flow-page">
	<div class="layout__container">
		<div class="flow-page__card">
			<p class="layout__eyebrow">Volunteer signup</p>
			<h1 class="layout__title">Volunteer for a 90-minute shift</h1>
			<p class="flow-page__copy">Pick a role and availability. We will follow up with assignment details.</p>

			<form class="flow-form" method="POST" use:enhance>
				<input class="flow-form__honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
				<label class="flow-form__field">
					<span class="flow-form__label">Name</span>
					<input class="flow-form__control" name="name" required maxlength="80" />
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Email</span>
					<input class="flow-form__control" name="email" type="email" required maxlength="140" />
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Role preference</span>
					<select class="flow-form__control" name="rolePreference" required>
						<option value="Course Marshal">Course Marshal</option>
						<option value="Check-In Buddy">Check-In Buddy</option>
						<option value="Setup / Takedown">Setup / Takedown</option>
						<option value="Sweep Walker">Sweep Walker</option>
					</select>
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Availability</span>
					<select class="flow-form__control" name="availability" required>
						<option value="9:00am-10:30am">9:00am-10:30am</option>
						<option value="10:30am-12:00pm">10:30am-12:00pm</option>
						<option value="12:00pm-1:30pm">12:00pm-1:30pm</option>
						<option value="Flexible">Flexible</option>
					</select>
				</label>
				<label class="flow-form__field">
					<span class="flow-form__label">Notes (optional)</span>
					<textarea class="flow-form__control" name="notes" rows="4" maxlength="1200"></textarea>
				</label>
				<div class="flow-form__actions">
					<button class="c-button c-button--primary c-button--large" type="submit">Submit Volunteer Form</button>
					<a class="c-button c-button--secondary" href="/">Back Home</a>
				</div>
			</form>
		</div>
	</div>
</section>
