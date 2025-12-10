<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import { operationsStore } from '$lib/stores/operations.svelte';
  import type { Notebook } from '@viny/domain';
  import {
    FileText, Calendar, Archive, Trash2, Download, Upload,
    ChevronDown, ChevronRight, Folder, Plus, Pencil, X,
    RefreshCw, Settings, Moon, Sun
  } from 'lucide-svelte';

  interface Props {
    onShowSettings?: () => void;
  }

  let { onShowSettings }: Props = $props();

  let isCreating = $state(false);
  let creatingParentId = $state<string | null>(null); // null = root level
  let showRecentNotes = $state(true);
  let showNotebooks = $state(true);
  let showTags = $state(true);
  let newNotebookName = $state('');
  let editingNotebookId = $state<string | null>(null);
  let editingNotebookName = $state('');
  let editingNotebookColor = $state('#888');
  let importInputRef: HTMLInputElement;
  let jsonImportInputRef: HTMLInputElement;
  let isImporting = $state(false);
  let showImportMenu = $state(false);
  let showExportMenu = $state(false);
  let isExporting = $state(false);
  let expandedNotebooks = $state<Set<string>>(new Set()); // Track expanded parent notebooks

  const notebookColors = ['#888', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

  // Derived: root notebooks (no parent)
  const rootNotebooks = $derived(
    appStore.notebooks.filter((nb) => nb.parentId === null)
  );

  // Get children for a notebook
  function getChildNotebooks(parentId: string): Notebook[] {
    return appStore.notebooks.filter((nb) => nb.parentId === parentId);
  }

  // Check if notebook has children
  function hasChildren(notebookId: string): boolean {
    return appStore.notebooks.some((nb) => nb.parentId === notebookId);
  }

  // Toggle expanded state
  function toggleExpanded(notebookId: string) {
    const newSet = new Set(expandedNotebooks);
    if (newSet.has(notebookId)) {
      newSet.delete(notebookId);
    } else {
      newSet.add(notebookId);
    }
    expandedNotebooks = newSet;
  }

  // Check if expanded
  function isExpanded(notebookId: string): boolean {
    return expandedNotebooks.has(notebookId);
  }

  // Flattened notebooks with depth for rendering
  interface NotebookWithDepth {
    notebook: Notebook;
    depth: number;
  }

  const flattenedNotebooks = $derived.by(() => {
    const result: NotebookWithDepth[] = [];

    function addNotebook(notebook: Notebook, depth: number) {
      result.push({ notebook, depth });
      // Only add children if parent is expanded
      if (expandedNotebooks.has(notebook.id)) {
        const children = appStore.notebooks.filter((nb) => nb.parentId === notebook.id);
        for (const child of children) {
          addNotebook(child, depth + 1);
        }
      }
    }

    // Start with root notebooks
    for (const notebook of rootNotebooks) {
      addNotebook(notebook, 0);
    }

    return result;
  });

  function handleSelectAll() {
    notesStore.setViewingTrash(false);
    notesStore.setNotebook(null);
  }

  function handleSelectTrash() {
    notesStore.setViewingTrash(true);
  }

  function handleSelectArchive() {
    notesStore.setViewingArchive(true);
  }

  function handleSelectNotebook(id: string) {
    notesStore.setViewingTrash(false);
    notesStore.setNotebook(id);
  }

  function startCreating() {
    isCreating = true;
    newNotebookName = '';
  }

  function cancelCreating() {
    isCreating = false;
    newNotebookName = '';
  }

  async function createNotebook() {
    if (!newNotebookName.trim()) return;
    await appStore.createNotebook(newNotebookName.trim(), creatingParentId);
    isCreating = false;
    creatingParentId = null;
    newNotebookName = '';
  }

  function startCreatingChild(parentId: string) {
    isCreating = true;
    creatingParentId = parentId;
    newNotebookName = '';
    // Auto-expand parent when creating child
    if (!expandedNotebooks.has(parentId)) {
      toggleExpanded(parentId);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      createNotebook();
    } else if (event.key === 'Escape') {
      cancelCreating();
    }
  }

  function startEditing(id: string, name: string, color: string | null) {
    editingNotebookId = id;
    editingNotebookName = name;
    editingNotebookColor = color || '#888';
  }

  function cancelEditing() {
    editingNotebookId = null;
    editingNotebookName = '';
  }

  async function saveNotebookEdit() {
    if (!editingNotebookId || !editingNotebookName.trim()) return;
    await appStore.updateNotebook(editingNotebookId, { name: editingNotebookName.trim(), color: editingNotebookColor });
    editingNotebookId = null;
    editingNotebookName = '';
    editingNotebookColor = '#888';
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      saveNotebookEdit();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  async function handleDeleteNotebook(id: string, name: string) {
    if (confirm(`Delete notebook "${name}"? Notes will be moved to "No Notebook".`)) {
      await appStore.deleteNotebook(id);
    }
  }

  function getNoteCount(notebookId: string): number {
    return notesStore.allNotes.filter((n) => n.notebookId === notebookId).length;
  }

  function handleSelectTag(tagId: string) {
    notesStore.setViewingTrash(false);
    notesStore.setFilterByTag(notesStore.filterByTagId === tagId ? null : tagId);
  }

  function getTagNoteCount(tagId: string): number {
    return notesStore.allNotes.filter((n) => n.tags.includes(tagId)).length;
  }

  async function handleImportFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    isImporting = true;
    showImportMenu = false;
    try {
      const count = await notesStore.importNotesFromMarkdown(files);
      if (count > 0) {
        alert(`Successfully imported ${count} note${count !== 1 ? 's' : ''}`);
      } else {
        alert('No valid markdown files found to import');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import notes');
    } finally {
      isImporting = false;
      input.value = '';
    }
  }

  async function handleImportJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    isImporting = true;
    showImportMenu = false;
    try {
      const result = await notesStore.importFromJson(files[0]);
      const messages: string[] = [];
      if (result.notesImported > 0) {
        messages.push(`${result.notesImported} notes`);
      }
      if (result.notebooksImported > 0) {
        messages.push(`${result.notebooksImported} notebooks`);
      }
      if (result.tagsImported > 0) {
        messages.push(`${result.tagsImported} tags`);
      }
      if (messages.length > 0) {
        alert(`Successfully imported: ${messages.join(', ')}`);
      } else {
        alert('No data found to import');
      }
      if (result.errors.length > 0) {
        console.warn('Import warnings:', result.errors);
      }
    } catch (error) {
      console.error('JSON import failed:', error);
      alert('Failed to import JSON backup');
    } finally {
      isImporting = false;
      input.value = '';
    }
  }

  async function handleExportJson() {
    isExporting = true;
    showExportMenu = false;
    try {
      await notesStore.exportAllAsJson();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export notes');
    } finally {
      isExporting = false;
    }
  }

  async function handleExportMarkdown() {
    isExporting = true;
    showExportMenu = false;
    try {
      await notesStore.exportAllAsMarkdown();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export notes');
    } finally {
      isExporting = false;
    }
  }
</script>

<nav class="sidebar" class:sidebar-open={appStore.sidebarOpen}>
  <div class="sidebar-header">
    <span class="app-name">VINY</span>
    <button class="mobile-close-btn" onclick={() => appStore.setSidebar(false)} aria-label="Close sidebar">
      <X size={18} />
    </button>
  </div>

  <div class="sidebar-section">
    <button
      class="nav-item"
      class:active={!notesStore.viewingTrash && notesStore.selectedNotebookId === null}
      onclick={handleSelectAll}
    >
      <span class="nav-icon"><FileText size={16} /></span>
      <span class="nav-label">All Notes</span>
      <span class="nav-count">{notesStore.allNotes.length}</span>
    </button>

    <button
      class="nav-item daily-note"
      onclick={() => notesStore.openDailyNote()}
      title="Open today's note (Cmd+D)"
    >
      <span class="nav-icon"><Calendar size={16} /></span>
      <span class="nav-label">Daily Note</span>
    </button>

    <button
      class="nav-item"
      class:active={notesStore.viewingArchive}
      onclick={handleSelectArchive}
    >
      <span class="nav-icon"><Archive size={16} /></span>
      <span class="nav-label">Archive</span>
      {#if notesStore.archivedNotes.length > 0}
        <span class="nav-count">{notesStore.archivedNotes.length}</span>
      {/if}
    </button>

    <button
      class="nav-item"
      class:active={notesStore.viewingTrash}
      onclick={handleSelectTrash}
    >
      <span class="nav-icon"><Trash2 size={16} /></span>
      <span class="nav-label">Trash</span>
      {#if notesStore.trashedNotes.length > 0}
        <span class="nav-count">{notesStore.trashedNotes.length}</span>
      {/if}
    </button>

    <input
      bind:this={importInputRef}
      type="file"
      accept=".md,.markdown,.txt"
      multiple
      class="hidden-input"
      onchange={handleImportFiles}
    />
    <input
      bind:this={jsonImportInputRef}
      type="file"
      accept=".json"
      class="hidden-input"
      onchange={handleImportJson}
    />
    <div class="import-container">
      <button
        class="nav-item import-btn"
        onclick={() => showImportMenu = !showImportMenu}
        disabled={isImporting}
      >
        <span class="nav-icon"><Download size={16} /></span>
        <span class="nav-label">{isImporting ? 'Importing...' : 'Import Notes'}</span>
      </button>
      {#if showImportMenu}
        <div class="import-menu">
          <button class="import-option" onclick={() => { showImportMenu = false; importInputRef?.click(); }}>
            Import Markdown Files
          </button>
          <button class="import-option" onclick={() => { showImportMenu = false; jsonImportInputRef?.click(); }}>
            Import JSON Backup
          </button>
        </div>
      {/if}
    </div>

    <div class="export-container">
      <button
        class="nav-item export-btn"
        onclick={() => showExportMenu = !showExportMenu}
        disabled={isExporting}
      >
        <span class="nav-icon"><Upload size={16} /></span>
        <span class="nav-label">{isExporting ? 'Exporting...' : 'Export Notes'}</span>
      </button>
      {#if showExportMenu}
        <div class="export-menu">
          <button class="export-option" onclick={handleExportJson}>
            Export as JSON
          </button>
          <button class="export-option" onclick={handleExportMarkdown}>
            Export as Markdown
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if notesStore.recentNotes.length > 0}
    <div class="sidebar-section recent-section">
      <button class="section-header-btn" onclick={() => showRecentNotes = !showRecentNotes}>
        <span class="section-chevron" class:collapsed={!showRecentNotes}><ChevronDown size={14} /></span>
        <span>Recent</span>
        <span class="nav-count recent-count">{notesStore.recentNotes.length}</span>
      </button>

      {#if showRecentNotes}
        <div class="recent-notes-list">
          {#each notesStore.recentNotes as note (note.id)}
            <button
              class="recent-note-item"
              class:active={!notesStore.viewingTrash && notesStore.selectedNoteId === note.id}
              onclick={() => {
                notesStore.setViewingTrash(false);
                notesStore.selectNote(note.id);
              }}
              title={note.title || 'Untitled'}
            >
              <span class="recent-note-title">{note.title || 'Untitled'}</span>
            </button>
          {/each}
          <button class="clear-recent-btn" onclick={() => notesStore.clearRecentNotes()}>
            Clear recent
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <div class="sidebar-section notebooks-section">
    <div class="section-header-row">
      <button class="section-header-btn" onclick={() => showNotebooks = !showNotebooks}>
        <span class="section-chevron" class:collapsed={!showNotebooks}><ChevronDown size={14} /></span>
        <span>Notebooks</span>
        <span class="nav-count notebooks-count">{appStore.notebooks.length}</span>
      </button>
      <button class="add-btn" onclick={startCreating} title="New Notebook" type="button"><Plus size={14} /></button>
    </div>

    {#if showNotebooks}
    {#if isCreating}
      <div class="new-notebook-input">
        <input
          type="text"
          bind:value={newNotebookName}
          onkeydown={handleKeydown}
          placeholder="Notebook name..."
        />
        <div class="input-actions">
          <button class="save-btn" onclick={createNotebook} type="button">Save</button>
          <button class="cancel-btn" onclick={cancelCreating} type="button">Cancel</button>
        </div>
      </div>
    {/if}

    {#if flattenedNotebooks.length === 0 && !isCreating}
      <div class="empty-notebooks">
        <span>No notebooks yet</span>
      </div>
    {:else}
      {#each flattenedNotebooks as { notebook, depth } (notebook.id)}
        {#if editingNotebookId === notebook.id}
          <div class="notebook-edit-input" style:padding-left="{16 + depth * 16}px">
            <input
              type="text"
              bind:value={editingNotebookName}
              onkeydown={handleEditKeydown}
              placeholder="Notebook name..."
            />
            <div class="color-picker">
              {#each notebookColors as color}
                <button
                  class="color-swatch"
                  class:selected={editingNotebookColor === color}
                  style:background-color={color}
                  onclick={() => editingNotebookColor = color}
                  type="button"
                  title={color}
                ></button>
              {/each}
            </div>
            <div class="input-actions">
              <button class="save-btn" onclick={saveNotebookEdit} type="button">Save</button>
              <button class="cancel-btn" onclick={cancelEditing} type="button">Cancel</button>
            </div>
          </div>
        {:else}
          <div class="notebook-item" class:active={!notesStore.viewingTrash && notesStore.selectedNotebookId === notebook.id}>
            {#if hasChildren(notebook.id)}
              <button
                class="expand-btn"
                style:margin-left="{depth * 16}px"
                onclick={() => toggleExpanded(notebook.id)}
                type="button"
              >
                <span class="expand-chevron" class:expanded={isExpanded(notebook.id)}><ChevronRight size={12} /></span>
              </button>
            {:else}
              <span class="expand-spacer" style:margin-left="{depth * 16}px"></span>
            {/if}
            <button
              class="nav-item-btn"
              onclick={() => handleSelectNotebook(notebook.id)}
            >
              <span class="nav-icon" style:color={notebook.color || '#888'}><Folder size={16} /></span>
              <span class="nav-label">{notebook.name}</span>
              {#if getNoteCount(notebook.id) > 0}
                <span class="nav-count">{getNoteCount(notebook.id)}</span>
              {/if}
            </button>
            <div class="notebook-actions">
              <button class="action-btn" onclick={() => startCreatingChild(notebook.id)} title="Add sub-notebook" type="button"><Plus size={12} /></button>
              <button class="action-btn" onclick={() => startEditing(notebook.id, notebook.name, notebook.color)} title="Edit" type="button"><Pencil size={12} /></button>
              <button class="action-btn delete" onclick={() => handleDeleteNotebook(notebook.id, notebook.name)} title="Delete" type="button"><X size={12} /></button>
            </div>
          </div>
        {/if}
        {#if isCreating && creatingParentId === notebook.id && isExpanded(notebook.id)}
          <div class="new-notebook-input" style:padding-left="{16 + (depth + 1) * 16}px">
            <input
              type="text"
              bind:value={newNotebookName}
              onkeydown={handleKeydown}
              placeholder="Sub-notebook name..."
            />
            <div class="input-actions">
              <button class="save-btn" onclick={createNotebook} type="button">Save</button>
              <button class="cancel-btn" onclick={cancelCreating} type="button">Cancel</button>
            </div>
          </div>
        {/if}
      {/each}
    {/if}
    {/if}
  </div>

  <!-- Tags Section -->
  {#if appStore.tags.length > 0}
    <div class="sidebar-section tags-section">
      <button class="section-header-btn" onclick={() => showTags = !showTags}>
        <span class="section-chevron" class:collapsed={!showTags}><ChevronDown size={14} /></span>
        <span>Tags</span>
        <span class="nav-count tags-count">{appStore.tags.length}</span>
      </button>

      {#if showTags}
        <div class="tags-list">
          {#each appStore.tags as tag (tag.id)}
            <button
              class="tag-item"
              class:active={notesStore.filterByTagId === tag.id}
              onclick={() => handleSelectTag(tag.id)}
            >
              <span class="tag-dot" style:background-color={tag.color || '#888'}></span>
              <span class="tag-label">{tag.name}</span>
              <span class="nav-count">{getTagNoteCount(tag.id)}</span>
            </button>
          {/each}
          {#if notesStore.filterByTagId}
            <button class="clear-tag-btn" onclick={() => notesStore.setFilterByTag(null)}>
              Clear filter
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <div class="sidebar-footer">
    <span class="version">v0.1.0</span>
    {#if operationsStore.pendingCount > 0}
      <span class="sync-status" title="{operationsStore.pendingCount} pending operations">
        <span class="sync-icon"><RefreshCw size={14} /></span>
        <span class="sync-count">{operationsStore.pendingCount}</span>
      </span>
    {/if}
    <button class="settings-btn" onclick={() => onShowSettings?.()} title="Settings">
      <Settings size={16} />
    </button>
    <button class="theme-toggle" onclick={() => appStore.toggleTheme()} title={appStore.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      {#if appStore.theme === 'light'}
        <Moon size={16} />
      {:else}
        <Sun size={16} />
      {/if}
    </button>
  </div>
</nav>

<style>
  .sidebar {
    width: 200px;
    height: 100%;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .sidebar-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .app-name {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 1px;
    color: var(--sidebar-text);
  }

  .sidebar-section {
    padding: 4px 0;
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 0;
  }

  .notebooks-section {
    border-top: 1px solid var(--sidebar-border);
  }

  .notebooks-count {
    margin-left: auto;
  }

  .add-btn {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .nav-item {
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--sidebar-text);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }

  .nav-item:hover {
    background: var(--sidebar-hover);
  }

  .nav-item.active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
  }

  .nav-icon {
    font-size: 13px;
  }

  .nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-count {
    font-size: 10px;
    color: var(--sidebar-text-muted);
    background: var(--sidebar-hover);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  .nav-item.active .nav-count {
    background: rgba(255, 255, 255, 0.2);
    color: var(--sidebar-active-text);
  }

  .new-notebook-input {
    padding: 6px 12px;
  }

  .new-notebook-input input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    background: var(--input-bg);
    color: var(--sidebar-text);
    font-size: 13px;
    outline: none;
  }

  .new-notebook-input input:focus {
    border-color: var(--accent-color);
  }

  .input-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .save-btn,
  .cancel-btn {
    flex: 1;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
    text-align: center;
  }

  .save-btn {
    background: var(--accent-color);
    color: #fff;
  }

  .cancel-btn {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* Tags Section */
  .tags-section {
    border-top: 1px solid var(--sidebar-border);
  }

  .tags-count {
    margin-left: auto;
  }

  .tags-list {
    padding: 0 6px 6px;
  }

  .tag-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .tag-item:hover {
    background: var(--sidebar-hover);
  }

  .tag-item.active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
  }

  .tag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-item .nav-count {
    font-size: 10px;
  }

  .tag-item.active .nav-count {
    background: rgba(255, 255, 255, 0.2);
    color: var(--sidebar-active-text);
  }

  .clear-tag-btn {
    width: 100%;
    padding: 5px 10px;
    margin-top: 2px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 11px;
    text-align: center;
    cursor: pointer;
  }

  .clear-tag-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .empty-notebooks {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: var(--sidebar-text-muted);
  }

  .notebook-item {
    display: flex;
    align-items: center;
  }

  .notebook-item:hover {
    background: var(--sidebar-hover);
  }

  .notebook-item.active {
    background: var(--sidebar-active-bg);
  }

  .notebook-item.active .nav-count {
    background: rgba(255, 255, 255, 0.2);
    color: var(--sidebar-active-text);
  }

  .expand-btn {
    width: 14px;
    height: 14px;
    border: none;
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin-left: 6px;
    flex-shrink: 0;
  }

  .expand-btn:hover {
    color: var(--sidebar-text);
  }

  .expand-chevron {
    transition: transform 0.15s ease;
  }

  .expand-chevron.expanded {
    transform: rotate(90deg);
  }

  .expand-spacer {
    width: 14px;
    margin-left: 6px;
    flex-shrink: 0;
  }

  .nav-item-btn {
    flex: 1;
    padding: 6px 6px 6px 4px;
    border: none;
    background: transparent;
    color: var(--sidebar-text);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }

  .notebook-actions {
    display: none;
    padding-right: 6px;
    gap: 2px;
  }

  .notebook-item:hover .notebook-actions {
    display: flex;
  }

  .notebook-item .action-btn {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notebook-item .action-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .notebook-item .action-btn.delete:hover {
    background: var(--danger-color);
    color: #fff;
  }

  .notebook-edit-input {
    padding: 6px 12px;
  }

  .notebook-edit-input input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    background: var(--input-bg);
    color: var(--sidebar-text);
    font-size: 13px;
    outline: none;
  }

  .notebook-edit-input input:focus {
    border-color: var(--accent-color);
  }

  .color-picker {
    display: flex;
    gap: 4px;
    margin: 6px 0;
    flex-wrap: wrap;
  }

  .color-swatch {
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s, border-color 0.1s;
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .color-swatch.selected {
    border-color: var(--sidebar-text);
    box-shadow: 0 0 0 1px var(--accent-color);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 10px 12px;
    border-top: 1px solid var(--sidebar-border);
    font-size: 10px;
    color: var(--sidebar-text-muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sync-status {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    background: var(--sidebar-hover);
    border-radius: var(--radius-sm);
    font-size: 10px;
    color: var(--sidebar-text-muted);
  }

  .sync-icon {
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .sync-count {
    color: var(--sidebar-text);
  }

  .settings-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: var(--sidebar-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .theme-toggle {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    color: var(--sidebar-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .theme-toggle:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* Recent Notes Section */
  .recent-section {
    border-top: 1px solid var(--sidebar-border);
  }

  .section-header-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    text-align: left;
  }

  .section-header-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .section-chevron {
    font-size: 8px;
    transition: transform 0.15s ease;
  }

  .section-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .recent-count {
    margin-left: auto;
  }

  .recent-notes-list {
    padding: 0 6px 6px;
  }

  .recent-note-item {
    width: 100%;
    padding: 5px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
  }

  .recent-note-item:hover {
    background: var(--sidebar-hover);
  }

  .recent-note-item.active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
  }

  .recent-note-title {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clear-recent-btn {
    width: 100%;
    padding: 5px 10px;
    margin-top: 2px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 11px;
    text-align: center;
    cursor: pointer;
  }

  .clear-recent-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .hidden-input {
    display: none;
  }

  .import-container {
    position: relative;
  }

  .import-btn {
    border-top: 1px solid var(--sidebar-border);
    margin-top: 4px;
    padding-top: 10px;
  }

  .import-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .import-menu {
    position: absolute;
    left: 12px;
    right: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 4px 0;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .import-option {
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .import-option:hover {
    background: var(--bg-hover);
  }

  .export-container {
    position: relative;
  }

  .export-btn {
    margin-top: 4px;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .export-menu {
    position: absolute;
    left: 12px;
    right: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 4px 0;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .export-option {
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .export-option:hover {
    background: var(--bg-hover);
  }

  /* Mobile close button - hidden on desktop */
  .mobile-close-btn {
    display: none;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
    font-size: 16px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
  }

  .mobile-close-btn:hover {
    background: var(--sidebar-border);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1000;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
    }

    .sidebar.sidebar-open {
      transform: translateX(0);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .mobile-close-btn {
      display: flex;
    }
  }
</style>
