<script lang="ts">
  import { onMount } from 'svelte';
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import type { Note } from '$lib/bindings';
  import { getNoteColor } from '$lib/noteColors';

  let draggedNoteId = $state<string | null>(null);
  let sortBy = $state<'updated' | 'created' | 'title'>('updated');
  let sortOrder = $state<'asc' | 'desc'>('desc');
  let viewMode = $state<'list' | 'grid'>('list');
  let hoveredNoteId = $state<string | null>(null);
  let selectionMode = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  // Load preferences from localStorage on mount
  onMount(() => {
    const savedSortBy = localStorage.getItem('viny-notelist-sortby');
    if (savedSortBy === 'updated' || savedSortBy === 'created' || savedSortBy === 'title') {
      sortBy = savedSortBy;
    }
    const savedSortOrder = localStorage.getItem('viny-notelist-sortorder');
    if (savedSortOrder === 'asc' || savedSortOrder === 'desc') {
      sortOrder = savedSortOrder;
    }
    const savedViewMode = localStorage.getItem('viny-notelist-viewmode');
    if (savedViewMode === 'list' || savedViewMode === 'grid') {
      viewMode = savedViewMode;
    }
  });

  // Save preferences when they change
  $effect(() => {
    localStorage.setItem('viny-notelist-sortby', sortBy);
  });

  $effect(() => {
    localStorage.setItem('viny-notelist-sortorder', sortOrder);
  });

  $effect(() => {
    localStorage.setItem('viny-notelist-viewmode', viewMode);
  });

  const sortedNotes = $derived(() => {
    const notes = [...notesStore.filteredNotes];

    // Pinned notes always first
    const pinned = notes.filter(n => n.is_pinned);
    const unpinned = notes.filter(n => !n.is_pinned);

    const sortFn = (a: Note, b: Note) => {
      let comparison = 0;
      switch (sortBy) {
        case 'updated':
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case 'created':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'title':
          comparison = (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    };

    return [...pinned.sort(sortFn), ...unpinned.sort(sortFn)];
  });

  function handleDragStart(e: DragEvent, noteId: string) {
    draggedNoteId = noteId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', noteId);
    }
  }

  function handleDragEnd() {
    draggedNoteId = null;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return date.toLocaleDateString();
  }

  function getPreview(content: string, length: number = 80): string {
    // Strip markdown and get first ~N chars
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    return plain.length > length ? plain.slice(0, length) + '...' : plain;
  }

  function getNoteStats(content: string): { words: number; chars: number } {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    return { words, chars };
  }

  function formatStats(stats: { words: number; chars: number }): string {
    const { words, chars } = stats;
    if (words >= 1000) {
      return `${(words / 1000).toFixed(1)}K words`;
    }
    return `${words} words`;
  }

  async function createNote() {
    await notesStore.createNote({});
  }

  function toggleViewMode() {
    viewMode = viewMode === 'list' ? 'grid' : 'list';
  }

  async function togglePin(e: MouseEvent, noteId: string) {
    e.stopPropagation();
    const note = notesStore.notes.find(n => n.id === noteId);
    if (note) {
      await notesStore.updateNote(noteId, {
        title: null,
        content: null,
        notebook_id: null,
        tags: null,
        status: null,
        is_pinned: !note.is_pinned,
      });
      toast.success(note.is_pinned ? 'Unpinned' : 'Pinned');
    }
  }

  function toggleStar(e: MouseEvent, noteId: string) {
    e.stopPropagation();
    const wasStarred = notesStore.isStarred(noteId);
    notesStore.toggleStar(noteId);
    toast.success(wasStarred ? 'Removed from favorites' : 'Added to favorites');
  }

  async function deleteNote(e: MouseEvent, noteId: string) {
    e.stopPropagation();
    await notesStore.deleteNote(noteId);
    toast.info('Note moved to trash');
  }

  async function duplicateNote(e: MouseEvent, note: Note) {
    e.stopPropagation();
    const newNote = await notesStore.createNote({
      title: `${note.title} (copy)`,
      content: note.content,
      notebook_id: note.notebook_id,
      tags: note.tags,
    });
    notesStore.selectNote(newNote.id);
    toast.success('Note duplicated');
  }

  function toggleSelectionMode() {
    selectionMode = !selectionMode;
    if (!selectionMode) {
      selectedIds = new Set();
      toast.info('Selection mode off');
    } else {
      toast.info('Selection mode on - click notes to select');
    }
  }

  function toggleNoteSelection(e: MouseEvent, noteId: string) {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(noteId)) {
      newSet.delete(noteId);
    } else {
      newSet.add(noteId);
    }
    selectedIds = newSet;
  }

  function selectAll() {
    selectedIds = new Set(sortedNotes().map(n => n.id));
  }

  function deselectAll() {
    selectedIds = new Set();
  }

  // Keyboard navigation
  let focusedIndex = $state(-1);

  function handleKeydown(e: KeyboardEvent) {
    const notes = sortedNotes();
    if (notes.length === 0) return;

    // Find current index based on selected note
    const currentIndex = notesStore.selectedNoteId
      ? notes.findIndex(n => n.id === notesStore.selectedNoteId)
      : focusedIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        const nextIndex = currentIndex < notes.length - 1 ? currentIndex + 1 : 0;
        notesStore.selectNote(notes[nextIndex].id);
        focusedIndex = nextIndex;
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : notes.length - 1;
        notesStore.selectNote(notes[prevIndex].id);
        focusedIndex = prevIndex;
        break;
      case 'Enter':
        if (currentIndex >= 0 && currentIndex < notes.length) {
          notesStore.selectNote(notes[currentIndex].id);
        }
        break;
    }
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await notesStore.deleteNote(id);
    }
    toast.info(`${selectedIds.size} notes moved to trash`);
    selectedIds = new Set();
    selectionMode = false;
  }

  async function pinSelected() {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await notesStore.updateNote(id, {
        title: null,
        content: null,
        notebook_id: null,
        tags: null,
        status: null,
        is_pinned: true,
      });
    }
    toast.success(`${selectedIds.size} notes pinned`);
  }

  async function unpinSelected() {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await notesStore.updateNote(id, {
        title: null,
        content: null,
        notebook_id: null,
        tags: null,
        status: null,
        is_pinned: false,
      });
    }
    toast.success(`${selectedIds.size} notes unpinned`);
  }

  async function exportSelected() {
    if (selectedIds.size === 0) return;

    const selectedNotes = notesStore.allNotes.filter(n => selectedIds.has(n.id));

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      const path = await save({
        filters: [
          { name: 'Markdown', extensions: ['md'] },
        ],
        defaultPath: `notes-export-${new Date().toISOString().split('T')[0]}.md`,
      });

      if (!path) return;

      const content = selectedNotes
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(note => {
          const tags = note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}\n` : '';
          const date = `Last modified: ${new Date(note.updated_at).toLocaleDateString()}\n`;
          return `# ${note.title || 'Untitled'}\n\n${tags}${date}\n${note.content}\n\n---\n`;
        })
        .join('\n');

      const header = `# Notes Export\n\nExported ${selectedNotes.length} notes on ${new Date().toLocaleDateString()}\n\n---\n\n`;
      await writeTextFile(path, header + content);
      toast.success(`Exported ${selectedNotes.length} notes`);
    } catch (err) {
      toast.error('Failed to export notes');
      console.error(err);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="note-list"
  class:grid-view={viewMode === 'grid'}
  role="region"
  aria-label="Notes list"
  tabindex="0"
  onkeydown={handleKeydown}
>
  <div class="list-header">
    {#if selectionMode}
      <div class="selection-info">
        <span class="selection-count">{selectedIds.size} selected</span>
        <button class="selection-link" onclick={selectAll}>All</button>
        <button class="selection-link" onclick={deselectAll}>None</button>
      </div>
      <div class="selection-actions">
        <button class="selection-btn" onclick={exportSelected} title="Export selected" disabled={selectedIds.size === 0}>
          📤
        </button>
        <button class="selection-btn" onclick={pinSelected} title="Pin selected" disabled={selectedIds.size === 0}>
          📌
        </button>
        <button class="selection-btn" onclick={unpinSelected} title="Unpin selected" disabled={selectedIds.size === 0}>
          📍
        </button>
        <button class="selection-btn danger" onclick={deleteSelected} title="Delete selected" disabled={selectedIds.size === 0}>
          🗑️
        </button>
        <button class="selection-btn cancel" onclick={toggleSelectionMode}>
          ✕
        </button>
      </div>
    {:else}
      <span class="note-count">{notesStore.filteredNotes.length} notes</span>
      <div class="header-actions">
        <button
          class="select-mode-btn"
          onclick={toggleSelectionMode}
          title="Select multiple"
        >
          ☑
        </button>
        <button
          class="view-toggle"
          onclick={toggleViewMode}
          title={viewMode === 'list' ? 'Grid view' : 'List view'}
        >
          {viewMode === 'list' ? '▦' : '☰'}
        </button>
        <select class="sort-select" bind:value={sortBy} title="Sort by">
          <option value="updated">Updated</option>
          <option value="created">Created</option>
          <option value="title">Title</option>
        </select>
        <button
          class="sort-order-btn"
          onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
        <button class="new-note-btn" onclick={createNote} aria-label="Create new note">
          +
        </button>
      </div>
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <div class="list-content" class:grid-content={viewMode === 'grid'} role="listbox" aria-label="Notes">
    {#each sortedNotes() as note (note.id)}
      {@const noteColor = getNoteColor(note.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div
        class="note-item"
        class:selected={notesStore.selectedNoteId === note.id}
        class:checked={selectedIds.has(note.id)}
        class:pinned={note.is_pinned}
        class:dragging={draggedNoteId === note.id}
        class:grid-item={viewMode === 'grid'}
        class:has-color={noteColor.id !== 'none'}
        style={noteColor.id !== 'none' ? `--item-color: ${noteColor.accent}; --item-bg: ${noteColor.bg}` : ''}
        draggable={!selectionMode}
        onclick={() => selectionMode ? toggleNoteSelection({} as MouseEvent, note.id) : notesStore.selectNote(note.id)}
        ondragstart={(e) => handleDragStart(e, note.id)}
        ondragend={handleDragEnd}
        onmouseenter={() => hoveredNoteId = note.id}
        onmouseleave={() => hoveredNoteId = null}
        role="option"
        aria-selected={notesStore.selectedNoteId === note.id}
        aria-label={note.title || 'Untitled note'}
        tabindex={notesStore.selectedNoteId === note.id ? 0 : -1}
      >
        {#if selectionMode}
          <span class="checkbox" class:checked={selectedIds.has(note.id)}>
            {selectedIds.has(note.id) ? '☑' : '☐'}
          </span>
        {:else}
          <div class="note-badges">
            {#if notesStore.isStarred(note.id)}
              <span class="star-icon">★</span>
            {/if}
            {#if note.is_pinned}
              <span class="pin-icon">📌</span>
            {/if}
          </div>
        {/if}

        {#if hoveredNoteId === note.id && viewMode === 'list' && !selectionMode}
          <div class="quick-actions">
            <button
              class="quick-action-btn"
              class:starred={notesStore.isStarred(note.id)}
              onclick={(e) => toggleStar(e, note.id)}
              title={notesStore.isStarred(note.id) ? 'Remove from favorites' : 'Add to favorites'}
            >
              {notesStore.isStarred(note.id) ? '★' : '☆'}
            </button>
            <button
              class="quick-action-btn"
              onclick={(e) => togglePin(e, note.id)}
              title={note.is_pinned ? 'Unpin' : 'Pin'}
            >
              {note.is_pinned ? '📍' : '📌'}
            </button>
            <button
              class="quick-action-btn"
              onclick={(e) => duplicateNote(e, note)}
              title="Duplicate"
            >
              📄
            </button>
            <button
              class="quick-action-btn danger"
              onclick={(e) => deleteNote(e, note.id)}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        {/if}

        <div class="note-title">
          {note.title || 'Untitled'}
        </div>
        <div class="note-preview">
          {getPreview(note.content, viewMode === 'grid' ? 120 : 80)}
        </div>
        <div class="note-meta">
          <span class="note-date">{formatDate(note.updated_at)}</span>
          <span class="note-stats" title="{getNoteStats(note.content).chars} characters">
            {formatStats(getNoteStats(note.content))}
          </span>
          {#if note.tags.length > 0}
            <span class="note-tags">
              {#each note.tags.slice(0, viewMode === 'grid' ? 3 : 2) as tag}
                <span class="tag">{tag}</span>
              {/each}
              {#if note.tags.length > (viewMode === 'grid' ? 3 : 2)}
                <span class="tag">+{note.tags.length - (viewMode === 'grid' ? 3 : 2)}</span>
              {/if}
            </span>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty-state">
        <p>No notes found</p>
        <button class="create-btn" onclick={createNote}>Create your first note</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .note-list {
    width: 280px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    transition: width 0.2s ease;
  }

  .note-list.grid-view {
    width: 400px;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .note-count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .selection-count {
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
  }

  .selection-link {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    text-decoration: underline;
  }

  .selection-link:hover {
    color: var(--accent);
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .selection-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .selection-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .selection-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .selection-btn.danger:hover:not(:disabled) {
    background: var(--error-light);
    border-color: var(--error);
  }

  .selection-btn.cancel {
    background: none;
    border: none;
    color: var(--text-tertiary);
  }

  .selection-btn.cancel:hover {
    color: var(--text-primary);
  }

  .select-mode-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .select-mode-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .view-toggle {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .view-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .sort-select {
    padding: 4px 8px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .sort-order-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .sort-order-btn:hover {
    background: var(--bg-hover);
  }

  .new-note-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
  }

  .new-note-btn:hover {
    background: var(--accent-dark);
  }

  .list-content {
    flex: 1;
    overflow-y: auto;
  }

  .list-content.grid-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .note-item {
    display: block;
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    position: relative;
  }

  .note-item.grid-item {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-secondary);
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }

  .note-item:hover {
    background: var(--bg-hover);
  }

  .note-item.grid-item:hover {
    border-color: var(--accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .note-item.selected {
    background: var(--accent-light);
  }

  .note-item.grid-item.selected {
    border-color: var(--accent);
    background: var(--accent-light);
  }

  .note-item.pinned {
    background: var(--bg-secondary);
  }

  .note-item.grid-item.pinned {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--accent-light) 100%);
  }

  .note-item.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .note-item[draggable="true"] {
    cursor: grab;
  }

  .note-badges {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 1;
  }

  .star-icon {
    font-size: 12px;
    color: #f59e0b;
  }

  .pin-icon {
    font-size: 12px;
  }

  .checkbox {
    position: absolute;
    top: 12px;
    left: 12px;
    font-size: 16px;
    color: var(--text-tertiary);
    z-index: 5;
  }

  .checkbox.checked {
    color: var(--accent);
  }

  .note-item.checked {
    background: var(--accent-light);
    border-left: 3px solid var(--accent);
  }

  .note-item.checked .note-title {
    padding-left: 24px;
  }

  .note-item.checked .note-preview {
    padding-left: 24px;
  }

  .quick-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
  }

  .quick-action-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    opacity: 0.8;
    transition: all 0.15s ease;
  }

  .quick-action-btn:hover {
    opacity: 1;
    background: var(--bg-hover);
    transform: scale(1.05);
  }

  .quick-action-btn.danger:hover {
    background: var(--error-light);
    border-color: var(--error);
  }

  .quick-action-btn.starred {
    color: #f59e0b;
  }

  .quick-action-btn.starred:hover {
    background: #fef3c7;
    border-color: #f59e0b;
  }

  :global(.dark) .quick-action-btn.starred:hover {
    background: #422006;
  }

  .note-item:hover .note-badges {
    opacity: 0;
  }

  .note-title {
    font-weight: 500;
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grid-item .note-title {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    margin-bottom: 8px;
    font-size: 15px;
  }

  .note-preview {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .grid-item .note-preview {
    -webkit-line-clamp: 3;
    flex: 1;
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .grid-item .note-meta {
    margin-top: auto;
    flex-wrap: wrap;
  }

  .note-stats {
    color: var(--text-tertiary);
    opacity: 0.8;
  }

  .note-stats::before {
    content: '·';
    margin-right: 8px;
  }

  .note-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .tag {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .grid-item .tag {
    background: var(--bg-primary);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-secondary);
  }

  .grid-content .empty-state {
    grid-column: span 2;
  }

  .create-btn {
    margin-top: 12px;
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  /* Note color indicator */
  .note-item.has-color {
    border-left: 3px solid var(--item-color);
    background: var(--item-bg);
  }

  .note-item.has-color:hover {
    background: var(--item-bg);
    filter: brightness(0.95);
  }

  :global(.dark) .note-item.has-color:hover {
    filter: brightness(1.1);
  }

  .note-item.has-color.selected {
    background: var(--item-bg);
    filter: brightness(0.9);
  }

  :global(.dark) .note-item.has-color.selected {
    filter: brightness(1.2);
  }

  .note-item.grid-item.has-color {
    border-left: none;
    border: 2px solid var(--item-color);
    background: var(--item-bg);
  }

  .note-item.grid-item.has-color:hover {
    border-color: var(--item-color);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--item-color) 30%, transparent);
  }

  @media (max-width: 768px) {
    .note-list {
      width: 100%;
    }

    .note-list.grid-view {
      width: 100%;
    }
  }
</style>
