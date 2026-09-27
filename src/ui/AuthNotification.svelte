<script lang="ts">
	import { Check, X } from '@lucide/svelte'

	let {
		visible = $bindable(false),
		title = 'Notice',
		message = '',
		onClose = () => {},
		ctaLabel = null,
		onCta = () => {}
	}: {
		visible?: boolean
		title?: string
		message?: string
		onClose?: () => void
		ctaLabel?: string | null
		onCta?: () => void
	} = $props()

	function close() {
		visible = false
		onClose()
	}
</script>

{#if visible}
	<div class="auth-notification" role="alert">
		<div class="auth-notification__content">
			<div class="auth-notification__icon">
				<Check size={18} />
			</div>

			<div class="auth-notification__body">
				<h3 class="auth-notification__title">{title}</h3>
				<p class="auth-notification__message">{message}</p>
				{#if ctaLabel}
					<button type="button" class="auth-notification__action" onclick={onCta}>{ctaLabel}</button>
				{/if}
			</div>

			<button type="button" class="auth-notification__close" onclick={close} aria-label="Close notification"
				><X size={18} /></button
			>
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
		box-shadow: var(--auth-shadow-lg, 0 12px 30px rgba(0, 0, 0, 0.35));
		border: 1px solid var(--auth-success-border, rgba(34, 197, 94, 0.3));
		z-index: var(--auth-z-toast, 1200);
		animation: auth-notification-slide-in 0.3s ease-out;
	}
	@keyframes auth-notification-slide-in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	.auth-notification__content {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
	}
	.auth-notification__icon {
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
	.auth-notification__title {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		color: var(--auth-text-primary, #f5f5f5);
	}
	.auth-notification__message {
		margin: 0;
		color: var(--auth-text-secondary, rgba(255, 255, 255, 0.7));
		line-height: 1.5;
	}
	.auth-notification__action {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: var(--auth-accent, #8b5cf6);
		color: #fff;
		border: none;
		border-radius: var(--auth-radius-sm, 10px);
		cursor: pointer;
	}
	.auth-notification__close {
		background: none;
		border: none;
		color: var(--auth-text-secondary, rgba(255, 255, 255, 0.7));
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: var(--auth-radius-sm, 10px);
	}
	.auth-notification__close:hover {
		background: var(--auth-bg-secondary, rgba(255, 255, 255, 0.06));
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
