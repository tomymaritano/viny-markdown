<script lang="ts">
  import { onMount } from 'svelte';
  import { toast, type Toast } from '$lib/toast';

  let toasts = $state<Toast[]>([]);

  onMount(() => {
    return toast.subscribe((t) => {
      toasts = t;
    });
  });

  function getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
    }
  }
</script>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as t (t.id)}
      <div class="toast {t.type}" role="alert">
        <span class="toast-icon">{getIcon(t.type)}</span>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.dismiss(t.id)}>✕</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 2000;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--bg-primary);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border);
    min-width: 280px;
    max-width: 400px;
    pointer-events: auto;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .toast.success .toast-icon {
    color: var(--success);
  }

  .toast.error .toast-icon {
    color: var(--error);
  }

  .toast.warning .toast-icon {
    color: var(--warning);
  }

  .toast.info .toast-icon {
    color: var(--accent);
  }

  .toast-message {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
  }

  .toast-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    opacity: 0.6;
  }

  .toast-close:hover {
    opacity: 1;
  }
</style>
