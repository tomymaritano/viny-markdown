<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import type { Tag } from '@viny/domain';
  import { Check, X, Pencil, Trash2 } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let editingTagId = $state<string | null>(null);
  let editingName = $state('');
  let selectedTags = $state<Set<string>>(new Set());
  let mergeTargetId = $state<string | null>(null);
  let showMergeModal = $state(false);
  let searchQuery = $state('');

  // Get tag usage counts
  const tagUsage = $derived(() => {
    const usage = new Map<string, number>();
    for (const note of notesStore.allNotes) {
      for (const tagId of note.tags) {
        usage.set(tagId, (usage.get(tagId) || 0) + 1);
      }
    }
    return usage;
  });

  // Filter and sort tags
  const filteredTags = $derived(() => {
    let result = [...appStore.tags];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(query));
    }

    // Sort by usage count (descending)
    return result.sort((a, b) => {
      const usageA = tagUsage().get(a.id) || 0;
      const usageB = tagUsage().get(b.id) || 0;
      return usageB - usageA;
    });
  });

  // Stats
  const totalTags = $derived(appStore.tags.length);
  const unusedTags = $derived(() => {
    return appStore.tags.filter(t => !tagUsage().get(t.id)).length;
  });

  function startEditing(tag: Tag) {
    editingTagId = tag.id;
    editingName = tag.name;
  }

  function cancelEditing() {
    editingTagId = null;
    editingName = '';
  }

  async function saveTagName() {
    if (!editingTagId || !editingName.trim()) return;

    await appStore.renameTag(editingTagId, editingName.trim());
    editingTagId = null;
    editingName = '';
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      saveTagName();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  function toggleTagSelection(tagId: string) {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    selectedTags = newSelected;
  }

  function selectAll() {
    selectedTags = new Set(filteredTags().map(t => t.id));
  }

  function deselectAll() {
    selectedTags = new Set();
  }

  async function deleteSelectedTags() {
    if (selectedTags.size === 0) return;

    const count = selectedTags.size;
    if (!confirm(`Delete ${count} tag${count > 1 ? 's' : ''}? Notes will keep their content but lose these tag associations.`)) {
      return;
    }

    for (const tagId of selectedTags) {
      await appStore.deleteTag(tagId);
    }

    selectedTags = new Set();
  }

  async function deleteUnusedTags() {
    const unused = appStore.tags.filter(t => !tagUsage().get(t.id));
    if (unused.length === 0) {
      alert('No unused tags to delete.');
      return;
    }

    if (!confirm(`Delete ${unused.length} unused tag${unused.length > 1 ? 's' : ''}?`)) {
      return;
    }

    for (const tag of unused) {
      await appStore.deleteTag(tag.id);
    }
  }

  function openMergeModal() {
    if (selectedTags.size < 2) {
      alert('Select at least 2 tags to merge.');
      return;
    }
    mergeTargetId = [...selectedTags][0];
    showMergeModal = true;
  }

  async function performMerge() {
    if (!mergeTargetId || selectedTags.size < 2) return;

    const targetTag = appStore.tags.find(t => t.id === mergeTargetId);
    if (!targetTag) return;

    // Get tags to merge (excluding target)
    const tagsToMerge = [...selectedTags].filter(id => id !== mergeTargetId);

    // Update all notes: replace merged tag IDs with target tag ID
    for (const note of notesStore.allNotes) {
      const hasAnyMergedTag = tagsToMerge.some(tagId => note.tags.includes(tagId));
      if (hasAnyMergedTag) {
        // Remove old tags and add target tag if not already present
        let newTags = note.tags.filter(t => !tagsToMerge.includes(t));
        if (!newTags.includes(mergeTargetId)) {
          newTags.push(mergeTargetId);
        }
        // Update the note's tags
        await notesStore.updateNoteTags(note.id, newTags);
      }
    }

    // Delete the merged tags
    for (const tagId of tagsToMerge) {
      await appStore.deleteTag(tagId);
    }

    showMergeModal = false;
    selectedTags = new Set();
    mergeTargetId = null;
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
      } else if (editingTagId) {
        cancelEditing();
      } else {
        onClose();
      }
    }
  }

  function getTagColor(tag: Tag): string {
    return tag.color || 'var(--accent-color)';
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
        <h2>Tag Manager</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close">x</button>
      </header>

      <div class="modal-body">
        <!-- Stats -->
        <div class="stats-row">
          <div class="stat">
            <span class="stat-value">{totalTags}</span>
            <span class="stat-label">Total Tags</span>
          </div>
          <div class="stat">
            <span class="stat-value">{unusedTags()}</span>
            <span class="stat-label">Unused</span>
          </div>
          <div class="stat">
            <span class="stat-value">{selectedTags.size}</span>
            <span class="stat-label">Selected</span>
          </div>
        </div>

        <!-- Search -->
        <div class="search-row">
          <input
            type="text"
            class="search-input"
            placeholder="Search tags..."
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
            disabled={selectedTags.size < 2}
          >
            Merge ({selectedTags.size})
          </button>
          <button
            class="action-btn danger"
            onclick={deleteSelectedTags}
            disabled={selectedTags.size === 0}
          >
            Delete ({selectedTags.size})
          </button>
          <button
            class="action-btn"
            onclick={deleteUnusedTags}
            disabled={unusedTags() === 0}
          >
            Clean Unused
          </button>
        </div>

        <!-- Tag List -->
        <div class="tag-list">
          {#each filteredTags() as tag (tag.id)}
            <div
              class="tag-item"
              class:selected={selectedTags.has(tag.id)}
            >
              <label class="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag.id)}
                  onchange={() => toggleTagSelection(tag.id)}
                />
              </label>

              <span
                class="tag-color"
                style="background: {getTagColor(tag)}"
              ></span>

              {#if editingTagId === tag.id}
                <input
                  type="text"
                  class="tag-name-input"
                  bind:value={editingName}
                  onkeydown={handleEditKeydown}
                  onblur={saveTagName}
                />
              {:else}
                <span class="tag-name" ondblclick={() => startEditing(tag)}>
                  {tag.name}
                </span>
              {/if}

              <span class="tag-count" title="Notes with this tag">
                {tagUsage().get(tag.id) || 0}
              </span>

              <div class="tag-actions">
                {#if editingTagId === tag.id}
                  <button class="icon-btn" onclick={saveTagName} title="Save">
                    <Check size={14} />
                  </button>
                  <button class="icon-btn" onclick={cancelEditing} title="Cancel">
                    <X size={14} />
                  </button>
                {:else}
                  <button class="icon-btn" onclick={() => startEditing(tag)} title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button
                    class="icon-btn danger"
                    onclick={() => appStore.deleteTag(tag.id)}
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
                No tags match "{searchQuery}"
              {:else}
                No tags yet. Add tags to your notes to see them here.
              {/if}
            </p>
          {/each}
        </div>
      </div>

      <footer class="modal-footer">
        <span class="tip">Double-click a tag name to rename it</span>
      </footer>
    </div>
  </div>

  <!-- Merge Modal -->
  {#if showMergeModal}
    <div class="merge-modal-backdrop" onclick={() => showMergeModal = false}>
      <div class="merge-modal" onclick={(e) => e.stopPropagation()}>
        <h3>Merge Tags</h3>
        <p>Select the target tag that will absorb the others:</p>

        <div class="merge-options">
          {#each [...selectedTags] as tagId}
            {@const tag = appStore.tags.find(t => t.id === tagId)}
            {#if tag}
              <label class="merge-option" class:selected={mergeTargetId === tagId}>
                <input
                  type="radio"
                  name="mergeTarget"
                  value={tagId}
                  checked={mergeTargetId === tagId}
                  onchange={() => mergeTargetId = tagId}
                />
                <span class="tag-color" style="background: {getTagColor(tag)}"></span>
                <span>{tag.name}</span>
                <span class="tag-count">({tagUsage().get(tagId) || 0} notes)</span>
              </label>
            {/if}
          {/each}
        </div>

        <div class="merge-actions">
          <button class="cancel-btn" onclick={() => showMergeModal = false}>
            Cancel
          </button>
          <button class="merge-btn" onclick={performMerge}>
            Merge into "{appStore.tags.find(t => t.id === mergeTargetId)?.name}"
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
    max-width: 500px;
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
    font-size: 16px;
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
    border-radius: var(--radius-md);
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

  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  .tag-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    transition: background 0.15s;
  }

  .tag-item:hover {
    background: var(--bg-hover);
  }

  .tag-item.selected {
    background: rgba(74, 158, 255, 0.15);
  }

  .tag-checkbox input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
  }

  .tag-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-name {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .tag-name-input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
  }

  .tag-count {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 24px;
    text-align: right;
  }

  .tag-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .tag-item:hover .tag-actions {
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
  }
</style>
