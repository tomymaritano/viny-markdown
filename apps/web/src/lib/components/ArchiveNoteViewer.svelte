<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';

  function handleUnarchive() {
    const note = notesStore.selectedArchivedNote;
    if (!note) return;
    notesStore.unarchiveNote(note.id);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
</script>

<main class="archive-viewer">
  {#if notesStore.selectedArchivedNote}
    <header class="viewer-header">
      <button class="mobile-back-btn" onclick={() => appStore.showMobileList()} aria-label="Back to archive list">
        ← Archive
      </button>
      <h1 class="title">{notesStore.selectedArchivedNote.title || 'Untitled'}</h1>
      <div class="viewer-actions">
        <button class="action-btn unarchive" onclick={handleUnarchive} title="Unarchive">
          Unarchive
        </button>
      </div>
    </header>

    <div class="archived-info">
      Archived {formatDate(notesStore.selectedArchivedNote.updatedAt)}
    </div>

    <div class="content-view">
      {notesStore.selectedArchivedNote.content || 'No content'}
    </div>

    <footer class="viewer-footer">
      <span class="word-count">
        {notesStore.selectedArchivedNote.content.split(/\s+/).filter(Boolean).length} words
      </span>
      <span class="info">Read-only preview</span>
    </footer>
  {:else}
    <div class="no-note">
      <p>Select a note from Archive to preview it</p>
    </div>
  {/if}
</main>

<style>
  .archive-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .viewer-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .title {
    flex: 1;
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-secondary);
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

  .action-btn.unarchive {
    background: #007aff;
    color: white;
  }

  .action-btn.unarchive:hover {
    background: #0056b3;
  }

  .archived-info {
    padding: 12px 24px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    font-size: 13px;
    color: var(--text-secondary);
  }

  .content-view {
    flex: 1;
    padding: 24px;
    font-size: 16px;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-wrap;
    overflow-y: auto;
    background: var(--bg-primary);
  }

  .viewer-footer {
    display: flex;
    justify-content: space-between;
    padding: 12px 24px;
    border-top: 1px solid var(--border-color);
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-primary);
  }

  .no-note {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .mobile-back-btn {
    display: none;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .mobile-back-btn:hover {
    background: var(--bg-hover);
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
