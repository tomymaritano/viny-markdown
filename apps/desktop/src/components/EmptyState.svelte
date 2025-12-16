<script lang="ts">
  let {
    icon = 'Empty',
    title = 'No items',
    description = '',
    action = null as { label: string; onclick: () => void } | null,
  } = $props();
</script>

<div class="empty-state">
  <span class="empty-icon">{icon}</span>
  <h3 class="empty-title">{title}</h3>
  {#if description}
    <p class="empty-description">{description}</p>
  {/if}
  {#if action}
    <button class="empty-action" onclick={action.onclick}>
      {action.label}
    </button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.8;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .empty-description {
    font-size: 14px;
    color: var(--text-secondary);
    max-width: 300px;
    line-height: 1.5;
  }

  .empty-action {
    margin-top: 16px;
    padding: 10px 20px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
  }

  .empty-action:hover {
    background: var(--accent-dark);
  }
</style>
