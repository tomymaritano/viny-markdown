<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';

  async function handleRestore() {
    const note = notesStore.selectedTrashedNote;
    if (!note) return;
    await notesStore.restoreNote(note.id);
  }

  async function handlePermanentDelete() {
    const note = notesStore.selectedTrashedNote;
    if (!note) return;
    if (confirm(`Permanently delete "${note.title || 'Untitled'}"? This cannot be undone.`)) {
      await notesStore.permanentlyDeleteNote(note.id);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
</script>

<main class="trash-viewer">
  {#if notesStore.selectedTrashedNote}
    <header class="viewer-header">
      <button class="mobile-back-btn" onclick={() => appStore.showMobileList()} aria-label="Back to trash list">
        ← Trash
      </button>
      <h1 class="title">{notesStore.selectedTrashedNote.title || 'Untitled'}</h1>
      <div class="viewer-actions">
        <button class="action-btn restore" onclick={handleRestore} title="Restore">
          Restore
        </button>
        <button class="action-btn delete" onclick={handlePermanentDelete} title="Delete Forever">
          Delete Forever
        </button>
      </div>
    </header>

    <div class="deleted-info">
      Deleted {formatDate(notesStore.selectedTrashedNote.deletedAt || notesStore.selectedTrashedNote.updatedAt)}
    </div>

    <div class="content-view">
      {notesStore.selectedTrashedNote.content || 'No content'}
    </div>

    <footer class="viewer-footer">
      <span class="word-count">
        {notesStore.selectedTrashedNote.content.split(/\s+/).filter(Boolean).length} words
      </span>
      <span class="info">Read-only preview</span>
    </footer>
  {:else}
    <div class="no-note">
      <p>Select a note from Trash to preview it</p>
    </div>
  {/if}
</main>

<style>
  .trash-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #fafafa;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid #e0e0e0;
    background: white;
  }

  .title {
    flex: 1;
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #666;
  }

  .viewer-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .action-btn.restore {
    background: #28a745;
    color: white;
  }

  .action-btn.restore:hover {
    background: #218838;
  }

  .action-btn.delete {
    background: #dc3545;
    color: white;
  }

  .action-btn.delete:hover {
    background: #c82333;
  }

  .deleted-info {
    padding: 12px 24px;
    background: #fff3cd;
    border-bottom: 1px solid #e0e0e0;
    font-size: 13px;
    color: #856404;
  }

  .content-view {
    flex: 1;
    padding: 24px;
    font-size: 16px;
    line-height: 1.6;
    color: #666;
    white-space: pre-wrap;
    overflow-y: auto;
    background: white;
  }

  .viewer-footer {
    display: flex;
    justify-content: space-between;
    padding: 12px 24px;
    border-top: 1px solid #e0e0e0;
    font-size: 12px;
    color: #888;
    background: white;
  }

  .no-note {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  .mobile-back-btn {
    display: none;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary, #f0f0f0);
    color: var(--text-primary, #333);
    font-size: 14px;
    cursor: pointer;
  }

  .mobile-back-btn:hover {
    background: var(--bg-hover, #e0e0e0);
  }

  @media (max-width: 768px) {
    .mobile-back-btn {
      display: block;
    }

    .viewer-actions {
      display: none;
    }
  }
</style>
