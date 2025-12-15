<script lang="ts">
  import { syncStore } from '$lib/stores';
  import type { SyncConflict } from '$lib/bindings';

  let { open = $bindable(false) } = $props();

  function getEntityIcon(type: string): string {
    switch (type) {
      case 'note': return '📝';
      case 'notebook': return '📁';
      case 'tag': return '🏷️';
      default: return '📄';
    }
  }

  function getResolutionLabel(resolution: string): string {
    return resolution === 'local_wins' ? 'Kept local' : 'Used remote';
  }

  function close() {
    open = false;
  }

  function clearAll() {
    syncStore.clearConflicts();
    close();
  }
</script>

{#if open}
  <div class="modal-backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="0">
    <div class="modal" role="dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <h2>Sync Conflicts</h2>
        <button class="close-btn" onclick={close}>✕</button>
      </header>

      <div class="modal-content">
        {#if syncStore.conflicts.length === 0}
          <div class="empty-state">
            <span class="empty-icon">✓</span>
            <p>No conflicts to resolve</p>
          </div>
        {:else}
          <p class="description">
            The following items had conflicts during sync. They were automatically resolved using the Last Write Wins strategy.
          </p>

          <div class="conflicts-list">
            {#each syncStore.conflicts as conflict (conflict.entity_id)}
              <div class="conflict-item">
                <div class="conflict-icon">{getEntityIcon(conflict.entity_type)}</div>
                <div class="conflict-info">
                  <div class="conflict-type">{conflict.entity_type}</div>
                  <div class="conflict-id">{conflict.entity_id.slice(0, 8)}...</div>
                </div>
                <div class="conflict-revisions">
                  <span class="revision local">Local: r{conflict.local_revision}</span>
                  <span class="revision remote">Remote: r{conflict.remote_revision}</span>
                </div>
                <div class="conflict-resolution" class:local={conflict.resolution === 'local_wins'}>
                  {getResolutionLabel(conflict.resolution)}
                </div>
              </div>
            {/each}
          </div>

          <div class="modal-footer">
            <button class="action-btn" onclick={clearAll}>
              Acknowledge All
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    color: var(--success);
  }

  .description {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .conflicts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .conflict-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .conflict-icon {
    font-size: 20px;
  }

  .conflict-info {
    flex: 1;
    min-width: 0;
  }

  .conflict-type {
    font-size: 13px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .conflict-id {
    font-size: 11px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
  }

  .conflict-revisions {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .revision {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .revision.local {
    background: var(--accent-light);
    color: var(--accent);
  }

  .revision.remote {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .conflict-resolution {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--warning-light);
    color: var(--warning);
  }

  .conflict-resolution.local {
    background: var(--accent-light);
    color: var(--accent);
  }

  .modal-footer {
    padding-top: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
  }

  .action-btn {
    padding: 10px 20px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
  }

  .action-btn:hover {
    background: var(--accent-dark);
  }
</style>
