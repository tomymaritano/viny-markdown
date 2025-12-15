<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import ConfirmDialog from './ConfirmDialog.svelte';

  let showEmptyConfirm = $state(false);
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

  async function restoreNote(id: string) {
    try {
      await notesStore.restoreNote(id);
      toast.success('Note restored');
    } catch (err) {
      toast.error('Failed to restore note');
    }
  }

  function confirmDelete(id: string) {
    noteToDelete = id;
    showDeleteConfirm = true;
  }

  async function permanentlyDelete() {
    if (!noteToDelete) return;
    try {
      await notesStore.permanentlyDeleteNote(noteToDelete);
      toast.success('Note permanently deleted');
    } catch (err) {
      toast.error('Failed to delete note');
    }
    noteToDelete = null;
    showDeleteConfirm = false;
  }

  async function emptyTrash() {
    try {
      await notesStore.emptyTrash();
      toast.success('Trash emptied');
    } catch (err) {
      toast.error('Failed to empty trash');
    }
    showEmptyConfirm = false;
  }

  function goBack() {
    notesStore.setViewingTrash(false);
  }
</script>

<div class="trash-view">
  <div class="trash-header">
    <button class="back-btn" onclick={goBack}>
      ← Back
    </button>
    <h2>Trash</h2>
    {#if notesStore.trashedNotes.length > 0}
      <button class="empty-btn" onclick={() => showEmptyConfirm = true}>
        Empty Trash
      </button>
    {/if}
  </div>

  <div class="trash-content">
    {#if notesStore.trashedNotes.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🗑️</span>
        <h3>Trash is empty</h3>
        <p>Deleted notes will appear here</p>
      </div>
    {:else}
      <div class="trash-info">
        <p>{notesStore.trashedNotes.length} deleted {notesStore.trashedNotes.length === 1 ? 'note' : 'notes'}</p>
      </div>

      <div class="trash-list">
        {#each notesStore.trashedNotes as note (note.id)}
          <div class="trash-item">
            <div class="item-content">
              <div class="item-title">{note.title || 'Untitled'}</div>
              <div class="item-meta">
                Deleted {formatDate(note.deleted_at || note.updated_at)}
              </div>
            </div>
            <div class="item-actions">
              <button class="action-btn restore" onclick={() => restoreNote(note.id)} title="Restore">
                ↩️
              </button>
              <button class="action-btn delete" onclick={() => confirmDelete(note.id)} title="Delete permanently">
                ✕
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={showEmptyConfirm}
  title="Empty Trash"
  message="Are you sure you want to permanently delete all notes in trash? This action cannot be undone."
  confirmText="Empty Trash"
  cancelText="Cancel"
  destructive={true}
  onConfirm={emptyTrash}
/>

<ConfirmDialog
  bind:open={showDeleteConfirm}
  title="Delete Permanently"
  message="Are you sure you want to permanently delete this note? This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  destructive={true}
  onConfirm={permanentlyDelete}
/>

<style>
  .trash-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .trash-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }

  .trash-header h2 {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
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

  .empty-btn {
    padding: 6px 12px;
    background: var(--error);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    color: white;
    cursor: pointer;
  }

  .empty-btn:hover {
    background: #c0392b;
  }

  .trash-content {
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

  .trash-info {
    padding: 12px 24px;
    font-size: 12px;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border);
  }

  .trash-list {
    padding: 8px 0;
  }

  .trash-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
  }

  .trash-item:hover {
    background: var(--bg-hover);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .item-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  .action-btn:hover {
    background: var(--bg-hover);
  }

  .action-btn.restore:hover {
    background: var(--success-light);
    border-color: var(--success);
  }

  .action-btn.delete:hover {
    background: var(--error-light);
    border-color: var(--error);
    color: var(--error);
  }
</style>
