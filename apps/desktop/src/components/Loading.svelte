<script lang="ts">
  let { size = 'medium', text = '' } = $props<{ size?: 'small' | 'medium' | 'large'; text?: string }>();
</script>

<div class="loading {size}">
  <div class="spinner"></div>
  {#if text}
    <span class="loading-text">{text}</span>
  {/if}
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
  }

  .spinner {
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading.small .spinner {
    width: 16px;
    height: 16px;
  }

  .loading.medium .spinner {
    width: 24px;
    height: 24px;
  }

  .loading.large .spinner {
    width: 36px;
    height: 36px;
    border-width: 3px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 14px;
    color: var(--text-secondary);
  }
</style>
