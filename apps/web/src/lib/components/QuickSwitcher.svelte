<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import type { Note } from '@viny/domain';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement;

  // Filter notes based on query
  const filteredNotes = $derived(() => {
    if (!query.trim()) {
      // Show recent notes when no query
      return [...notesStore.allNotes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10);
    }

    const q = query.toLowerCase();
    return notesStore.allNotes
      .filter((note) =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
      )
      .slice(0, 10);
  });

  // Reset state when opened
  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      // Focus input after render
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  // Reset selected index when results change
  $effect(() => {
    const notes = filteredNotes();
    if (selectedIndex >= notes.length) {
      selectedIndex = Math.max(0, notes.length - 1);
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    const notes = filteredNotes();

    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, notes.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selectedNote = notes[selectedIndex];
      if (selectedNote) {
        selectNote(selectedNote);
      }
    }
  }

  function selectNote(note: Note) {
    notesStore.selectNote(note.id);
    notesStore.setViewingTrash(false);
    onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function getNotebookName(notebookId: string | null): string {
    if (!notebookId) return '';
    const notebook = appStore.notebooks.find((n) => n.id === notebookId);
    return notebook?.name || '';
  }

  function highlightMatch(text: string, q: string): string {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="quick-switcher-backdrop" onclick={handleBackdropClick}>
    <div class="quick-switcher" role="dialog" aria-modal="true" aria-label="Quick switcher">
      <div class="search-wrapper">
        <input
          bind:this={inputRef}
          type="text"
          class="search-input"
          placeholder="Search notes..."
          bind:value={query}
          onkeydown={handleKeydown}
        />
      </div>

      <div class="results">
        {#if filteredNotes().length === 0}
          <div class="empty">
            {query.trim() ? 'No notes found' : 'No notes yet'}
          </div>
        {:else}
          <ul class="notes-list" role="listbox">
            {#each filteredNotes() as note, index (note.id)}
              <li role="option" aria-selected={index === selectedIndex}>
                <button
                  class="note-item"
                  class:selected={index === selectedIndex}
                  onclick={() => selectNote(note)}
                  onmouseenter={() => selectedIndex = index}
                >
                  <div class="note-main">
                    <span class="note-title">
                      {#if query.trim()}
                        {@html highlightMatch(note.title || 'Untitled', query)}
                      {:else}
                        {note.title || 'Untitled'}
                      {/if}
                    </span>
                    {#if note.isPinned}
                      <span class="pin-badge">pinned</span>
                    {/if}
                  </div>
                  <div class="note-meta">
                    {#if getNotebookName(note.notebookId)}
                      <span class="notebook">{getNotebookName(note.notebookId)}</span>
                    {/if}
                    <span class="date">{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <footer class="quick-switcher-footer">
        <span class="hint"><kbd>↑↓</kbd> navigate</span>
        <span class="hint"><kbd>Enter</kbd> open</span>
        <span class="hint"><kbd>Esc</kbd> close</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .quick-switcher-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
  }

  .quick-switcher {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .search-wrapper {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    font-size: 16px;
    outline: none;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .search-input:focus {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .results {
    max-height: 400px;
    overflow-y: auto;
  }

  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .notes-list {
    list-style: none;
    margin: 0;
    padding: 8px;
  }

  .note-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .note-item:hover,
  .note-item.selected {
    background: var(--bg-hover);
  }

  .note-item.selected {
    background: var(--bg-selected);
  }

  .note-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .note-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-title :global(mark) {
    background: rgba(255, 220, 0, 0.4);
    color: inherit;
    border-radius: 2px;
    padding: 0 2px;
  }

  .pin-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--accent-color);
    color: white;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .notebook {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .quick-switcher-footer {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 12px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .hint {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hint kbd {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .quick-switcher-backdrop {
      padding-top: 0;
      align-items: stretch;
    }

    .quick-switcher {
      max-width: 100%;
      height: 100%;
      border-radius: 0;
    }

    .search-wrapper {
      padding: 12px;
    }

    .search-input {
      font-size: 16px; /* Prevent zoom on iOS */
    }

    .results {
      max-height: none;
      flex: 1;
    }

    .notes-list {
      padding: 4px;
    }

    .note-item {
      padding: 14px 12px;
    }

    .quick-switcher-footer {
      display: none;
    }
  }
</style>
