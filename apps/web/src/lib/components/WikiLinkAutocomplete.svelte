<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import type { Note } from '@viny/domain';

  interface Props {
    textarea: HTMLTextAreaElement | null;
    onSelect: (title: string, startPos: number, endPos: number) => void;
  }

  let { textarea, onSelect }: Props = $props();

  let isOpen = $state(false);
  let query = $state('');
  let position = $state({ top: 0, left: 0 });
  let selectedIndex = $state(0);
  let bracketStartPos = $state(0);

  // Filter notes based on query with smart ranking
  const suggestions = $derived(() => {
    if (!query && !isOpen) return [];

    const q = query.toLowerCase();
    const currentNoteId = notesStore.selectedNoteId;
    const recentIds = notesStore.recentNotes.map((n) => n.id);

    // Filter matching notes
    const matchingNotes = notesStore.allNotes.filter((note) => {
      if (note.id === currentNoteId) return false;
      if (!q) return true;
      return note.title.toLowerCase().includes(q) ||
             note.content.toLowerCase().includes(q);
    });

    // Sort: recent notes first, then by title match quality
    return matchingNotes
      .map((note) => ({
        note,
        isRecent: recentIds.includes(note.id),
        titleMatch: note.title.toLowerCase().startsWith(q) ? 2 :
                    note.title.toLowerCase().includes(q) ? 1 : 0,
      }))
      .sort((a, b) => {
        // Recent notes first
        if (a.isRecent && !b.isRecent) return -1;
        if (!a.isRecent && b.isRecent) return 1;
        // Then by title match quality
        if (a.titleMatch !== b.titleMatch) return b.titleMatch - a.titleMatch;
        // Then alphabetically
        return a.note.title.localeCompare(b.note.title);
      })
      .map((item) => item.note)
      .slice(0, 8);
  });

  // Helper to get note preview
  function getPreview(content: string): string {
    const text = content.replace(/[#*_~`\[\]]/g, '').trim();
    return text.length > 60 ? text.slice(0, 60) + '...' : text;
  }

  // Check if note is recent
  function isRecentNote(noteId: string): boolean {
    return notesStore.recentNotes.some((n) => n.id === noteId);
  }

  // Reset selection when suggestions change
  $effect(() => {
    const list = suggestions();
    if (selectedIndex >= list.length) {
      selectedIndex = Math.max(0, list.length - 1);
    }
  });

  // Listen for input events on textarea
  $effect(() => {
    if (!textarea) return;

    function handleInput() {
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const text = textarea.value;

      // Look backwards for [[
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastOpenBracket = textBeforeCursor.lastIndexOf('[[');

      if (lastOpenBracket === -1) {
        isOpen = false;
        return;
      }

      // Check if there's a closing ]] between [[ and cursor
      const textBetween = textBeforeCursor.substring(lastOpenBracket + 2);
      if (textBetween.includes(']]')) {
        isOpen = false;
        return;
      }

      // We're inside a [[ ... ]] block
      query = textBetween;
      bracketStartPos = lastOpenBracket;
      isOpen = true;
      selectedIndex = 0;

      // Calculate popup position
      updatePosition();
    }

    function handleKeydown(event: KeyboardEvent) {
      if (!isOpen) return;

      const list = suggestions();

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, list.length - 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (list.length > 0) {
          event.preventDefault();
          selectSuggestion(list[selectedIndex]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        isOpen = false;
      }
    }

    function handleBlur() {
      // Delay to allow click on suggestion
      setTimeout(() => {
        isOpen = false;
      }, 150);
    }

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeydown);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      textarea?.removeEventListener('input', handleInput);
      textarea?.removeEventListener('keydown', handleKeydown);
      textarea?.removeEventListener('blur', handleBlur);
    };
  });

  function updatePosition() {
    if (!textarea) return;

    // Get textarea position and dimensions
    const rect = textarea.getBoundingClientRect();
    const computedStyle = getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 24;
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;

    // Calculate approximate cursor position
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;

    // Account for scroll
    const scrollTop = textarea.scrollTop;

    position = {
      top: paddingTop + (currentLineIndex + 1) * lineHeight - scrollTop + 4,
      left: paddingLeft + 8,
    };
  }

  function selectSuggestion(note: Note) {
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    // Replace from [[ to cursor with [[title]]
    onSelect(note.title, bracketStartPos, cursorPos);
    isOpen = false;
  }
</script>

{#if isOpen && suggestions().length > 0}
  <div
    class="autocomplete-popup"
    style="top: {position.top}px; left: {position.left}px;"
  >
    <ul class="suggestions-list" role="listbox">
      {#each suggestions() as note, index (note.id)}
        <li role="option" aria-selected={index === selectedIndex}>
          <button
            class="suggestion-item"
            class:selected={index === selectedIndex}
            onmousedown={() => selectSuggestion(note)}
            onmouseenter={() => selectedIndex = index}
          >
            <span class="suggestion-content">
              <span class="note-title">
                {#if isRecentNote(note.id)}<span class="recent-badge">Recent</span>{/if}
                {note.title || 'Untitled'}
              </span>
              {#if note.content}
                <span class="note-preview">{getPreview(note.content)}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="autocomplete-hint">
      <kbd>↑↓</kbd> navigate <kbd>Enter</kbd> select <kbd>Esc</kbd> close
    </div>
  </div>
{/if}

<style>
  .autocomplete-popup {
    position: absolute;
    z-index: 100;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    max-width: 300px;
    overflow: hidden;
  }

  .suggestions-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    max-height: 240px;
    overflow-y: auto;
  }

  .suggestion-item {
    width: 100%;
    display: block;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .suggestion-item:hover,
  .suggestion-item.selected {
    background: var(--bg-hover);
  }

  .suggestion-item.selected {
    background: var(--bg-selected);
  }

  .suggestion-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .note-title {
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .recent-badge {
    font-size: 9px;
    padding: 1px 4px;
    background: var(--accent-color);
    color: white;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
    flex-shrink: 0;
  }

  .note-preview {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .autocomplete-hint {
    padding: 6px 12px;
    border-top: 1px solid var(--border-light);
    background: var(--bg-secondary);
    font-size: 11px;
    color: var(--text-muted);
  }

  .autocomplete-hint kbd {
    padding: 1px 4px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .autocomplete-popup {
      min-width: 250px;
      max-width: calc(100vw - 32px);
      left: 16px !important;
    }

    .suggestion-item {
      padding: 12px;
    }

    .autocomplete-hint {
      display: none;
    }
  }
</style>
