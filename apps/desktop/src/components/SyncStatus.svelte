<script lang="ts">
  import { syncStore } from '$lib/stores';
  import { onMount } from 'svelte';

  let { onOpenConflicts = () => {} } = $props<{ onOpenConflicts?: () => void }>();

  onMount(async () => {
    await syncStore.initialize();
  });

  function formatLastSync(dateStr: string | null): string {
    if (!dateStr) return 'Never synced';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  }

  function getStatusIcon(): string {
    if (syncStore.isSyncing) return '🔄';
    if (syncStore.hasError) return '⚠️';
    if (syncStore.pendingChanges > 0) return '📤';
    return '✓';
  }

  function getStatusText(): string {
    if (syncStore.isSyncing) return 'Syncing...';
    if (syncStore.hasError) return 'Sync error';
    if (syncStore.pendingChanges > 0) return `${syncStore.pendingChanges} pending`;
    return 'Synced';
  }
</script>

<div class="sync-status" class:error={syncStore.hasError} class:syncing={syncStore.isSyncing}>
  <div class="status-row">
    <span class="status-icon" class:spinning={syncStore.isSyncing}>
      {getStatusIcon()}
    </span>
    <span class="status-text">{getStatusText()}</span>
  </div>

  <div class="last-sync">
    {formatLastSync(syncStore.lastSyncedAt)}
  </div>

  {#if syncStore.hasError && syncStore.error}
    <div class="error-message">{syncStore.error}</div>
  {/if}

  {#if syncStore.conflicts.length > 0}
    <button class="conflicts-btn" onclick={onOpenConflicts}>
      {syncStore.conflicts.length} conflicts
    </button>
  {/if}
</div>

<style>
  .sync-status {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-icon {
    font-size: 14px;
  }

  .status-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .status-text {
    color: var(--text-secondary);
  }

  .sync-status.error .status-text {
    color: var(--error);
  }

  .last-sync {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  .error-message {
    color: var(--error);
    font-size: 11px;
    margin-top: 4px;
  }

  .conflicts-btn {
    margin-top: 8px;
    padding: 6px 12px;
    background: var(--warning-light);
    color: var(--warning);
    border: 1px solid var(--warning);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
</style>
