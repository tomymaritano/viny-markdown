<script lang="ts">
  import { syncStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import { AlertCircle, RefreshCw, Cloud, Upload, Check, ArrowDown, ArrowUp } from '@lucide/svelte';

  let showDetails = $state(false);

  function formatLastSync(dateStr: string | null): string {
    if (!dateStr) return 'Never';

    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  async function handleSync() {
    if (syncStore.isSyncing) return;

    if (!syncStore.isConfigured) {
      toast.info('Set up a sync server in Settings');
      return;
    }

    const result = await syncStore.syncWithServer();
    if (result) {
      const total = result.pulled.notes + result.pulled.notebooks + result.pulled.tags +
                    result.pushed.notes + result.pushed.notebooks + result.pushed.tags;
      if (total > 0) {
        toast.success(`Synced ${total} item${total !== 1 ? 's' : ''}`);
      } else {
        toast.success('Already up to date');
      }
    }
  }

  function getStatusColor(): string {
    if (syncStore.hasError) return 'var(--error)';
    if (syncStore.isSyncing) return 'var(--warning)';
    if (syncStore.pendingChanges > 0) return 'var(--accent)';
    return 'var(--success)';
  }

  function getStatusText(): string {
    if (syncStore.hasError) return 'Sync error';
    if (syncStore.isSyncing) return 'Syncing...';
    if (!syncStore.isConfigured) return 'Not configured';
    if (syncStore.pendingChanges > 0) return `${syncStore.pendingChanges} pending`;
    return 'Synced';
  }
</script>

<div class="sync-indicator">
  <button
    class="sync-btn"
    onclick={handleSync}
    onmouseenter={() => showDetails = true}
    onmouseleave={() => showDetails = false}
    disabled={syncStore.isSyncing}
    title="Click to sync"
    aria-label={syncStore.isSyncing ? 'Syncing in progress' : 'Click to sync'}
  >
    <span class="sync-icon" class:syncing={syncStore.isSyncing}>
      {#if syncStore.hasError}
        <AlertCircle size={14} />
      {:else if syncStore.isSyncing}
        <RefreshCw size={14} />
      {:else if !syncStore.isConfigured}
        <Cloud size={14} />
      {:else if syncStore.pendingChanges > 0}
        <Upload size={14} />
      {:else}
        <Check size={14} />
      {/if}
    </span>
    <span class="sync-status" style:color={getStatusColor()}>
      {getStatusText()}
    </span>
  </button>

  {#if showDetails && syncStore.isConfigured}
    <div class="sync-details" role="tooltip">
      <div class="detail-row">
        <span class="detail-label">Last sync:</span>
        <span class="detail-value">{formatLastSync(syncStore.lastSyncedAt)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Server:</span>
        <span class="detail-value server">{syncStore.serverUrl || 'Not set'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Pending:</span>
        <span class="detail-value">{syncStore.pendingChanges} changes</span>
      </div>
      {#if syncStore.autoSyncEnabled}
        <div class="detail-row">
          <span class="detail-label">Auto-sync:</span>
          <span class="detail-value">{Math.round(syncStore.autoSyncInterval / 1000)}s</span>
        </div>
      {/if}
      {#if syncStore.hasError && syncStore.error}
        <div class="detail-error">
          {syncStore.error}
        </div>
      {/if}
      {#if syncStore.lastResult}
        <div class="detail-section">
          <span class="detail-subtitle">Last sync:</span>
          <div class="sync-stats">
            <span><ArrowDown size={12} /> {syncStore.lastResult.pulled.notes + syncStore.lastResult.pulled.notebooks} pulled</span>
            <span><ArrowUp size={12} /> {syncStore.lastResult.pushed.notes + syncStore.lastResult.pushed.notebooks} pushed</span>
          </div>
        </div>
      {/if}
      {#if syncStore.conflicts.length > 0}
        <div class="detail-conflicts">
          {syncStore.conflicts.length} conflict{syncStore.conflicts.length !== 1 ? 's' : ''}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sync-indicator {
    position: relative;
    display: flex;
    align-items: center;
  }

  .sync-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sync-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .sync-btn:disabled {
    cursor: default;
  }

  .sync-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sync-icon.syncing :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .sync-status {
    font-size: 11px;
    font-weight: 500;
  }

  .sync-details {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    z-index: 100;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 12px;
  }

  .detail-label {
    color: var(--text-tertiary);
  }

  .detail-value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .detail-value.server {
    font-size: 10px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .detail-subtitle {
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .sync-stats {
    display: flex;
    gap: 12px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .sync-stats span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .detail-error {
    margin-top: 8px;
    padding: 8px;
    background: var(--error-light);
    border-radius: 4px;
    font-size: 11px;
    color: var(--error);
  }

  .detail-conflicts {
    margin-top: 8px;
    padding: 6px 8px;
    background: var(--warning-light);
    border-radius: 4px;
    font-size: 11px;
    color: var(--warning-dark);
    font-weight: 500;
  }
</style>
