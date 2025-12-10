<script lang="ts">
  let { show = $bindable(false), onupdate }: { show: boolean; onupdate: () => void } = $props();
</script>

{#if show}
  <div class="update-notification">
    <span>A new version is available!</span>
    <button onclick={onupdate}>Refresh</button>
    <button class="dismiss" onclick={() => show = false}>Later</button>
  </div>
{/if}

<style>
  .update-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--accent-color, #007AFF);
    color: white;
    padding: 12px 20px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: slideUp 0.3s ease-out;
    font-size: 14px;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  button {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }

  button:first-of-type {
    background: white;
    color: var(--accent-color, #007AFF);
  }

  button:first-of-type:hover {
    background: #f0f0f0;
  }

  .dismiss {
    background: transparent;
    color: white;
    opacity: 0.8;
  }

  .dismiss:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    .update-notification {
      bottom: env(safe-area-inset-bottom, 20px);
      left: 16px;
      right: 16px;
      transform: none;
      justify-content: space-between;
    }

    span {
      flex: 1;
    }
  }
</style>
