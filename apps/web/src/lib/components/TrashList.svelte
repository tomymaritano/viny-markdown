<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import type { Note } from '@viny/domain';
  import { Trash2 } from 'lucide-svelte';

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  }

  async function handleRestore(note: Note) {
    await notesStore.restoreNote(note.id);
  }

  async function handlePermanentDelete(note: Note) {
    if (confirm(`Permanently delete "${note.title || 'Untitled'}"? This cannot be undone.`)) {
      await notesStore.permanentlyDeleteNote(note.id);
    }
  }

  function handleSelectNote(note: Note) {
    notesStore.selectTrashedNote(note.id);
    appStore.showMobileEditorView();
  }

  async function handleEmptyTrash() {
    if (confirm('Permanently delete all items in Trash? This cannot be undone.')) {
      await notesStore.emptyTrash();
    }
  }
</script>

<aside class="trash-list">
  <header class="trash-header">
    <h2>Trash</h2>
    {#if notesStore.trashedNotes.length > 0}
      <button class="empty-trash-btn" onclick={handleEmptyTrash} title="Empty Trash">
        Empty
      </button>
    {/if}
  </header>

  {#if notesStore.trashedNotes.length === 0}
    <div class="empty-state">
      <span class="trash-icon"><Trash2 size={32} /></span>
      <p>Trash is empty</p>
    </div>
  {:else}
    <ul class="notes">
      {#each notesStore.trashedNotes as note (note.id)}
        <li class="trash-item" class:selected={notesStore.selectedTrashedNoteId === note.id}>
          <button class="trash-note-info" onclick={() => handleSelectNote(note)}>
            <span class="note-title">{note.title || 'Untitled'}</span>
            <span class="note-preview">{truncate(note.content, 40) || 'No content'}</span>
            <span class="note-date">Deleted {formatDate(note.deletedAt || note.updatedAt)}</span>
          </button>
          <div class="trash-actions">
            <button class="restore-btn" onclick={() => handleRestore(note)} title="Restore">
              Restore
            </button>
            <button class="delete-btn" onclick={() => handlePermanentDelete(note)} title="Delete Forever">
              Delete
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="trash-footer">
    <span>{notesStore.trashedNotes.length} items in Trash</span>
  </footer>
</aside>

<style>
  .trash-list {
    width: 280px;
    height: 100%;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    background: #fafafa;
  }

  .trash-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
  }

  .trash-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .empty-trash-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    background: #dc3545;
    color: white;
    font-size: 12px;
    cursor: pointer;
  }

  .empty-trash-btn:hover {
    background: #c82333;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  .trash-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }

  .trash-item {
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .trash-item:hover {
    background: #f5f5f5;
  }

  .trash-note-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }

  .trash-item.selected {
    background: #e8f0fe;
  }

  .note-title {
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-preview {
    font-size: 13px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-date {
    font-size: 11px;
    color: #999;
  }

  .trash-actions {
    display: flex;
    gap: 8px;
  }

  .restore-btn,
  .delete-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .restore-btn {
    background: #28a745;
    color: white;
  }

  .restore-btn:hover {
    background: #218838;
  }

  .delete-btn {
    background: #6c757d;
    color: white;
  }

  .delete-btn:hover {
    background: #5a6268;
  }

  .trash-footer {
    padding: 8px 16px;
    border-top: 1px solid #e0e0e0;
    font-size: 11px;
    color: #888;
  }
</style>
