<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import TemplateSelector from './TemplateSelector.svelte';
  import type { Note } from '@viny/domain';
  import {
    SquareCheck, LayoutGrid, List, Upload, FileText, Plus, X,
    Settings, Search, Pin, Folder, Archive, Trash2, GripVertical
  } from 'lucide-svelte';

  // Debounce utility
  function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timeoutId: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  // Debounced search - 150ms delay
  const debouncedSearch = debounce((query: string) => {
    notesStore.setSearchQuery(query);
  }, 150);

  let showTemplates = $state(false);
  let draggedIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let showBulkMoveMenu = $state(false);
  let showSearchDropdown = $state(false);
  let showSearchFilters = $state(false);
  let searchInputRef: HTMLInputElement;
  let localSearchValue = $state(notesStore.searchQuery);

  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      notesStore.reorderNotes(draggedIndex, toIndex);
    }
    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
  }

  // Highlight search query matches in text
  function highlight(text: string, query: string): string {
    if (!query.trim()) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function handleNoteClick(note: Note) {
    notesStore.selectNote(note.id);
    appStore.showMobileEditorView();
  }

  async function handleNewNote() {
    await notesStore.createNote({ title: '', content: '' });
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localSearchValue = target.value;
    debouncedSearch(target.value);
    showSearchDropdown = target.value.length === 0 && notesStore.recentSearches.length > 0;
  }

  function handleSearchFocus() {
    if (localSearchValue.length === 0 && notesStore.recentSearches.length > 0) {
      showSearchDropdown = true;
    }
  }

  function handleSearchBlur() {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      showSearchDropdown = false;
    }, 150);
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && notesStore.searchQuery.trim()) {
      notesStore.addRecentSearch(notesStore.searchQuery);
      showSearchDropdown = false;
      searchInputRef?.blur();
    } else if (event.key === 'Escape') {
      showSearchDropdown = false;
      searchInputRef?.blur();
    }
  }

  function selectRecentSearch(query: string) {
    localSearchValue = query;
    notesStore.setSearchQuery(query);
    showSearchDropdown = false;
  }

  function clearSearch() {
    localSearchValue = '';
    notesStore.setSearchQuery('');
    showSearchDropdown = false;
  }

  function handleSortChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value === 'manual-asc') {
      notesStore.setSort('manual', 'asc');
    } else if (value === 'updatedAt-desc') {
      notesStore.setSort('updatedAt', 'desc');
    } else if (value === 'updatedAt-asc') {
      notesStore.setSort('updatedAt', 'asc');
    } else if (value === 'createdAt-desc') {
      notesStore.setSort('createdAt', 'desc');
    } else if (value === 'createdAt-asc') {
      notesStore.setSort('createdAt', 'asc');
    } else if (value === 'title-asc') {
      notesStore.setSort('title', 'asc');
    } else if (value === 'title-desc') {
      notesStore.setSort('title', 'desc');
    }
  }

  function getCurrentSortValue(): string {
    return `${notesStore.sortBy}-${notesStore.sortOrder}`;
  }

  function handleTagFilterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    notesStore.setTagFilter(value === '' ? null : value);
  }

  function getTagName(tagId: string): string {
    const tag = appStore.tags.find(t => t.id === tagId);
    return tag?.name || 'Unknown';
  }

  let fileInput: HTMLInputElement;

  function handleImportClick() {
    fileInput?.click();
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();

    // Parse markdown - extract title from first # heading if present
    let title = '';
    let content = text;

    const lines = text.split('\n');
    if (lines[0]?.startsWith('# ')) {
      title = lines[0].slice(2).trim();
      content = lines.slice(1).join('\n').trim();
    } else {
      // Use filename without extension as title
      title = file.name.replace(/\.md$/i, '');
    }

    await notesStore.createNote({ title, content });

    // Reset input so same file can be imported again
    input.value = '';
  }

  // Bulk action handlers
  async function handleBulkDelete() {
    if (confirm(`Delete ${notesStore.selectedCount} selected notes?`)) {
      await notesStore.bulkDeleteNotes();
    }
  }

  async function handleBulkArchive() {
    if (confirm(`Archive ${notesStore.selectedCount} selected notes?`)) {
      await notesStore.bulkArchiveNotes();
    }
  }

  async function handleBulkMove(notebookId: string | null) {
    await notesStore.bulkMoveNotes(notebookId);
    showBulkMoveMenu = false;
  }

  async function handleBulkPin() {
    await notesStore.bulkTogglePin();
  }

  function handleNoteCheckboxClick(event: Event, noteId: string) {
    event.stopPropagation();
    notesStore.toggleNoteSelection(noteId);
  }

  function handleDateFromChange(event: Event) {
    const input = event.target as HTMLInputElement;
    notesStore.setSearchFilter('dateFrom', input.value || null);
  }

  function handleDateToChange(event: Event) {
    const input = event.target as HTMLInputElement;
    notesStore.setSearchFilter('dateTo', input.value || null);
  }
</script>

<aside class="notes-list">
  <header class="notes-header">
    <h2>Notes</h2>
    <div class="header-actions">
      <button
        class="select-mode-btn"
        class:active={notesStore.isSelectMode}
        onclick={() => notesStore.toggleSelectMode()}
        title={notesStore.isSelectMode ? 'Exit select mode' : 'Select multiple notes'}
      >
        <SquareCheck size={14} />
      </button>
      <button
        class="view-mode-btn"
        onclick={() => notesStore.toggleViewMode()}
        title={notesStore.viewMode === 'list' ? 'Switch to card view' : 'Switch to list view'}
      >
        {#if notesStore.viewMode === 'list'}
          <LayoutGrid size={14} />
        {:else}
          <List size={14} />
        {/if}
      </button>
      <button class="import-btn" onclick={handleImportClick} title="Import Markdown">
        <Upload size={14} />
      </button>
      <button class="template-btn" onclick={() => showTemplates = true} title="New from Template">
        <FileText size={14} />
      </button>
      <button class="new-note-btn" onclick={handleNewNote} title="New Note (Cmd+N)">
        <Plus size={14} />
      </button>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept=".md,.markdown,text/markdown"
      onchange={handleFileSelect}
      style="display: none;"
    />
  </header>

  <div class="search-container">
    <div class="search-input-row">
      <input
        bind:this={searchInputRef}
        type="text"
        class="search-input"
        placeholder="Search notes... (Cmd+F)"
        bind:value={localSearchValue}
        oninput={handleSearchInput}
        onfocus={handleSearchFocus}
        onblur={handleSearchBlur}
        onkeydown={handleSearchKeydown}
      />
      {#if localSearchValue}
        <button class="clear-search" onclick={clearSearch} title="Clear search">
          <X size={10} />
        </button>
      {/if}
      <button
        class="filter-toggle-btn"
        class:active={showSearchFilters}
        onclick={() => showSearchFilters = !showSearchFilters}
        title="Search filters"
      >
        <Settings size={14} />
      </button>
    </div>
    {#if showSearchDropdown && notesStore.recentSearches.length > 0}
      <div class="search-dropdown">
        <div class="dropdown-header">
          <span>Recent Searches</span>
          <button class="clear-history-btn" onclick={() => notesStore.clearRecentSearches()}>
            Clear
          </button>
        </div>
        <ul class="recent-searches-list">
          {#each notesStore.recentSearches as query (query)}
            <li class="recent-search-item">
              <button class="recent-search-btn" onclick={() => selectRecentSearch(query)}>
                <span class="search-icon"><Search size={11} /></span>
                <span class="search-text">{query}</span>
              </button>
              <button
                class="remove-search-btn"
                onclick={() => notesStore.removeRecentSearch(query)}
                title="Remove from history"
              >
                <X size={12} />
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if showSearchFilters}
      <div class="search-filters-panel">
        <div class="filter-section">
          <label class="filter-checkbox">
            <input
              type="checkbox"
              checked={notesStore.searchFilters.useFuzzySearch}
              onchange={() => notesStore.toggleFuzzySearch()}
            />
            <span>Fuzzy search</span>
          </label>
        </div>
        <div class="filter-section">
          <span class="filter-section-title">Search in:</span>
          <div class="filter-checkboxes">
            <label class="filter-checkbox">
              <input
                type="checkbox"
                checked={notesStore.searchFilters.searchInTitle}
                onchange={() => notesStore.setSearchFilter('searchInTitle', !notesStore.searchFilters.searchInTitle)}
              />
              <span>Title</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                checked={notesStore.searchFilters.searchInContent}
                onchange={() => notesStore.setSearchFilter('searchInContent', !notesStore.searchFilters.searchInContent)}
              />
              <span>Content</span>
            </label>
            <label class="filter-checkbox">
              <input
                type="checkbox"
                checked={notesStore.searchFilters.searchInTags}
                onchange={() => notesStore.setSearchFilter('searchInTags', !notesStore.searchFilters.searchInTags)}
              />
              <span>Tags</span>
            </label>
          </div>
        </div>
        <div class="filter-section">
          <span class="filter-section-title">Date range:</span>
          <div class="date-inputs">
            <input
              type="date"
              class="date-input"
              value={notesStore.searchFilters.dateFrom || ''}
              onchange={handleDateFromChange}
            />
            <span class="date-separator">to</span>
            <input
              type="date"
              class="date-input"
              value={notesStore.searchFilters.dateTo || ''}
              onchange={handleDateToChange}
            />
            {#if notesStore.searchFilters.dateFrom || notesStore.searchFilters.dateTo}
              <button class="clear-date-btn" onclick={() => notesStore.clearDateFilter()} title="Clear dates">
                <X size={12} />
              </button>
            {/if}
          </div>
        </div>
        <button class="reset-filters-btn" onclick={() => notesStore.resetSearchFilters()}>
          Reset all filters
        </button>
      </div>
    {/if}
  </div>

  <div class="filter-sort-container">
    <div class="filter-row">
      <select class="sort-select" value={getCurrentSortValue()} onchange={handleSortChange}>
        <option value="manual-asc">Manual (Drag to reorder)</option>
        <option value="updatedAt-desc">Modified (Newest)</option>
        <option value="updatedAt-asc">Modified (Oldest)</option>
        <option value="createdAt-desc">Created (Newest)</option>
        <option value="createdAt-asc">Created (Oldest)</option>
        <option value="title-asc">Title (A-Z)</option>
        <option value="title-desc">Title (Z-A)</option>
      </select>
      {#if appStore.tags.length > 0}
        <select class="tag-filter-select" value={notesStore.filterByTagId || ''} onchange={handleTagFilterChange}>
          <option value="">All tags</option>
          {#each appStore.tags as tag (tag.id)}
            <option value={tag.id}>{tag.name}</option>
          {/each}
        </select>
      {/if}
    </div>
    {#if notesStore.filterByTagId}
      <div class="active-filter">
        <span class="filter-label">Filtered by:</span>
        <span class="filter-tag">{getTagName(notesStore.filterByTagId)}</span>
        <button class="clear-filter-btn" onclick={() => notesStore.clearTagFilter()} title="Clear filter"><X size={14} /></button>
      </div>
    {/if}
  </div>

  {#if notesStore.isSelectMode}
    <div class="bulk-actions-bar">
      <div class="select-info">
        <button class="select-all-btn" onclick={() => notesStore.selectedCount === notesStore.filteredNotes.length ? notesStore.deselectAllNotes() : notesStore.selectAllNotes()}>
          {notesStore.selectedCount === notesStore.filteredNotes.length ? 'Deselect All' : 'Select All'}
        </button>
        <span class="selected-count">{notesStore.selectedCount} selected</span>
      </div>
      {#if notesStore.selectedCount > 0}
        <div class="bulk-actions">
          <button class="bulk-btn" onclick={handleBulkPin} title="Toggle pin"><Pin size={14} /></button>
          <div class="bulk-move-container">
            <button class="bulk-btn" onclick={() => showBulkMoveMenu = !showBulkMoveMenu} title="Move to notebook"><Folder size={14} /></button>
            {#if showBulkMoveMenu}
              <div class="bulk-move-menu">
                <button class="move-option" onclick={() => handleBulkMove(null)}>No Notebook</button>
                {#each appStore.notebooks as notebook (notebook.id)}
                  <button class="move-option" onclick={() => handleBulkMove(notebook.id)}>{notebook.name}</button>
                {/each}
              </div>
            {/if}
          </div>
          <button class="bulk-btn" onclick={handleBulkArchive} title="Archive"><Archive size={14} /></button>
          <button class="bulk-btn danger" onclick={handleBulkDelete} title="Delete"><Trash2 size={14} /></button>
        </div>
      {/if}
      <button class="exit-select-btn" onclick={() => notesStore.exitSelectMode()}>Done</button>
    </div>
  {/if}

  {#if notesStore.isLoading}
    <div class="loading">Loading...</div>
  {:else if notesStore.notes.length === 0}
    <div class="empty-state">
      <p>No notes yet</p>
      <button onclick={handleNewNote}>Create your first note</button>
    </div>
  {:else if notesStore.filteredNotes.length === 0}
    <div class="empty-state">
      <p>No notes match "{notesStore.searchQuery}"</p>
      <button onclick={clearSearch}>Clear search</button>
    </div>
  {:else}
    <ul class="notes" class:card-view={notesStore.viewMode === 'card'}>
      {#if notesStore.pinnedNotes.length > 0}
        <li class="section-header">Pinned</li>
        {#each notesStore.pinnedNotes as note (note.id)}
          <li>
            <button
              class="note-item"
              class:selected={notesStore.selectedNoteId === note.id}
              class:multi-selected={notesStore.isNoteSelected(note.id)}
              onclick={() => notesStore.isSelectMode ? notesStore.toggleNoteSelection(note.id) : handleNoteClick(note)}
              title={`Created: ${new Date(note.createdAt).toLocaleDateString()}\nModified: ${new Date(note.updatedAt).toLocaleDateString()}`}
            >
              {#if notesStore.isSelectMode}
                <input
                  type="checkbox"
                  class="note-checkbox"
                  checked={notesStore.isNoteSelected(note.id)}
                  onclick={(e) => handleNoteCheckboxClick(e, note.id)}
                />
              {/if}
              <span class="note-title">
                <span class="pin-icon"><Pin size={9} /></span>
                {#if notesStore.searchQuery}
                  {@html highlight(note.title || 'Untitled', notesStore.searchQuery)}
                {:else}
                  {note.title || 'Untitled'}
                {/if}
              </span>
              <span class="note-preview">
                {#if notesStore.searchQuery}
                  {@html highlight(truncate(note.content, 50) || 'No content', notesStore.searchQuery)}
                {:else}
                  {truncate(note.content, 50) || 'No content'}
                {/if}
              </span>
              <span class="note-date">{formatDate(note.updatedAt)}</span>
            </button>
          </li>
        {/each}
      {/if}

      {#if notesStore.unpinnedNotes.length > 0}
        {#if notesStore.pinnedNotes.length > 0}
          <li class="section-header">Notes</li>
        {/if}
        {#each notesStore.unpinnedNotes as note, index (note.id)}
          <li
            class:dragging={draggedIndex === index}
            class:drag-over={dragOverIndex === index && draggedIndex !== index}
          >
            <button
              class="note-item"
              class:selected={notesStore.selectedNoteId === note.id}
              class:multi-selected={notesStore.isNoteSelected(note.id)}
              draggable={notesStore.sortBy === 'manual' && !notesStore.isSelectMode ? 'true' : 'false'}
              onclick={() => notesStore.isSelectMode ? notesStore.toggleNoteSelection(note.id) : handleNoteClick(note)}
              ondragstart={() => handleDragStart(index)}
              ondragover={(e) => handleDragOver(e, index)}
              ondragleave={handleDragLeave}
              ondrop={(e) => handleDrop(e, index)}
              ondragend={handleDragEnd}
              title={`Created: ${new Date(note.createdAt).toLocaleDateString()}\nModified: ${new Date(note.updatedAt).toLocaleDateString()}`}
            >
              {#if notesStore.isSelectMode}
                <input
                  type="checkbox"
                  class="note-checkbox"
                  checked={notesStore.isNoteSelected(note.id)}
                  onclick={(e) => handleNoteCheckboxClick(e, note.id)}
                />
              {:else if notesStore.sortBy === 'manual'}
                <span class="drag-handle"><GripVertical size={11} /></span>
              {/if}
              <span class="note-title">
                {#if notesStore.searchQuery}
                  {@html highlight(note.title || 'Untitled', notesStore.searchQuery)}
                {:else}
                  {note.title || 'Untitled'}
                {/if}
              </span>
              <span class="note-preview">
                {#if notesStore.searchQuery}
                  {@html highlight(truncate(note.content, 50) || 'No content', notesStore.searchQuery)}
                {:else}
                  {truncate(note.content, 50) || 'No content'}
                {/if}
              </span>
              <span class="note-date">{formatDate(note.updatedAt)}</span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}

  <footer class="notes-footer">
    <span>{notesStore.notes.length} notes</span>
    {#if notesStore.searchQuery}
      <span>({notesStore.filteredNotes.length} shown)</span>
    {/if}
  </footer>
</aside>

<TemplateSelector open={showTemplates} onclose={() => showTemplates = false} />

<style>
  .notes-list {
    width: 280px;
    height: 100%;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
  }

  .notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .notes-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .new-note-btn,
  .import-btn,
  .template-btn,
  .view-mode-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .view-mode-btn {
    background: transparent;
    color: var(--text-muted);
  }

  .view-mode-btn:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .new-note-btn {
    background: var(--accent-color);
    color: white;
    font-size: 16px;
  }

  .new-note-btn:hover {
    background: var(--accent-hover);
  }

  .import-btn,
  .template-btn {
    background: transparent;
    color: var(--text-muted);
  }

  .import-btn:hover,
  .template-btn:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .search-container {
    padding: 6px 12px;
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 6px 10px;
    padding-right: 28px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    outline: none;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .search-input:focus {
    border-color: var(--accent-color);
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .clear-search {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--text-muted);
    color: white;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search:hover {
    background: var(--text-secondary);
  }

  /* Search dropdown */
  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 12px;
    right: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    z-index: 100;
    max-height: 220px;
    overflow-y: auto;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-light);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .clear-history-btn {
    background: transparent;
    border: none;
    color: var(--accent-color);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
  }

  .clear-history-btn:hover {
    background: var(--bg-hover);
  }

  .recent-searches-list {
    list-style: none;
    margin: 0;
    padding: 2px 0;
  }

  .recent-search-item {
    display: flex;
    align-items: center;
  }

  .recent-search-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-size: 12px;
  }

  .recent-search-btn:hover {
    background: var(--bg-hover);
  }

  .search-icon {
    font-size: 11px;
    opacity: 0.6;
  }

  .search-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-search-btn {
    padding: 3px 6px;
    margin-right: 6px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .recent-search-item:hover .remove-search-btn {
    opacity: 1;
  }

  .remove-search-btn:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .filter-sort-container {
    padding: 0 16px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-row {
    display: flex;
    gap: 6px;
  }

  .sort-select,
  .tag-filter-select {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 12px;
    background: var(--input-bg);
    cursor: pointer;
    outline: none;
    color: var(--text-secondary);
  }

  .sort-select:focus,
  .tag-filter-select:focus {
    border-color: var(--accent-color);
  }

  .active-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 11px;
  }

  .filter-label {
    color: var(--text-muted);
  }

  .filter-tag {
    color: var(--accent-color);
    font-weight: 500;
  }

  .clear-filter-btn {
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: var(--text-muted);
    color: white;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
  }

  .clear-filter-btn:hover {
    background: var(--text-secondary);
  }

  .loading,
  .empty-state {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-secondary);
  }

  .empty-state button {
    margin-top: 12px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #007aff;
    color: white;
    cursor: pointer;
  }

  .notes {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }

  /* Card view grid layout */
  .notes.card-view {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 8px;
  }

  .notes.card-view .section-header {
    grid-column: 1 / -1;
    padding: 4px 8px;
  }

  .notes.card-view li {
    margin: 0;
  }

  .notes.card-view .note-item {
    height: 120px;
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    border: 1px solid var(--border-light);
    overflow: hidden;
  }

  .notes.card-view .note-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .notes.card-view .note-item.selected {
    background: var(--bg-selected);
    border-color: var(--accent-color);
  }

  .notes.card-view .note-title {
    font-size: 13px;
    margin-bottom: 6px;
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    white-space: normal;
    line-height: 1.3;
  }

  .notes.card-view .note-preview {
    font-size: 11px;
    -webkit-line-clamp: 3;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    white-space: normal;
    line-height: 1.4;
  }

  .notes.card-view .note-date {
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 10px;
  }

  .notes.card-view .note-item {
    position: relative;
  }

  .notes.card-view .drag-handle {
    display: none;
  }

  .section-header {
    padding: 6px 12px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .note-item {
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .note-item:hover {
    background: var(--bg-hover);
  }

  .note-item.selected {
    background: var(--bg-selected);
  }

  .note-title {
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
  }

  .pin-icon {
    font-size: 9px;
    flex-shrink: 0;
  }

  .note-preview {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note-date {
    font-size: 10px;
    color: var(--text-muted);
  }

  .notes-footer {
    padding: 6px 12px;
    border-top: 1px solid var(--border-color);
    font-size: 10px;
    color: var(--text-muted);
    display: flex;
    gap: 4px;
  }

  /* Drag and drop styles */
  .dragging {
    opacity: 0.5;
  }

  .drag-over {
    border-top: 2px solid var(--accent-color);
  }

  .drag-handle {
    color: var(--text-muted);
    font-size: 11px;
    margin-right: 4px;
    cursor: grab;
    flex-shrink: 0;
  }

  button[draggable="true"] {
    cursor: grab;
  }

  button[draggable="true"]:active {
    cursor: grabbing;
  }

  /* Search highlight */
  :global(.search-highlight) {
    background: var(--warning-bg);
    color: #713f12;
    padding: 0 2px;
    border-radius: 2px;
  }

  :global(.dark .search-highlight) {
    background: #854d0e;
    color: #fef08a;
  }

  /* Select mode styles */
  .select-mode-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .select-mode-btn:hover {
    background: var(--border-color);
  }

  .select-mode-btn.active {
    background: var(--accent-color);
    color: white;
  }

  .bulk-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    gap: 8px;
  }

  .select-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .select-all-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
  }

  .select-all-btn:hover {
    background: var(--bg-hover);
  }

  .selected-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .bulk-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--bg-secondary);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bulk-btn:hover {
    background: var(--bg-hover);
  }

  .bulk-btn.danger:hover {
    background: #dc3545;
  }

  .bulk-move-container {
    position: relative;
  }

  .bulk-move-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    min-width: 150px;
    overflow: hidden;
  }

  .move-option {
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    text-align: left;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .move-option:hover {
    background: var(--bg-hover);
  }

  .exit-select-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: var(--accent-color);
    color: white;
    font-size: 12px;
    cursor: pointer;
  }

  .exit-select-btn:hover {
    opacity: 0.9;
  }

  .note-checkbox {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    cursor: pointer;
    flex-shrink: 0;
    accent-color: var(--accent-color);
  }

  .note-item.multi-selected {
    background: var(--bg-selected);
  }

  .notes.card-view .note-checkbox {
    position: absolute;
    top: 8px;
    left: 8px;
  }

  /* Search input row */
  .search-input-row {
    display: flex;
    align-items: center;
    gap: 6px;
    position: relative;
  }

  .search-input-row .search-input {
    flex: 1;
    padding-right: 32px;
  }

  .search-input-row .clear-search {
    position: absolute;
    right: 40px;
    top: 50%;
    transform: translateY(-50%);
  }

  .filter-toggle-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .filter-toggle-btn:hover {
    background: var(--bg-hover);
  }

  .filter-toggle-btn.active {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  /* Search filters panel */
  .search-filters-panel {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    border: 1px solid var(--border-light);
  }

  .filter-section {
    margin-bottom: 12px;
  }

  .filter-section:last-of-type {
    margin-bottom: 12px;
  }

  .filter-section-title {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .filter-checkboxes {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .filter-checkbox input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: var(--accent-color);
  }

  .date-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .date-input {
    padding: 6px 8px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 12px;
    background: var(--input-bg);
    color: var(--text-primary);
    flex: 1;
    min-width: 100px;
  }

  .date-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .date-separator {
    font-size: 12px;
    color: var(--text-muted);
  }

  .clear-date-btn {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 50%;
    background: var(--text-muted);
    color: white;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .clear-date-btn:hover {
    background: var(--text-secondary);
  }

  .reset-filters-btn {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .reset-filters-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
