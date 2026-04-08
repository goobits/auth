<script>
  import { onMount, onDestroy } from "svelte";

  let {
    visible = $bindable(false),
    backupCodes = [],
    isNewEnrollment = false,
    onClose = () => {},
    onAcknowledge = () => {},
  } = $props();

  let acknowledged = $state(false);
  let copyStatus = $state("");
  let modalEl = $state(null);

  function handleDownload() {
    if (!backupCodes || backupCodes.length === 0) return;

    const content = `Auth Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\nIMPORTANT: Keep these codes in a safe place!\nEach code can only be used once.\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join("\n")}\n\nIf you lose access to your authenticator app, you can use one of these\nbackup codes to sign in to your account.\n`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopyToClipboard() {
    if (!backupCodes || backupCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      copyStatus = "Copied to clipboard.";
    } catch {
      copyStatus = "Copy failed. Please download instead.";
    }
  }

  function handleAcknowledge() {
    if (!acknowledged) return;
    visible = false;
    onAcknowledge();
    onClose();
  }

  function close() {
    visible = false;
    onClose();
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = modalEl?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    acknowledged = false;
    copyStatus = "";
    if (visible) {
      setTimeout(() => {
        modalEl?.focus();
      }, 0);
    }
    const onKey = (e) => handleKeydown(e);
    window.addEventListener("keydown", onKey);
    onDestroy(() => window.removeEventListener("keydown", onKey));
  });
</script>

{#if visible}
  <div class="modal-overlay" role="presentation">
    <div
      class="modal-content"
      bind:this={modalEl}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
    >
      <div class="modal-header">
        <h2>
          {isNewEnrollment
            ? "Save Your Backup Codes"
            : "New Backup Codes Generated"}
        </h2>
        <button
          type="button"
          class="close-button"
          onclick={close}
          aria-label="Close dialog">×</button
        >
      </div>

      <div class="modal-body">
        <div class="warning-box">
          <div class="icon">!</div>
          <div>
            <strong>Important:</strong>
            <p>
              Save these backup codes in a secure location. Each code can only
              be used once.
            </p>
            {#if !isNewEnrollment}
              <p class="warning-text">
                Your previous backup codes have been invalidated.
              </p>
            {/if}
          </div>
        </div>

        <div class="backup-codes-container">
          {#each backupCodes as code, index}
            <div class="backup-code">
              <span class="code-number">{index + 1}.</span>
              <span class="code-value">{code}</span>
            </div>
          {/each}
        </div>

        <div class="action-buttons">
          <button
            type="button"
            class="secondary-button"
            onclick={handleDownload}
          >
            Download Codes
          </button>
          <button
            type="button"
            class="secondary-button"
            onclick={handleCopyToClipboard}
          >
            Copy to Clipboard
          </button>
        </div>
        {#if copyStatus}
          <p class="copy-status">{copyStatus}</p>
        {/if}

        <div class="acknowledgment">
          <label class="ui-form-check checkbox-label">
            <input
              class="ui-form-check__control"
              type="checkbox"
              bind:checked={acknowledged}
            />
            <span>I have saved these backup codes in a secure location</span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="primary-button"
          onclick={handleAcknowledge}
          disabled={!acknowledged}
        >
          Continue
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--auth-z-modal, 1000);
    padding: 1rem;
  }
  .modal-content {
    background: var(--auth-surface, #111);
    border-radius: var(--auth-radius-lg, 16px);
    box-shadow: var(--auth-shadow-xl, 0 20px 50px rgba(0, 0, 0, 0.4));
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    outline: none;
  }
  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--auth-border, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .modal-header h2 {
    margin: 0;
    color: var(--auth-text-primary, #f5f5f5);
    font-size: 1.5rem;
  }
  .close-button {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--auth-text-primary, #f5f5f5);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.5rem;
  }
  .close-button:hover {
    background: var(--auth-bg-secondary, rgba(255, 255, 255, 0.06));
  }
  .modal-body {
    padding: 1.5rem;
  }
  .warning-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--auth-warning-bg, rgba(255, 193, 7, 0.1));
    color: var(--auth-warning-text, #f0c12b);
    border-radius: var(--auth-radius-md, 12px);
    margin-bottom: 1.5rem;
  }
  .warning-box .icon {
    font-weight: 700;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--auth-warning-text, #f0c12b);
    color: #000;
    flex-shrink: 0;
  }
  .warning-text {
    color: var(--auth-error-text, #ff6b6b);
    font-weight: 500;
  }
  .backup-codes-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--auth-bg-secondary, rgba(255, 255, 255, 0.04));
    border-radius: var(--auth-radius-md, 12px);
    margin-bottom: 1rem;
  }
  @media (max-width: 480px) {
    .backup-codes-container {
      grid-template-columns: 1fr;
    }
  }
  .backup-code {
    display: flex;
    gap: 0.5rem;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 1rem;
  }
  .code-number {
    color: var(--auth-text-secondary, rgba(255, 255, 255, 0.6));
  }
  .code-value {
    color: var(--auth-text-primary, #f5f5f5);
    font-weight: 600;
  }
  .action-buttons {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .secondary-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background-color: var(--auth-surface, #111);
    color: var(--auth-text-primary, #f5f5f5);
    border: 1px solid var(--auth-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--auth-radius-md, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .secondary-button:hover {
    background-color: var(--auth-bg-secondary, rgba(255, 255, 255, 0.06));
  }
  .copy-status {
    color: var(--auth-text-secondary, rgba(255, 255, 255, 0.6));
    margin: 0 0 1rem;
  }
  .acknowledgment {
    padding: 1rem;
    background-color: var(--auth-bg-secondary, rgba(255, 255, 255, 0.04));
    border-radius: var(--auth-radius-md, 12px);
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
    color: var(--auth-text-primary, #f5f5f5);
    font-weight: 500;
  }
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--auth-border, rgba(255, 255, 255, 0.1));
    display: flex;
    justify-content: flex-end;
  }
  .primary-button {
    padding: 0.75rem 2rem;
    background-color: var(--auth-accent, #8b5cf6);
    color: white;
    border: none;
    border-radius: var(--auth-radius-md, 12px);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .primary-button:disabled {
    background-color: var(--auth-bg-tertiary, rgba(255, 255, 255, 0.1));
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
