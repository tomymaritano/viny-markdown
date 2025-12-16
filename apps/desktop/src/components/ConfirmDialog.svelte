<script lang="ts">
  let {
    open = $bindable(false),
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm = () => {},
    onCancel = () => {},
  } = $props<{
    open?: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>();

  function handleConfirm() {
    onConfirm();
    open = false;
  }

  function handleCancel() {
    onCancel();
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="dialog-backdrop"
    onclick={handleCancel}
    onkeydown={handleKeydown}
    role="presentation"
  >
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <h3 class="dialog-title">{title}</h3>
      <p class="dialog-message">{message}</p>

      <div class="dialog-actions">
        <button class="btn cancel" onclick={handleCancel}>
          {cancelText}
        </button>
        <button class="btn confirm" class:destructive onclick={handleConfirm}>
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
  }

  .dialog {
    background: var(--bg-primary);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  }

  .dialog-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .dialog-message {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 24px 0;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn.cancel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }

  .btn.cancel:hover {
    background: var(--bg-hover);
  }

  .btn.confirm {
    background: var(--accent);
    border: 1px solid var(--accent);
    color: white;
  }

  .btn.confirm:hover {
    background: var(--accent-dark);
  }

  .btn.confirm.destructive {
    background: var(--error);
    border-color: var(--error);
  }

  .btn.confirm.destructive:hover {
    background: #c0392b;
  }
</style>
