<script lang="ts">
  import { notesStore, appStore } from '$lib/stores';
  import * as api from '$lib/api';
  import type { SearchResult } from '$lib/bindings';
  import { toast } from '$lib/toast';
  import { fuzzyMatch } from '$lib/markdown';
  import {
    FilePlus,
    LayoutTemplate,
    Zap,
    Copy,
    Trash2,
    Pin,
    Star,
    Clipboard,
    Folder,
    FileText,
    ArrowUp,
    ArrowDown,
    Sun,
    Edit3,
    Eye,
    Columns,
    Settings,
    HelpCircle,
    RefreshCw
  } from '@lucide/svelte';

  // Icon mapping for commands
  const iconMap: Record<string, typeof FilePlus> = {
    'new-note': FilePlus,
    'new-template': LayoutTemplate,
    'quick-capture': Zap,
    'duplicate-note': Copy,
    'delete-note': Trash2,
    'pin-note': Pin,
    'star-note': Star,
    'copy-note': Clipboard,
    'new-notebook': Folder,
    'all-notes': FileText,
    'starred': Star,
    'trash': Trash2,
    'prev-note': ArrowUp,
    'next-note': ArrowDown,
    'toggle-theme': Sun,
    'edit-mode': Edit3,
    'preview-mode': Eye,
    'split-mode': Columns,
    'settings': Settings,
    'shortcuts': HelpCircle,
    'reload': RefreshCw,
  };

  let {
    open = $bindable(false),
    onOpenSettings = () => {},
    onOpenShortcuts = () => {},
    onOpenTemplates = () => {},
    onOpenQuickCapture = () => {},
  } = $props<{
    open?: boolean;
    onOpenSettings?: () => void;
    onOpenShortcuts?: () => void;
    onOpenTemplates?: () => void;
    onOpenQuickCapture?: () => void;
  }>();

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let selectedIndex = $state(0);
  let isSearching = $state(false);
  let inputRef: HTMLInputElement;
  let mode = $state<'search' | 'command'>('search');

  interface Command {
    id: string;
    label: string;
    description?: string;
    icon: string;
    category: 'notes' | 'navigation' | 'view' | 'app';
    shortcut?: string;
    action: () => void | Promise<void>;
  }

  // Commands available in command mode
  const commands: Command[] = [
    // Notes
    { id: 'new-note', label: 'New Note', description: 'Create a blank note', icon: 'N', category: 'notes', shortcut: '⌘N', action: () => createNote() },
    { id: 'new-template', label: 'New from Template', description: 'Create note from template', icon: 'T', category: 'notes', shortcut: '⌘⇧N', action: () => { onOpenTemplates(); } },
    { id: 'quick-capture', label: 'Quick Capture', description: 'Quickly capture a thought', icon: 'Q', category: 'notes', shortcut: '⌘⇧C', action: () => { onOpenQuickCapture(); } },
    { id: 'duplicate-note', label: 'Duplicate Note', description: 'Create a copy of current note', icon: 'D', category: 'notes', shortcut: '⌘D', action: () => duplicateNote() },
    { id: 'delete-note', label: 'Delete Note', description: 'Move current note to trash', icon: 'X', category: 'notes', shortcut: '⌘⌫', action: () => deleteNote() },
    { id: 'pin-note', label: 'Toggle Pin', description: 'Pin/unpin current note', icon: 'P', category: 'notes', shortcut: '⌘⇧P', action: () => togglePin() },
    { id: 'star-note', label: 'Toggle Star', description: 'Star/unstar current note', icon: '★', category: 'notes', action: () => toggleStar() },
    { id: 'copy-note', label: 'Copy to Clipboard', description: 'Copy note content as markdown', icon: 'C', category: 'notes', shortcut: '⌘⇧Y', action: () => copyToClipboard() },
    { id: 'new-notebook', label: 'New Notebook', description: 'Create a new notebook', icon: 'F', category: 'notes', action: () => createNotebook() },

    // Navigation
    { id: 'all-notes', label: 'Go to All Notes', description: 'Show all notes', icon: 'A', category: 'navigation', action: () => { notesStore.setNotebook(null); notesStore.setViewingTrash(false); } },
    { id: 'starred', label: 'Go to Starred', description: 'Show starred notes', icon: '★', category: 'navigation', action: () => notesStore.setShowingStarred(true) },
    { id: 'trash', label: 'Go to Trash', description: 'Show deleted notes', icon: 'T', category: 'navigation', action: () => notesStore.setViewingTrash(true) },
    { id: 'prev-note', label: 'Previous Note', description: 'Select previous note in list', icon: '↑', category: 'navigation', shortcut: 'K', action: () => navigateNotes(-1) },
    { id: 'next-note', label: 'Next Note', description: 'Select next note in list', icon: '↓', category: 'navigation', shortcut: 'J', action: () => navigateNotes(1) },

    // View
    { id: 'toggle-theme', label: 'Toggle Theme', description: 'Switch between light/dark mode', icon: '◐', category: 'view', shortcut: '⌘⇧D', action: () => { appStore.toggleTheme(); toast.success(appStore.theme === 'dark' ? 'Dark mode' : 'Light mode'); } },
    { id: 'edit-mode', label: 'Edit Mode', description: 'Switch to edit view', icon: 'E', category: 'view', action: () => toast.info('Press Edit button in toolbar') },
    { id: 'preview-mode', label: 'Preview Mode', description: 'Switch to preview view', icon: 'V', category: 'view', action: () => toast.info('Press Preview button in toolbar') },
    { id: 'split-mode', label: 'Split Mode', description: 'Show editor and preview side by side', icon: '◫', category: 'view', action: () => toast.info('Press Split button in toolbar') },

    // App
    { id: 'settings', label: 'Open Settings', description: 'Configure app preferences', icon: 'S', category: 'app', shortcut: '⌘,', action: () => { onOpenSettings(); } },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', description: 'View all shortcuts', icon: '?', category: 'app', shortcut: '⌘/', action: () => { onOpenShortcuts(); } },
    { id: 'reload', label: 'Reload Notes', description: 'Refresh notes from database', icon: 'R', category: 'app', action: async () => { await notesStore.initialize(); toast.success('Notes reloaded'); } },
  ];

  const categoryLabels: Record<string, string> = {
    notes: 'Notes',
    navigation: 'Navigation',
    view: 'View',
    app: 'Application',
  };

  const filteredCommands = $derived(() => {
    if (mode !== 'command' || !query.startsWith('>')) return [];
    const searchTerm = query.slice(1).trim().toLowerCase();
    if (!searchTerm) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(searchTerm) ||
      (c.description && c.description.toLowerCase().includes(searchTerm))
    );
  });

  const groupedCommands = $derived(() => {
    const cmds = filteredCommands();
    const groups: Record<string, Command[]> = {};
    for (const cmd of cmds) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  });

  const flatCommands = $derived(() => {
    const result: Command[] = [];
    for (const category of ['notes', 'navigation', 'view', 'app']) {
      const cmds = groupedCommands()[category];
      if (cmds) result.push(...cmds);
    }
    return result;
  });

  $effect(() => {
    if (open) {
      query = '';
      results = [];
      selectedIndex = 0;
      mode = 'search';
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  $effect(() => {
    if (query.startsWith('>')) {
      mode = 'command';
    } else {
      mode = 'search';
    }
  });

  async function handleSearch() {
    if (mode === 'command' || !query.trim()) {
      results = [];
      return;
    }

    isSearching = true;
    try {
      // Try server-side full-text search first
      results = await api.search({
        query: query.trim(),
        limit: 10,
        offset: null,
        notebook_id: null,
        tags: null,
        status: null,
      });

      // If no results, fall back to local fuzzy search
      if (results.length === 0) {
        results = fuzzySearchNotes(query.trim());
      }

      selectedIndex = 0;
    } catch (err) {
      console.error('Search failed, using local fuzzy search:', err);
      // Fallback to local fuzzy search
      results = fuzzySearchNotes(query.trim());
      selectedIndex = 0;
    } finally {
      isSearching = false;
    }
  }

  function fuzzySearchNotes(searchQuery: string): SearchResult[] {
    const allNotes = notesStore.allNotes;

    return allNotes
      .map(note => {
        const titleScore = fuzzyMatch(note.title, searchQuery);
        const contentScore = fuzzyMatch(note.content.substring(0, 500), searchQuery) * 0.5;
        const score = Math.max(titleScore, contentScore);

        return {
          id: note.id,
          title: note.title,
          snippet: note.content.substring(0, 150),
          rank: score / 100, // Normalize to 0-1
        };
      })
      .filter(r => r.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 10);
  }

  // Debounce search
  let searchTimeout: ReturnType<typeof setTimeout>;
  $effect(() => {
    clearTimeout(searchTimeout);
    if (query && mode === 'search') {
      searchTimeout = setTimeout(handleSearch, 200);
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    const items = mode === 'command' ? flatCommands() : results;
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, maxIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (mode === 'command' && flatCommands()[selectedIndex]) {
          executeCommand(flatCommands()[selectedIndex]);
        } else if (mode === 'search' && results[selectedIndex]) {
          selectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  }

  function selectResult(result: SearchResult) {
    notesStore.selectNote(result.id);
    close();
  }

  function executeCommand(command: Command) {
    command.action();
    close();
  }

  async function createNote() {
    await notesStore.createNote({ title: '', content: '' });
    toast.success('New note created');
  }

  async function createNotebook() {
    const name = prompt('Notebook name:');
    if (name && name.trim()) {
      await appStore.createNotebook(name.trim());
      toast.success(`Notebook "${name.trim()}" created`);
    }
  }

  async function duplicateNote() {
    const note = notesStore.selectedNote;
    if (!note) {
      toast.error('No note selected');
      return;
    }
    const newNote = await notesStore.createNote({
      title: `${note.title} (copy)`,
      content: note.content,
      notebook_id: note.notebook_id,
      tags: note.tags,
    });
    notesStore.selectNote(newNote.id);
    toast.success('Note duplicated');
  }

  async function deleteNote() {
    const note = notesStore.selectedNote;
    if (!note) {
      toast.error('No note selected');
      return;
    }
    await notesStore.deleteNote(note.id);
    toast.info('Note moved to trash');
  }

  async function togglePin() {
    const note = notesStore.selectedNote;
    if (!note) {
      toast.error('No note selected');
      return;
    }
    await notesStore.updateNote(note.id, {
      title: null,
      content: null,
      notebook_id: null,
      tags: null,
      status: null,
      is_pinned: !note.is_pinned,
    });
    toast.success(note.is_pinned ? 'Unpinned' : 'Pinned');
  }

  function toggleStar() {
    const note = notesStore.selectedNote;
    if (!note) {
      toast.error('No note selected');
      return;
    }
    const wasStarred = notesStore.isStarred(note.id);
    notesStore.toggleStar(note.id);
    toast.success(wasStarred ? 'Removed from favorites' : 'Added to favorites');
  }

  async function copyToClipboard() {
    const note = notesStore.selectedNote;
    if (!note) {
      toast.error('No note selected');
      return;
    }
    const content = `# ${note.title || 'Untitled'}\n\n${note.content}`;
    await navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }

  function navigateNotes(direction: number) {
    const notes = notesStore.filteredNotes;
    const currentIndex = notes.findIndex(n => n.id === notesStore.selectedNoteId);
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < notes.length) {
      notesStore.selectNote(notes[newIndex].id);
    }
  }

  function close() {
    open = false;
    query = '';
    results = [];
  }

  function getSnippet(content: string, maxLength: number = 100): string {
    const plain = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    return plain.length > maxLength ? plain.slice(0, maxLength) + '...' : plain;
  }
</script>

{#if open}
  <div
    class="palette-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="0"
  >
    <div
      class="palette"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="search-input-wrapper">
        <span class="search-icon">
          {mode === 'command' ? '>' : '#'}
        </span>
        <input
          bind:this={inputRef}
          type="text"
          class="search-input"
          placeholder={mode === 'command' ? 'Type a command...' : 'Search notes or type > for commands...'}
          bind:value={query}
          onkeydown={handleKeydown}
        />
        {#if isSearching}
          <span class="loading-indicator">...</span>
        {/if}
      </div>

      <div class="results">
        {#if mode === 'command'}
          {@const grouped = groupedCommands()}
          {@const flat = flatCommands()}
          {#if flat.length > 0}
            {#each ['notes', 'navigation', 'view', 'app'] as category}
              {#if grouped[category]?.length}
                <div class="command-category">
                  <span class="category-label">{categoryLabels[category]}</span>
                </div>
                {#each grouped[category] as command}
                  {@const flatIndex = flat.indexOf(command)}
                  <button
                    class="result-item command-item"
                    class:selected={flatIndex === selectedIndex}
                    onclick={() => executeCommand(command)}
                  >
                    <span class="command-icon">
                      {#if iconMap[command.id]}
                        <svelte:component this={iconMap[command.id]} size={16} />
                      {:else}
                        {command.icon}
                      {/if}
                    </span>
                    <div class="command-content">
                      <span class="result-title">{command.label}</span>
                      {#if command.description}
                        <span class="command-description">{command.description}</span>
                      {/if}
                    </div>
                    {#if command.shortcut}
                      <span class="shortcut">{command.shortcut}</span>
                    {/if}
                  </button>
                {/each}
              {/if}
            {/each}
          {:else}
            <div class="empty-results">No commands found</div>
          {/if}
        {:else if results.length > 0}
          {#each results as result, i}
            <button
              class="result-item"
              class:selected={i === selectedIndex}
              onclick={() => selectResult(result)}
            >
              <div class="result-content">
                <span class="result-title">{result.title || 'Untitled'}</span>
                <span class="result-snippet">{getSnippet(result.snippet)}</span>
              </div>
              <span class="result-score">
                {(result.rank * 100).toFixed(0)}%
              </span>
            </button>
          {/each}
        {:else if query && !isSearching}
          <div class="empty-results">
            No results found for "{query}"
          </div>
        {:else if !query}
          <div class="empty-results hint">
            Start typing to search notes<br>
            <span class="hint-small">Type <kbd>></kbd> for commands</span>
          </div>
        {/if}
      </div>

      <div class="palette-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1100;
  }

  .palette {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }

  .search-icon {
    font-size: 16px;
    color: var(--text-secondary);
    width: 20px;
    text-align: center;
  }

  .search-input {
    flex: 1;
    border: none;
    background: none;
    font-size: 16px;
    color: var(--text-primary);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .loading-indicator {
    color: var(--text-tertiary);
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .results {
    max-height: 400px;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
  }

  .result-item:last-child {
    border-bottom: none;
  }

  .result-item:hover,
  .result-item.selected {
    background: var(--bg-hover);
  }

  .result-item.selected {
    background: var(--accent-light);
  }

  .result-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .result-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-snippet {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-score {
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
  }

  .shortcut {
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .command-category {
    padding: 8px 16px 4px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .category-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .command-item {
    gap: 12px;
  }

  .command-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .command-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .command-description {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-results {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .empty-results.hint {
    color: var(--text-tertiary);
  }

  .hint-small {
    font-size: 12px;
    margin-top: 8px;
    display: block;
  }

  .palette-footer {
    display: flex;
    gap: 16px;
    padding: 10px 16px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .palette-footer kbd,
  .hint-small kbd {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
