<script lang="ts">
  import { onMount } from 'svelte';
  import { notesStore, appStore } from '$lib/stores';
  import * as api from '$lib/api';
  import type { SearchResult } from '$lib/bindings';

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let isSearching = $state(false);
  let showResults = $state(false);
  let showFilters = $state(false);
  let showHistory = $state(false);
  let searchTimeout: ReturnType<typeof setTimeout>;
  let searchHistory = $state<string[]>([]);

  const HISTORY_KEY = 'viny-search-history';
  const MAX_HISTORY = 10;

  onMount(() => {
    loadSearchHistory();
  });

  function loadSearchHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        searchHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }

  function saveToHistory(searchTerm: string) {
    if (!searchTerm.trim() || searchTerm.length < 2) return;
    const newHistory = [searchTerm, ...searchHistory.filter(h => h !== searchTerm)].slice(0, MAX_HISTORY);
    searchHistory = newHistory;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }

  function removeFromHistory(term: string) {
    searchHistory = searchHistory.filter(h => h !== term);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
  }

  function clearHistory() {
    searchHistory = [];
    localStorage.removeItem(HISTORY_KEY);
  }

  function useHistoryItem(term: string) {
    query = term;
    showHistory = false;
    performSearch();
  }

  // Advanced filters
  let filterNotebook = $state<string | null>(null);
  let filterTag = $state<string | null>(null);
  let filterDateRange = $state<'all' | 'today' | 'week' | 'month'>('all');
  let includeArchived = $state(false);

  const activeFiltersCount = $derived(
    [filterNotebook, filterTag, filterDateRange !== 'all', includeArchived].filter(Boolean).length
  );

  function getDateFilter(): string | null {
    const now = new Date();
    switch (filterDateRange) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return monthAgo.toISOString();
      default:
        return null;
    }
  }

  async function performSearch() {
    if (query.trim().length < 2) {
      results = [];
      showResults = false;
      return;
    }

    isSearching = true;
    try {
      let searchResults = await api.search({
        query: query.trim(),
        limit: 20,
        offset: null,
        notebook_id: filterNotebook,
        include_archived: includeArchived,
        include_trashed: false,
      });

      // Apply client-side filters for tag and date
      if (filterTag) {
        searchResults = searchResults.filter(r => r.note.tags.includes(filterTag!));
      }

      const dateFilter = getDateFilter();
      if (dateFilter) {
        searchResults = searchResults.filter(r => r.note.updated_at >= dateFilter);
      }

      results = searchResults.slice(0, 10);
      showResults = true;
    } catch (err) {
      console.error('Search error:', err);
      results = [];
    } finally {
      isSearching = false;
    }
  }

  function handleInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 200);
  }

  function selectResult(noteId: string) {
    saveToHistory(query);
    notesStore.selectNote(noteId);
    query = '';
    results = [];
    showResults = false;
    showFilters = false;
    showHistory = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      query = '';
      results = [];
      showResults = false;
      showFilters = false;
      showHistory = false;
    }
  }

  function handleBlur(e: FocusEvent) {
    const target = e.relatedTarget as HTMLElement;
    if (target?.closest('.search-container')) return;
    setTimeout(() => {
      showResults = false;
      showFilters = false;
      showHistory = false;
    }, 200);
  }

  function clearFilters() {
    filterNotebook = null;
    filterTag = null;
    filterDateRange = 'all';
    includeArchived = false;
    if (query.trim().length >= 2) {
      performSearch();
    }
  }

  function toggleFilters() {
    showFilters = !showFilters;
    if (!showFilters) {
      showResults = results.length > 0;
    }
  }

  // Re-search when filters change
  $effect(() => {
    if (query.trim().length >= 2) {
      // Track filter changes
      filterNotebook; filterTag; filterDateRange; includeArchived;
      performSearch();
    }
  });
</script>

<div class="search-container">
  <div class="search-input-wrapper">
    <span class="search-icon">#</span>
    <input
      type="text"
      class="search-input"
      placeholder="Search notes... (Cmd+K)"
      value={query}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      onfocus={() => {
        if (results.length > 0) showResults = true;
        else if (query.length === 0 && searchHistory.length > 0) showHistory = true;
      }}
    />
    {#if isSearching}
      <span class="loading-icon">⏳</span>
    {/if}
    <button
      class="filter-toggle"
      class:active={showFilters || activeFiltersCount > 0}
      onclick={toggleFilters}
      title="Search filters"
    >
      <span class="filter-icon">F</span>
      {#if activeFiltersCount > 0}
        <span class="filter-badge">{activeFiltersCount}</span>
      {/if}
    </button>
  </div>

  {#if showFilters}
    <div class="filters-panel">
      <div class="filters-header">
        <span class="filters-title">Search Filters</span>
        {#if activeFiltersCount > 0}
          <button class="clear-filters" onclick={clearFilters}>Clear all</button>
        {/if}
      </div>

      <div class="filter-group">
        <label class="filter-label" for="filter-notebook">Notebook</label>
        <select
          id="filter-notebook"
          class="filter-select"
          value={filterNotebook ?? ''}
          onchange={(e) => filterNotebook = (e.target as HTMLSelectElement).value || null}
        >
          <option value="">All notebooks</option>
          {#each appStore.notebooks as notebook}
            <option value={notebook.id}>{notebook.name}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label class="filter-label" for="filter-tag">Tag</label>
        <select
          id="filter-tag"
          class="filter-select"
          value={filterTag ?? ''}
          onchange={(e) => filterTag = (e.target as HTMLSelectElement).value || null}
        >
          <option value="">All tags</option>
          {#each appStore.tags as tag}
            <option value={tag.name}>{tag.name}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Date modified</span>
        <div class="filter-chips">
          <button
            class="filter-chip"
            class:active={filterDateRange === 'all'}
            onclick={() => filterDateRange = 'all'}
          >All time</button>
          <button
            class="filter-chip"
            class:active={filterDateRange === 'today'}
            onclick={() => filterDateRange = 'today'}
          >Today</button>
          <button
            class="filter-chip"
            class:active={filterDateRange === 'week'}
            onclick={() => filterDateRange = 'week'}
          >This week</button>
          <button
            class="filter-chip"
            class:active={filterDateRange === 'month'}
            onclick={() => filterDateRange = 'month'}
          >This month</button>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-checkbox">
          <input
            type="checkbox"
            checked={includeArchived}
            onchange={(e) => includeArchived = (e.target as HTMLInputElement).checked}
          />
          <span>Include archived notes</span>
        </label>
      </div>
    </div>
  {/if}

  {#if showResults && results.length > 0}
    <div class="search-results">
      {#each results as result (result.note.id)}
        <button
          class="result-item"
          onclick={() => selectResult(result.note.id)}
        >
          <div class="result-title">{result.note.title || 'Untitled'}</div>
          {#if result.snippet}
            <div class="result-snippet">{@html result.snippet}</div>
          {/if}
          <div class="result-meta">
            <span class="result-date">
              {new Date(result.note.updated_at).toLocaleDateString()}
            </span>
            {#if result.note.tags.length > 0}
              <span class="result-tags">
                {result.note.tags.slice(0, 2).join(', ')}
              </span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {:else if showResults && query.length >= 2 && !isSearching}
    <div class="search-results">
      <div class="no-results">No results found for "{query}"</div>
    </div>
  {/if}

  {#if showHistory && searchHistory.length > 0 && query.length === 0}
    <div class="search-history">
      <div class="history-header">
        <span class="history-title">Recent searches</span>
        <button class="history-clear" onclick={clearHistory}>Clear</button>
      </div>
      {#each searchHistory as term}
        <div class="history-item">
          <button class="history-term" onclick={() => useHistoryItem(term)}>
            <span class="history-icon">H</span>
            {term}
          </button>
          <button class="history-remove" onclick={() => removeFromHistory(term)} title="Remove">
            ✕
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    flex: 1;
    max-width: 500px;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0 12px;
  }

  .search-icon {
    font-size: 14px;
    margin-right: 8px;
    opacity: 0.5;
  }

  .loading-icon {
    font-size: 14px;
    margin-left: 8px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .search-input {
    flex: 1;
    padding: 10px 0;
    border: none;
    background: none;
    font-size: 14px;
    color: var(--text-primary);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.15s ease;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    opacity: 1;
    background: var(--bg-hover);
  }

  .filter-icon {
    font-size: 14px;
  }

  .filter-badge {
    background: var(--accent);
    color: white;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 8px;
    font-weight: 600;
  }

  .filters-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    padding: 16px;
    z-index: 101;
  }

  .filters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .filters-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
  }

  .clear-filters {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
  }

  .clear-filters:hover {
    text-decoration: underline;
  }

  .filter-group {
    margin-bottom: 16px;
  }

  .filter-group:last-child {
    margin-bottom: 0;
  }

  .filter-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .filter-select {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-chip {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 16px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .filter-chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .filter-checkbox input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 400px;
    overflow-y: auto;
    z-index: 100;
  }

  .result-item {
    display: block;
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

  .result-item:hover {
    background: var(--bg-hover);
  }

  .result-title {
    font-weight: 500;
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .result-snippet {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-bottom: 6px;
  }

  .result-snippet :global(mark) {
    background: var(--accent-light);
    color: var(--accent);
    padding: 0 2px;
    border-radius: 2px;
  }

  .result-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .no-results {
    padding: 24px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
  }

  /* Search History */
  .search-history {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .history-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .history-clear {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .history-clear:hover {
    color: var(--error);
  }

  .history-item {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-term {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: none;
    border: none;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
  }

  .history-term:hover {
    background: var(--bg-hover);
  }

  .history-icon {
    font-size: 12px;
    opacity: 0.5;
  }

  .history-remove {
    padding: 8px 12px;
    background: none;
    border: none;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .history-item:hover .history-remove {
    opacity: 1;
  }

  .history-remove:hover {
    color: var(--error);
  }
</style>
