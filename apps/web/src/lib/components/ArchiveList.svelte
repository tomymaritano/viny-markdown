<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import type { Note } from '@viny/domain';
  import { Archive } from 'lucide-svelte';

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  }

  function handleUnarchive(note: Note) {
    notesStore.unarchiveNote(note.id);
  }

  function handleSelectNote(note: Note) {
    notesStore.selectArchivedNote(note.id);
    appStore.showMobileEditorView();
  }
</script>

<aside class="archive-list">
  <header class="archive-header">
    <h2>Archive</h2>
  </header>

  {#if notesStore.archivedNotes.length === 0}
    <div class="empty-state">
      <span class="archive-icon"><Archive size={32} /></span>
      <p>Archive is empty</p>
      <p class="hint">Archive notes to keep them out of your main list</p>
    </div>
  {:else}
    <ul class="notes">
      {#each notesStore.archivedNotes as note (note.id)}
        <li class="archive-item" class:selected={notesStore.selectedArchivedNoteId === note.id}>
          <button class="archive-note-info" onclick={() => handleSelectNote(note)}>
            <span class="note-title">{note.title || 'Untitled'}</span>
            <span class="note-preview">{truncate(note.content, 40) || 'No content'}</span>
            <span class="note-date">Archived {formatDate(note.updatedAt)}</span>
          </button>
          <div class="archive-actions">
            <button class="unarchive-btn" onclick={() => handleUnarchive(note)} title="Unarchive">
              Unarchive
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="archive-footer">
    <span>{notesStore.archivedNotes.length} archived notes</span>
  </footer>
</aside>

<style>
  .archive-list {
    width: 280px;
    height: 100%;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
  }

  .archive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .archive-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    padding: 24px;
  }

  .archive-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
  }

  .hint {
    font-size: 12px;
    margin-top: 8px !important;
    text-align: center;
  }

  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }

  .archive-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .archive-item:hover {
    background: var(--bg-hover);
  }

  .archive-note-info {
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

  .archive-item.selected {
    background: var(--bg-selected);
  }

  .note-title {
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-preview {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-date {
    font-size: 11px;
    color: var(--text-muted);
  }

  .archive-actions {
    display: flex;
    gap: 8px;
  }

  .unarchive-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    background: #007aff;
    color: white;
  }

  .unarchive-btn:hover {
    background: #0056b3;
  }

  .archive-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--border-color);
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
