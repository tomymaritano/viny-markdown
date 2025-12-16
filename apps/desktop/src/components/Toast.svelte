<script lang="ts">
  import { onMount } from 'svelte';
  import { toast, type Toast } from '$lib/toast';
  import { Check, X, AlertTriangle, Info } from '@lucide/svelte';

  let toasts = $state<Toast[]>([]);

  onMount(() => {
    return toast.subscribe((t) => {
      toasts = t;
    });
  });
</script>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as t (t.id)}
      <div class="toast {t.type}" role="alert">
        <span class="toast-icon">
          {#if t.type === 'success'}
            <Check size={18} strokeWidth={2.5} />
          {:else if t.type === 'error'}
            <X size={18} strokeWidth={2.5} />
          {:else if t.type === 'warning'}
            <AlertTriangle size={18} strokeWidth={2} />
          {:else}
            <Info size={18} strokeWidth={2} />
          {/if}
        </span>
        <span class="toast-message">{t.message}</span>
        <button class="toast-close" onclick={() => toast.dismiss(t.id)} aria-label="Dismiss">
          <X size={14} strokeWidth={2} />
        </button>
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
    display: flex;
    align-items: center;
    justify-content: center;
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
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
  }

  .toast-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
</style>
