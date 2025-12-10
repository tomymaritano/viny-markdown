<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import type { Tag } from '@viny/domain';

  let tagInput = $state('');
  let showSuggestions = $state(false);

  // Get current note's tags
  const noteTags = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return [];
    return note.tags
      .map((id) => appStore.getTagById(id))
      .filter((t): t is Tag => t !== null);
  });

  // Filter suggestions based on input
  const suggestions = $derived(() => {
    if (!tagInput.trim()) return [];
    const query = tagInput.toLowerCase();
    const currentTagIds = notesStore.selectedNote?.tags ?? [];
    return appStore.tags
      .filter((t) => !currentTagIds.includes(t.id))
      .filter((t) => t.name.toLowerCase().includes(query))
      .slice(0, 5);
  });

  async function handleAddTag(tagName: string) {
    const note = notesStore.selectedNote;
    if (!note || !tagName.trim()) return;

    const tag = await appStore.findOrCreateTag(tagName.trim());
    await notesStore.addTag(note.id, tag.id);
    tagInput = '';
    showSuggestions = false;
  }

  async function handleRemoveTag(tagId: string) {
    const note = notesStore.selectedNote;
    if (!note) return;
    await notesStore.removeTag(note.id, tagId);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && tagInput.trim()) {
      event.preventDefault();
      handleAddTag(tagInput);
    } else if (event.key === 'Escape') {
      showSuggestions = false;
      tagInput = '';
    }
  }

  function handleInputFocus() {
    showSuggestions = true;
  }

  function handleInputBlur() {
    // Delay to allow clicking suggestions
    setTimeout(() => {
      showSuggestions = false;
    }, 150);
  }
</script>

<div class="tag-input-container">
  <div class="tags-list">
    {#each noteTags() as tag (tag.id)}
      <span class="tag" style:background-color={tag.color || '#e0e0e0'}>
        <span class="tag-name">{tag.name}</span>
        <button class="tag-remove" onclick={() => handleRemoveTag(tag.id)} type="button">x</button>
      </span>
    {/each}
  </div>

  <div class="input-wrapper">
    <input
      type="text"
      bind:value={tagInput}
      onkeydown={handleKeydown}
      onfocus={handleInputFocus}
      onblur={handleInputBlur}
      placeholder="Add tag..."
      class="tag-text-input"
    />

    {#if showSuggestions && suggestions().length > 0}
      <div class="suggestions">
        {#each suggestions() as suggestion (suggestion.id)}
          <button class="suggestion" onclick={() => handleAddTag(suggestion.name)} type="button">
            {suggestion.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tag-input-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 0;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .tag-name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-remove {
    cursor: pointer;
    font-size: 9px;
    font-weight: bold;
    opacity: 0.5;
    padding: 0 2px;
    background: none;
    border: none;
    color: inherit;
    line-height: 1;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .input-wrapper {
    position: relative;
  }

  .tag-text-input {
    padding: 3px 6px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    font-size: 11px;
    outline: none;
    width: 100px;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .tag-text-input:focus {
    border-color: var(--accent-color);
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    max-height: 120px;
    overflow-y: auto;
  }

  .suggestion {
    display: block;
    width: 100%;
    padding: 5px 8px;
    cursor: pointer;
    font-size: 11px;
    text-align: left;
    background: none;
    border: none;
    color: var(--text-primary);
  }

  .suggestion:hover {
    background: var(--bg-hover);
  }
</style>
