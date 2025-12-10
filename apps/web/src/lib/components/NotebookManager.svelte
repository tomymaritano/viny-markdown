<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import type { Notebook } from '@viny/domain';
  import { Check, X, Pencil, Trash2 } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let editingNotebookId = $state<string | null>(null);
  let editingName = $state('');
  let editingColor = $state<string | null>(null);
  let selectedNotebooks = $state<Set<string>>(new Set());
  let mergeTargetId = $state<string | null>(null);
  let showMergeModal = $state(false);
  let showColorPicker = $state<string | null>(null);
  let searchQuery = $state('');

  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#78716c', '#71717a', '#64748b',
  ];

  // Get notebook note counts
  const notebookCounts = $derived(() => {
    const counts = new Map<string, number>();
    for (const note of notesStore.allNotes) {
      if (note.notebookId) {
        counts.set(note.notebookId, (counts.get(note.notebookId) || 0) + 1);
      }
    }
    return counts;
  });

  // Filter and sort notebooks
  const filteredNotebooks = $derived(() => {
    let result = [...appStore.notebooks];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(n => n.name.toLowerCase().includes(query));
    }

    // Sort by note count (descending), then alphabetically
    return result.sort((a, b) => {
      const countA = notebookCounts().get(a.id) || 0;
      const countB = notebookCounts().get(b.id) || 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
  });

  // Stats
  const totalNotebooks = $derived(appStore.notebooks.length);
  const emptyNotebooks = $derived(() => {
    return appStore.notebooks.filter(n => !notebookCounts().get(n.id)).length;
  });
  const uncategorizedNotes = $derived(() => {
    return notesStore.allNotes.filter(n => !n.notebookId).length;
  });

  function startEditing(notebook: Notebook) {
    editingNotebookId = notebook.id;
    editingName = notebook.name;
    editingColor = notebook.color;
  }

  function cancelEditing() {
    editingNotebookId = null;
    editingName = '';
    editingColor = null;
    showColorPicker = null;
  }

  async function saveNotebook() {
    if (!editingNotebookId || !editingName.trim()) return;

    await appStore.updateNotebook(editingNotebookId, {
      name: editingName.trim(),
      color: editingColor,
    });
    editingNotebookId = null;
    editingName = '';
    editingColor = null;
    showColorPicker = null;
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      saveNotebook();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  function toggleNotebookSelection(notebookId: string) {
    const newSelected = new Set(selectedNotebooks);
    if (newSelected.has(notebookId)) {
      newSelected.delete(notebookId);
    } else {
      newSelected.add(notebookId);
    }
    selectedNotebooks = newSelected;
  }

  function selectAll() {
    selectedNotebooks = new Set(filteredNotebooks().map(n => n.id));
  }

  function deselectAll() {
    selectedNotebooks = new Set();
  }

  async function deleteSelectedNotebooks() {
    if (selectedNotebooks.size === 0) return;

    const count = selectedNotebooks.size;
    const noteCount = [...selectedNotebooks].reduce((sum, id) => sum + (notebookCounts().get(id) || 0), 0);

    const message = noteCount > 0
      ? `Delete ${count} notebook${count > 1 ? 's' : ''}? ${noteCount} note${noteCount > 1 ? 's' : ''} will become uncategorized.`
      : `Delete ${count} empty notebook${count > 1 ? 's' : ''}?`;

    if (!confirm(message)) return;

    for (const notebookId of selectedNotebooks) {
      await appStore.deleteNotebook(notebookId);
    }

    selectedNotebooks = new Set();
  }

  async function deleteEmptyNotebooks() {
    const empty = appStore.notebooks.filter(n => !notebookCounts().get(n.id));
    if (empty.length === 0) {
      alert('No empty notebooks to delete.');
      return;
    }

    if (!confirm(`Delete ${empty.length} empty notebook${empty.length > 1 ? 's' : ''}?`)) {
      return;
    }

    for (const notebook of empty) {
      await appStore.deleteNotebook(notebook.id);
    }
  }

  function openMergeModal() {
    if (selectedNotebooks.size < 2) {
      alert('Select at least 2 notebooks to merge.');
      return;
    }
    mergeTargetId = [...selectedNotebooks][0];
    showMergeModal = true;
  }

  async function performMerge() {
    if (!mergeTargetId || selectedNotebooks.size < 2) return;

    const targetNotebook = appStore.notebooks.find(n => n.id === mergeTargetId);
    if (!targetNotebook) return;

    // Get notebooks to merge (excluding target)
    const notebooksToMerge = [...selectedNotebooks].filter(id => id !== mergeTargetId);

    // Move all notes from source notebooks to target
    for (const note of notesStore.allNotes) {
      if (note.notebookId && notebooksToMerge.includes(note.notebookId)) {
        await notesStore.moveNote(note.id, mergeTargetId);
      }
    }

    // Delete the merged notebooks
    for (const notebookId of notebooksToMerge) {
      await appStore.deleteNotebook(notebookId);
    }

    showMergeModal = false;
    selectedNotebooks = new Set();
    mergeTargetId = null;
  }

  async function setNotebookColor(notebookId: string, color: string | null) {
    await appStore.updateNotebook(notebookId, { color });
    showColorPicker = null;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showMergeModal) {
        showMergeModal = false;
      } else if (showColorPicker) {
        showColorPicker = null;
      } else if (editingNotebookId) {
        cancelEditing();
      } else {
        onClose();
      }
    }
  }

  function getNotebookColor(notebook: Notebook): string {
    return notebook.color || 'var(--accent-color)';
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2>Notebook Manager</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        <!-- Stats -->
        <div class="stats-row">
          <div class="stat">
            <span class="stat-value">{totalNotebooks}</span>
            <span class="stat-label">Notebooks</span>
          </div>
          <div class="stat">
            <span class="stat-value">{emptyNotebooks()}</span>
            <span class="stat-label">Empty</span>
          </div>
          <div class="stat">
            <span class="stat-value">{uncategorizedNotes()}</span>
            <span class="stat-label">Uncategorized</span>
          </div>
        </div>

        <!-- Search -->
        <div class="search-row">
          <input
            type="text"
            class="search-input"
            placeholder="Search notebooks..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Actions -->
        <div class="actions-row">
          <button class="action-btn" onclick={selectAll}>Select All</button>
          <button class="action-btn" onclick={deselectAll}>Deselect</button>
          <button
            class="action-btn"
            onclick={openMergeModal}
            disabled={selectedNotebooks.size < 2}
          >
            Merge ({selectedNotebooks.size})
          </button>
          <button
            class="action-btn danger"
            onclick={deleteSelectedNotebooks}
            disabled={selectedNotebooks.size === 0}
          >
            Delete ({selectedNotebooks.size})
          </button>
          <button
            class="action-btn"
            onclick={deleteEmptyNotebooks}
            disabled={emptyNotebooks() === 0}
          >
            Clean Empty
          </button>
        </div>

        <!-- Notebook List -->
        <div class="notebook-list">
          {#each filteredNotebooks() as notebook (notebook.id)}
            <div
              class="notebook-item"
              class:selected={selectedNotebooks.has(notebook.id)}
            >
              <label class="notebook-checkbox">
                <input
                  type="checkbox"
                  checked={selectedNotebooks.has(notebook.id)}
                  onchange={() => toggleNotebookSelection(notebook.id)}
                />
              </label>

              <button
                class="notebook-color"
                style="background: {getNotebookColor(notebook)}"
                onclick={() => showColorPicker = showColorPicker === notebook.id ? null : notebook.id}
                title="Change color"
              ></button>

              {#if showColorPicker === notebook.id}
                <div class="color-picker">
                  {#each colors as color}
                    <button
                      class="color-option"
                      class:active={notebook.color === color}
                      style="background: {color}"
                      onclick={() => setNotebookColor(notebook.id, color)}
                    ></button>
                  {/each}
                  <button
                    class="color-option reset"
                    onclick={() => setNotebookColor(notebook.id, null)}
                    title="Reset to default"
                  >
                    ↺
                  </button>
                </div>
              {/if}

              {#if editingNotebookId === notebook.id}
                <input
                  type="text"
                  class="notebook-name-input"
                  bind:value={editingName}
                  onkeydown={handleEditKeydown}
                  onblur={saveNotebook}
                />
              {:else}
                <span class="notebook-name" ondblclick={() => startEditing(notebook)}>
                  {notebook.name}
                </span>
              {/if}

              <span class="notebook-count" title="Notes in this notebook">
                {notebookCounts().get(notebook.id) || 0}
              </span>

              <div class="notebook-actions">
                {#if editingNotebookId === notebook.id}
                  <button class="icon-btn" onclick={saveNotebook} title="Save">
                    <Check size={14} />
                  </button>
                  <button class="icon-btn" onclick={cancelEditing} title="Cancel">
                    <X size={14} />
                  </button>
                {:else}
                  <button class="icon-btn" onclick={() => startEditing(notebook)} title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button
                    class="icon-btn danger"
                    onclick={() => {
                      const count = notebookCounts().get(notebook.id) || 0;
                      const msg = count > 0
                        ? `Delete "${notebook.name}"? ${count} note${count > 1 ? 's' : ''} will become uncategorized.`
                        : `Delete "${notebook.name}"?`;
                      if (confirm(msg)) appStore.deleteNotebook(notebook.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                {/if}
              </div>
            </div>
          {:else}
            <p class="empty-message">
              {#if searchQuery}
                No notebooks match "{searchQuery}"
              {:else}
                No notebooks yet. Create one from the sidebar.
              {/if}
            </p>
          {/each}
        </div>
      </div>

      <footer class="modal-footer">
        <span class="tip">Double-click a notebook name to rename it • Click the color dot to change color</span>
      </footer>
    </div>
  </div>

  <!-- Merge Modal -->
  {#if showMergeModal}
    <div class="merge-modal-backdrop" onclick={() => showMergeModal = false} role="presentation">
      <div class="merge-modal" onclick={(e) => e.stopPropagation()}>
        <h3>Merge Notebooks</h3>
        <p>Select the target notebook. All notes from other selected notebooks will be moved here:</p>

        <div class="merge-options">
          {#each [...selectedNotebooks] as notebookId}
            {@const notebook = appStore.notebooks.find(n => n.id === notebookId)}
            {#if notebook}
              <label class="merge-option" class:selected={mergeTargetId === notebookId}>
                <input
                  type="radio"
                  name="mergeTarget"
                  value={notebookId}
                  checked={mergeTargetId === notebookId}
                  onchange={() => mergeTargetId = notebookId}
                />
                <span class="notebook-color-dot" style="background: {getNotebookColor(notebook)}"></span>
                <span>{notebook.name}</span>
                <span class="notebook-count">({notebookCounts().get(notebookId) || 0} notes)</span>
              </label>
            {/if}
          {/each}
        </div>

        <div class="merge-actions">
          <button class="cancel-btn" onclick={() => showMergeModal = false}>
            Cancel
          </button>
          <button class="merge-btn" onclick={performMerge}>
            Merge into "{appStore.notebooks.find(n => n.id === mergeTargetId)?.name}"
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 520px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .close-btn:hover {
    background: var(--bg-hover);
  }

  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .stats-row {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }

  .stat {
    flex: 1;
    text-align: center;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .search-row {
    margin-bottom: 12px;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .action-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.danger:hover:not(:disabled) {
    background: #fee2e2;
    border-color: #ef4444;
    color: #dc2626;
  }

  .notebook-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  .notebook-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    transition: background 0.15s;
    position: relative;
  }

  .notebook-item:hover {
    background: var(--bg-hover);
  }

  .notebook-item.selected {
    background: rgba(74, 158, 255, 0.15);
  }

  .notebook-checkbox input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
  }

  .notebook-color {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    flex-shrink: 0;
    border: none;
    cursor: pointer;
    transition: transform 0.15s;
  }

  .notebook-color:hover {
    transform: scale(1.1);
  }

  .color-picker {
    position: absolute;
    top: 100%;
    left: 40px;
    z-index: 10;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .color-option {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.active {
    border-color: var(--text-primary);
  }

  .color-option.reset {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .notebook-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .notebook-name-input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
  }

  .notebook-count {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 24px;
    text-align: right;
  }

  .notebook-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .notebook-item:hover .notebook-actions {
    opacity: 1;
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: var(--bg-tertiary);
  }

  .icon-btn.danger:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .empty-message {
    text-align: center;
    padding: 32px;
    color: var(--text-muted);
    font-size: 14px;
  }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    text-align: center;
  }

  .tip {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Merge Modal */
  .merge-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .merge-modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    padding: 20px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .merge-modal h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--text-primary);
  }

  .merge-modal p {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .merge-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .merge-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .merge-option:hover {
    background: var(--bg-secondary);
  }

  .merge-option.selected {
    background: rgba(74, 158, 255, 0.1);
    border-color: var(--accent-color);
  }

  .merge-option input[type="radio"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
  }

  .notebook-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .merge-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: var(--bg-hover);
  }

  .merge-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--accent-color);
    color: white;
    font-size: 13px;
    cursor: pointer;
  }

  .merge-btn:hover {
    opacity: 0.9;
  }

  @media (max-width: 500px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .stats-row {
      flex-wrap: wrap;
    }

    .stat {
      min-width: calc(50% - 8px);
    }

    .tip {
      font-size: 11px;
    }
  }
</style>
