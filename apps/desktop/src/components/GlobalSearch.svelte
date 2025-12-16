<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import { fuzzyMatch } from '$lib/markdown';
  import { X } from '@lucide/svelte';

  let { open = $bindable(false) } = $props<{ open: boolean }>();

  let searchQuery = $state('');
  let searchInput: HTMLInputElement;
  let selectedIndex = $state(0);
  let searchScope = $state<'all' | 'title' | 'content'>('all');

  interface SearchMatch {
    noteId: string;
    noteTitle: string;
    line: number;
    lineContent: string;
    matchStart: number;
    matchEnd: number;
  }

  const searchResults = $derived(() => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const results: SearchMatch[] = [];
    const query = searchQuery.toLowerCase();
    const notes = notesStore.allNotes;

    for (const note of notes) {
      // Search in title
      if (searchScope === 'all' || searchScope === 'title') {
        const titleLower = note.title.toLowerCase();
        const titleIndex = titleLower.indexOf(query);
        if (titleIndex !== -1) {
          results.push({
            noteId: note.id,
            noteTitle: note.title || 'Untitled',
            line: 0,
            lineContent: note.title,
            matchStart: titleIndex,
            matchEnd: titleIndex + query.length,
          });
        }
      }

      // Search in content
      if (searchScope === 'all' || searchScope === 'content') {
        const lines = note.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const lineLower = lines[i].toLowerCase();
          const lineIndex = lineLower.indexOf(query);
          if (lineIndex !== -1) {
            results.push({
              noteId: note.id,
              noteTitle: note.title || 'Untitled',
              line: i + 1,
              lineContent: lines[i],
              matchStart: lineIndex,
              matchEnd: lineIndex + query.length,
            });
          }
        }
      }

      // Limit results per note to avoid overwhelming
      if (results.length > 100) break;
    }

    return results.slice(0, 50);
  });

  // Group results by note
  const groupedResults = $derived(() => {
    const groups: Map<string, { title: string; matches: SearchMatch[] }> = new Map();

    for (const result of searchResults()) {
      if (!groups.has(result.noteId)) {
        groups.set(result.noteId, { title: result.noteTitle, matches: [] });
      }
      groups.get(result.noteId)!.matches.push(result);
    }

    return Array.from(groups.entries()).map(([noteId, data]) => ({
      noteId,
      title: data.title,
      matches: data.matches,
    }));
  });

  $effect(() => {
    if (open && searchInput) {
      setTimeout(() => searchInput?.focus(), 50);
    }
  });

  $effect(() => {
    if (!open) {
      searchQuery = '';
      selectedIndex = 0;
    }
  });

  function close() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    const results = searchResults();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          selectResult(results[selectedIndex]);
        }
        break;
    }
  }

  function selectResult(result: SearchMatch) {
    notesStore.selectNote(result.noteId);
    toast.info(`Opened: ${result.noteTitle}${result.line > 0 ? ` (line ${result.line})` : ''}`);
    close();
  }

  function highlightMatch(text: string, start: number, end: number): string {
    const before = text.substring(0, start);
    const match = text.substring(start, end);
    const after = text.substring(end);
    return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
  }

  function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char] || char;
    });
  }

  function truncateLine(line: string, matchStart: number, maxLength: number = 80): { text: string; start: number; end: number } {
    if (line.length <= maxLength) {
      return { text: line, start: matchStart, end: matchStart + searchQuery.length };
    }

    // Center the match in the truncated string
    const halfLength = Math.floor(maxLength / 2);
    let textStart = Math.max(0, matchStart - halfLength);
    let textEnd = Math.min(line.length, textStart + maxLength);

    if (textEnd - textStart < maxLength) {
      textStart = Math.max(0, textEnd - maxLength);
    }

    const text = (textStart > 0 ? '...' : '') +
                 line.substring(textStart, textEnd) +
                 (textEnd < line.length ? '...' : '');

    const newStart = matchStart - textStart + (textStart > 0 ? 3 : 0);
    const newEnd = newStart + searchQuery.length;

    return { text, start: newStart, end: newEnd };
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="global-search-overlay" onclick={close} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="global-search" onclick={(e) => e.stopPropagation()}>
      <div class="search-header">
        <span class="search-icon">#</span>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          class="search-input"
          placeholder="Search in all notes..."
          spellcheck="false"
        />
        <div class="scope-selector">
          <button
            class="scope-btn"
            class:active={searchScope === 'all'}
            onclick={() => searchScope = 'all'}
          >
            All
          </button>
          <button
            class="scope-btn"
            class:active={searchScope === 'title'}
            onclick={() => searchScope = 'title'}
          >
            Titles
          </button>
          <button
            class="scope-btn"
            class:active={searchScope === 'content'}
            onclick={() => searchScope = 'content'}
          >
            Content
          </button>
        </div>
        <button class="close-btn" onclick={close}><X size={18} /></button>
      </div>

      <div class="search-results">
        {#if searchQuery.length < 2}
          <div class="search-hint">
            Type at least 2 characters to search
          </div>
        {:else if searchResults().length === 0}
          <div class="no-results">
            No results found for "{searchQuery}"
          </div>
        {:else}
          <div class="results-header">
            {searchResults().length} result{searchResults().length !== 1 ? 's' : ''} in {groupedResults().length} note{groupedResults().length !== 1 ? 's' : ''}
          </div>
          {#each groupedResults() as group}
            <div class="result-group">
              <div class="group-header">
                <span class="group-icon">Note</span>
                <span class="group-title">{group.title}</span>
                <span class="match-count">{group.matches.length}</span>
              </div>
              {#each group.matches as match, i}
                {@const truncated = truncateLine(match.lineContent, match.matchStart)}
                <button
                  class="result-item"
                  class:selected={searchResults().indexOf(match) === selectedIndex}
                  onclick={() => selectResult(match)}
                >
                  {#if match.line > 0}
                    <span class="line-number">L{match.line}</span>
                  {:else}
                    <span class="line-number title">Title</span>
                  {/if}
                  <span class="line-content">
                    {@html highlightMatch(truncated.text, truncated.start, truncated.end)}
                  </span>
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>

      <div class="search-footer">
        <span class="hint">↑↓ navigate</span>
        <span class="hint">↵ open</span>
        <span class="hint">esc close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .global-search-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .global-search {
    width: 90%;
    max-width: 700px;
    max-height: 70vh;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    animation: slideDown 0.15s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .search-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  .search-icon {
    font-size: 18px;
    opacity: 0.6;
  }

  .search-input {
    flex: 1;
    padding: 8px 0;
    border: none;
    background: none;
    font-size: 16px;
    color: var(--text-primary);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .scope-selector {
    display: flex;
    gap: 4px;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 6px;
  }

  .scope-btn {
    padding: 4px 10px;
    background: none;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .scope-btn:hover {
    background: var(--bg-hover);
  }

  .scope-btn.active {
    background: var(--accent);
    color: white;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 14px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 6px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .search-hint,
  .no-results {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .results-header {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }

  .result-group {
    margin-bottom: 16px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    margin-bottom: 4px;
  }

  .group-icon {
    font-size: 14px;
  }

  .group-title {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .match-count {
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .result-item:hover {
    background: var(--bg-hover);
  }

  .result-item.selected {
    background: var(--accent-light);
  }

  .line-number {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    background: var(--bg-secondary);
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 40px;
    text-align: center;
  }

  .line-number.title {
    background: var(--accent-light);
    color: var(--accent);
  }

  .line-content {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-mono);
  }

  .line-content :global(mark) {
    background: var(--warning);
    color: var(--text-primary);
    padding: 1px 2px;
    border-radius: 2px;
  }

  .search-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    border-radius: 0 0 12px 12px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-tertiary);
  }
</style>
