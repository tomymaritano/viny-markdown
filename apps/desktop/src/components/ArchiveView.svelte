<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let showDeleteConfirm = $state(false);
  let noteToDelete = $state<string | null>(null);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  async function unarchiveNote(id: string) {
    try {
      await notesStore.unarchiveNote(id);
      toast.success('Note restored to active');
    } catch (err) {
      toast.error('Failed to unarchive note');
    }
  }

  function confirmDelete(id: string) {
    noteToDelete = id;
    showDeleteConfirm = true;
  }

  async function deleteNote() {
    if (!noteToDelete) return;
    try {
      await notesStore.deleteNote(noteToDelete);
      toast.success('Note moved to trash');
    } catch (err) {
      toast.error('Failed to delete note');
    }
    noteToDelete = null;
    showDeleteConfirm = false;
  }

  function goBack() {
    notesStore.setViewingArchived(false);
  }
</script>

<div class="archive-view">
  <div class="archive-header">
    <button class="back-btn" onclick={goBack}>
      ← Back
    </button>
    <h2>Archived Notes</h2>
    <span class="archive-info">
      {notesStore.archivedNotes.length} {notesStore.archivedNotes.length === 1 ? 'note' : 'notes'}
    </span>
  </div>

  <div class="archive-content">
    {#if notesStore.archivedNotes.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <h3>No archived notes</h3>
        <p>Archived notes will appear here</p>
      </div>
    {:else}
      <div class="archive-list">
        {#each notesStore.archivedNotes as note (note.id)}
          <div class="archive-item">
            <div class="item-content">
              <div class="item-title">{note.title || 'Untitled'}</div>
              <div class="item-preview">{note.content.slice(0, 100)}{note.content.length > 100 ? '...' : ''}</div>
              <div class="item-meta">
                Archived {formatDate(note.updated_at)}
              </div>
            </div>
            <div class="item-actions">
              <button class="action-btn unarchive" onclick={() => unarchiveNote(note.id)} title="Restore to active">
                ↩️
              </button>
              <button class="action-btn delete" onclick={() => confirmDelete(note.id)} title="Move to trash">
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={showDeleteConfirm}
  title="Move to Trash"
  message="Are you sure you want to move this note to trash?"
  confirmText="Move to Trash"
  cancelText="Cancel"
  destructive={true}
  onConfirm={deleteNote}
/>

<style>
  .archive-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .archive-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }

  .archive-header h2 {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .archive-info {
    font-size: 13px;
    color: var(--text-tertiary);
    padding: 4px 12px;
    background: var(--bg-secondary);
    border-radius: 12px;
  }

  .back-btn {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .archive-content {
    flex: 1;
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-tertiary);
    padding: 48px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 8px 0;
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  .archive-list {
    padding: 8px 0;
  }

  .archive-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    gap: 16px;
  }

  .archive-item:hover {
    background: var(--bg-hover);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  .item-preview {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .item-meta {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .item-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--bg-hover);
  }

  .action-btn.unarchive:hover {
    background: var(--success-light);
    border-color: var(--success);
  }

  .action-btn.delete:hover {
    background: var(--error-light);
    border-color: var(--error);
  }
</style>
