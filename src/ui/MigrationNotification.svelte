<script>
	let {
		visible = $bindable(false),
		migrationSuccess = false,
		backupCodesRegenerated = false,
		newBackupCodes = null,
		onAcknowledge = () => {},
		onDownloadBackupCodes = () => {}
	} = $props()

	function handleAcknowledge() {
		visible = false
		onAcknowledge()
	}

	function handleDownloadCodes() {
		if (newBackupCodes && newBackupCodes.length > 0) {
			onDownloadBackupCodes(newBackupCodes)
		}
	}
</script>

{#if visible && migrationSuccess}
	<div class="auth-migration-notification" role="alert">
		<div class="notification-content">
			<div class="notification-icon success">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>

			<div class="notification-body">
				<h3>Account Upgraded</h3>
				<p>
					Your account has been successfully upgraded to our new authentication system.
					{#if backupCodesRegenerated}
						Your MFA backup codes have been regenerated.
					{/if}
				</p>

				{#if backupCodesRegenerated && newBackupCodes && newBackupCodes.length > 0}
					<div class="backup-codes-notice">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div>
							<strong>Important:</strong> New backup codes have been generated.
							<button
								type="button"
								class="download-button"
								onclick={handleDownloadCodes}
							>
								Download Backup Codes
							</button>
						</div>
					</div>
				{/if}
			</div>

			<button
				type="button"
				class="close-button"
				onclick={handleAcknowledge}
				aria-label="Close notification"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.auth-migration-notification {
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
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.notification-content {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
	}

	.notification-icon {
		flex-shrink: 0;

		&.success {
			color: var(--auth-success, #22c55e);
		}
	}

	.notification-body {
		flex: 1;

		h3 {
			margin: 0 0 0.5rem 0;
			font-size: 1.125rem;
			color: var(--auth-text-primary, #f5f5f5);
		}

		p {
			margin: 0 0 1rem 0;
			color: var(--auth-text-secondary, rgba(255,255,255,0.7));
			line-height: 1.5;

			&:last-child {
				margin-bottom: 0;
			}
		}
	}

	.backup-codes-notice {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background-color: var(--auth-warning-bg, rgba(255,193,7,0.1));
		color: var(--auth-warning-text, #f0c12b);
		border-radius: var(--auth-radius-md, 12px);
		margin-top: 1rem;

		svg {
			flex-shrink: 0;
		}

		strong {
			display: block;
			margin-bottom: 0.5rem;
		}
	}

	.download-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background-color: var(--auth-accent, #8b5cf6);
		color: #fff;
		border: none;
		border-radius: var(--auth-radius-sm, 10px);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		margin-top: 0.5rem;
		transition: background-color 0.2s ease;

		&:hover {
			background-color: var(--auth-accent-light, #9f7aea);
		}
	}

	.close-button {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--auth-text-secondary, rgba(255,255,255,0.7));
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--auth-radius-sm, 10px);
		transition: all 0.2s ease;

		&:hover {
			background-color: var(--auth-bg-secondary, rgba(255,255,255,0.06));
			color: var(--auth-text-primary, #f5f5f5);
		}
	}

	@media (max-width: 640px) {
		.auth-migration-notification {
			left: 1rem;
			right: 1rem;
			max-width: none;
		}
	}
</style>
