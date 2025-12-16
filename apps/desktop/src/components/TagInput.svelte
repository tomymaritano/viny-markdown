<script lang="ts">
  import { appStore, notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';

  let { noteId, tags = [] }: { noteId: string; tags: string[] } = $props();

  let inputValue = $state('');
  let isAdding = $state(false);
  let showSuggestions = $state(false);
  let showSmartSuggestions = $state(false);
  let inputRef: HTMLInputElement;

  const suggestions = $derived(
    inputValue.trim()
      ? appStore.tags
          .filter(
            (t) =>
              t.name.toLowerCase().includes(inputValue.toLowerCase()) &&
              !tags.includes(t.name)
          )
          .slice(0, 5)
      : []
  );

  // Smart tag suggestions based on note content
  const smartSuggestions = $derived(() => {
    const note = notesStore.notes.find(n => n.id === noteId);
    if (!note) return [];

    const content = (note.title + ' ' + note.content).toLowerCase();
    const suggested: string[] = [];

    // Common topic keywords to detect
    const topicKeywords: Record<string, string[]> = {
      'meeting': ['meeting', 'agenda', 'minutes', 'attendees', 'action items'],
      'todo': ['todo', 'task', 'checklist', '[ ]', '[x]', 'deadline'],
      'idea': ['idea', 'brainstorm', 'concept', 'proposal', 'might', 'could'],
      'project': ['project', 'milestone', 'timeline', 'deliverable', 'scope'],
      'personal': ['journal', 'diary', 'reflection', 'feeling', 'today i'],
      'work': ['client', 'deadline', 'report', 'presentation', 'budget'],
      'learning': ['learn', 'study', 'course', 'tutorial', 'lesson', 'notes from'],
      'recipe': ['ingredients', 'recipe', 'cook', 'bake', 'minutes', 'cups', 'tablespoon'],
      'travel': ['travel', 'trip', 'flight', 'hotel', 'itinerary', 'destination'],
      'health': ['health', 'exercise', 'workout', 'diet', 'sleep', 'meditation'],
      'finance': ['budget', 'expense', 'income', 'savings', 'investment', 'cost'],
      'code': ['function', 'const', 'import', 'export', 'class', '```', 'api'],
      'book': ['book', 'chapter', 'author', 'reading', 'quote', 'summary'],
      'important': ['important', 'urgent', 'critical', 'priority', 'asap', '!!!'],
      'draft': ['draft', 'wip', 'work in progress', 'incomplete', 'rough'],
    };

    for (const [tag, keywords] of Object.entries(topicKeywords)) {
      if (tags.includes(tag)) continue;

      const matchCount = keywords.filter(kw => content.includes(kw)).length;
      if (matchCount >= 2 || (matchCount >= 1 && keywords.some(kw => content.includes(kw) && kw.length > 5))) {
        suggested.push(tag);
      }
    }

    // Also suggest existing tags that appear in content
    for (const existingTag of appStore.tags) {
      if (tags.includes(existingTag.name)) continue;
      if (suggested.includes(existingTag.name)) continue;

      if (content.includes(existingTag.name.toLowerCase())) {
        suggested.push(existingTag.name);
      }
    }

    return suggested.slice(0, 5);
  });

  async function addTag(tagName: string) {
    const name = tagName.trim();
    if (!name || tags.includes(name)) {
      inputValue = '';
      return;
    }

    try {
      // Find or create the tag
      await appStore.findOrCreateTag(name);

      // Update note with new tag
      const newTags = [...tags, name];
      await notesStore.updateNote(noteId, {
        title: null,
        content: null,
        notebook_id: null,
        tags: newTags,
        status: null,
        is_pinned: null,
      });

      inputValue = '';
      showSuggestions = false;
    } catch (err) {
      toast.error('Failed to add tag');
    }
  }

  async function removeTag(tagName: string) {
    try {
      const newTags = tags.filter((t) => t !== tagName);
      await notesStore.updateNote(noteId, {
        title: null,
        content: null,
        notebook_id: null,
        tags: newTags,
        status: null,
        is_pinned: null,
      });
    } catch (err) {
      toast.error('Failed to remove tag');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        addTag(suggestions[0].name);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Escape') {
      showSuggestions = false;
      inputValue = '';
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  function handleFocus() {
    showSuggestions = true;
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
    }, 150);
  }
</script>

<div class="tag-input-container">
  <div class="tags-list">
    {#each tags as tag}
      <span class="tag">
        {tag}
        <button class="remove-tag" onclick={() => removeTag(tag)} title="Remove tag">
          x
        </button>
      </span>
    {/each}

    {#if isAdding}
      <div class="input-wrapper">
        <input
          bind:this={inputRef}
          type="text"
          class="tag-input"
          placeholder="Add tag..."
          bind:value={inputValue}
          onkeydown={handleKeydown}
          onfocus={handleFocus}
          onblur={handleBlur}
        />

        {#if showSuggestions && suggestions.length > 0}
          <div class="suggestions">
            {#each suggestions as suggestion}
              <button
                class="suggestion"
                onclick={() => addTag(suggestion.name)}
              >
                <span class="suggestion-name">{suggestion.name}</span>
                {#if suggestion.color}
                  <span
                    class="suggestion-color"
                    style="background: {suggestion.color}"
                  ></span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <button class="add-tag-btn" onclick={() => { isAdding = true; setTimeout(() => inputRef?.focus(), 0); }}>
        + Add tag
      </button>
    {/if}

    {#if smartSuggestions().length > 0 && !isAdding}
      <button
        class="smart-suggest-btn"
        onclick={() => showSmartSuggestions = !showSmartSuggestions}
        title="Smart tag suggestions"
      >
        {smartSuggestions().length} suggestions
      </button>
    {/if}
  </div>

  {#if showSmartSuggestions && smartSuggestions().length > 0}
    <div class="smart-suggestions">
      <div class="smart-header">
        <span class="smart-title">Suggested tags</span>
        <button class="smart-close" onclick={() => showSmartSuggestions = false}>✕</button>
      </div>
      <div class="smart-list">
        {#each smartSuggestions() as suggestion}
          <button class="smart-tag" onclick={() => { addTag(suggestion); showSmartSuggestions = smartSuggestions().length > 1; }}>
            <span class="smart-tag-name">{suggestion}</span>
            <span class="smart-tag-add">+ Add</span>
          </button>
        {/each}
      </div>
      <button class="smart-add-all" onclick={() => { smartSuggestions().forEach(s => addTag(s)); showSmartSuggestions = false; }}>
        Add all suggestions
      </button>
    </div>
  {/if}
</div>

<style>
  .tag-input-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tags-list {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .remove-tag {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 50%;
    font-size: 10px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .remove-tag:hover {
    background: var(--text-tertiary);
    color: var(--bg-primary);
  }

  .input-wrapper {
    position: relative;
  }

  .tag-input {
    width: 100px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-primary);
    outline: none;
  }

  .tag-input:focus {
    border-color: var(--accent);
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    z-index: 100;
    min-width: 150px;
  }

  .suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
  }

  .suggestion:hover {
    background: var(--bg-hover);
  }

  .suggestion-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .add-tag-btn {
    padding: 4px 10px;
    background: none;
    border: 1px dashed var(--border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .add-tag-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Smart suggestions */
  .smart-suggest-btn {
    padding: 4px 10px;
    background: linear-gradient(135deg, var(--accent-light), rgba(139, 92, 246, 0.15));
    border: 1px solid var(--accent);
    border-radius: 12px;
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
    transition: all 0.15s ease;
    animation: pulse-smart 2s infinite;
  }

  @keyframes pulse-smart {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  .smart-suggest-btn:hover {
    background: var(--accent);
    color: white;
    animation: none;
  }

  .smart-suggestions {
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    animation: slideDown 0.15s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .smart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .smart-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .smart-close {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .smart-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .smart-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .smart-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .smart-tag:hover {
    border-color: var(--accent);
    background: var(--accent-light);
  }

  .smart-tag-name {
    font-weight: 500;
  }

  .smart-tag-add {
    font-size: 10px;
    color: var(--text-tertiary);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .smart-tag:hover .smart-tag-add {
    opacity: 1;
    color: var(--accent);
  }

  .smart-add-all {
    width: 100%;
    padding: 8px;
    background: none;
    border: 1px dashed var(--border);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .smart-add-all:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-light);
  }
</style>
