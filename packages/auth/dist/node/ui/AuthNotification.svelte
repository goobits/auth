<script>
	let {
		visible = $bindable(false),
		title = 'Notice',
		message = '',
		onClose = () => {},
		ctaLabel = null,
		onCta = () => {}
	} = $props()

	function close() {
		visible = false
		onClose()
	}
</script>

{#if visible}
	<div class="auth-notification" role="alert">
		<div class="notification-content">
			<div class="notification-icon">
				<span>✓</span>
			</div>

			<div class="notification-body">
				<h3>{title}</h3>
				<p>{message}</p>
				{#if ctaLabel}
					<button type="button" class="cta-button" onclick={onCta}>{ctaLabel}</button>
				{/if}
			</div>

			<button type="button" class="close-button" onclick={close} aria-label="Close notification">×</button>
		</div>
	</div>
{/if}

<style>
	.auth-notification {
		position: fixed;
		top: 1rem;
		right: 1rem;
		max-width: 480px;
		background: var(--auth-surface, #111);
		border-radius: var(--auth-radius-lg, 16px);
		box-shadow: var(--auth-shadow-lg, 0 12px 30px rgba(0,0,0,0.35));
		border: 1px solid var(--auth-success-border, rgba(34,197,94,0.3));
		z-index: var(--auth-z-toast, 1200);
		animation: slideIn 0.3s ease-out;
	}
	@keyframes slideIn {
		from { transform: translateX(100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
	.notification-content {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
	}
	.notification-icon {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--auth-success, #22c55e);
		color: #fff;
		font-weight: 700;
	}
	.notification-body h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: var(--auth-text-primary, #f5f5f5);
	}
	.notification-body p {
		margin: 0;
		color: var(--auth-text-secondary, rgba(255,255,255,0.7));
		line-height: 1.5;
	}
	.cta-button {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: var(--auth-accent, #8b5cf6);
		color: #fff;
		border: none;
		border-radius: var(--auth-radius-sm, 10px);
		cursor: pointer;
	}
	.close-button {
		background: none;
		border: none;
		color: var(--auth-text-secondary, rgba(255,255,255,0.7));
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--auth-radius-sm, 10px);
	}
	.close-button:hover {
		background: var(--auth-bg-secondary, rgba(255,255,255,0.06));
		color: var(--auth-text-primary, #f5f5f5);
	}
	@media (max-width: 640px) {
		.auth-notification {
			left: 1rem;
			right: 1rem;
			max-width: none;
		}
	}
</style>
