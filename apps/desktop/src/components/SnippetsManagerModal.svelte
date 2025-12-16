<script lang="ts">
  import { X } from '@lucide/svelte';
  import {
    type CustomSnippet,
    getCustomSnippets,
    addCustomSnippet,
    updateCustomSnippet,
    deleteCustomSnippet,
    exportCustomSnippets,
    importCustomSnippets,
    snippetCategories,
    getAvailableVariables,
    processTemplate,
  } from '$lib/snippets';

  let { open = $bindable(false) } = $props<{
    open?: boolean;
  }>();

  let customSnippets = $state<CustomSnippet[]>([]);
  let searchQuery = $state('');
  let selectedCategory = $state('all');
  let editingSnippet = $state<CustomSnippet | null>(null);
  let isCreating = $state(false);
  let showVariables = $state(false);
  let importError = $state('');

  // Form state
  let formName = $state('');
  let formDescription = $state('');
  let formIcon = $state('');
  let formTemplate = $state('');
  let formCategory = $state('custom');

  const availableVariables = getAvailableVariables();

  function loadSnippets() {
    customSnippets = getCustomSnippets();
  }

  $effect(() => {
    if (open) {
      loadSnippets();
    }
  });

  const filteredSnippets = $derived(() => {
    let filtered = customSnippets;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  function resetForm() {
    formName = '';
    formDescription = '';
    formIcon = 'S';
    formTemplate = '';
    formCategory = 'custom';
    editingSnippet = null;
    isCreating = false;
  }

  function startCreate() {
    resetForm();
    isCreating = true;
  }

  function startEdit(snippet: CustomSnippet) {
    formName = snippet.name;
    formDescription = snippet.description;
    formIcon = snippet.icon;
    formTemplate = snippet.template;
    formCategory = snippet.category;
    editingSnippet = snippet;
    isCreating = false;
  }

  function saveSnippet() {
    if (!formName.trim() || !formTemplate.trim()) return;

    if (editingSnippet) {
      updateCustomSnippet(editingSnippet.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        icon: formIcon || 'S',
        template: formTemplate,
        category: formCategory,
      });
    } else {
      addCustomSnippet({
        name: formName.trim(),
        description: formDescription.trim(),
        icon: formIcon || 'S',
        template: formTemplate,
        category: formCategory,
      });
    }

    loadSnippets();
    resetForm();
  }

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this snippet?')) {
      deleteCustomSnippet(id);
      loadSnippets();
      if (editingSnippet?.id === id) {
        resetForm();
      }
    }
  }

  function handleExport() {
    const data = exportCustomSnippets();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'viny-snippets.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = importCustomSnippets(text);
        if (count > 0) {
          loadSnippets();
          importError = '';
        } else {
          importError = 'No valid snippets found in file';
        }
      } catch {
        importError = 'Failed to import snippets';
      }
    };
    input.click();
  }

  function insertVariable(placeholder: string) {
    formTemplate += placeholder;
  }

  function close() {
    open = false;
    resetForm();
    importError = '';
  }

  const previewTemplate = $derived(processTemplate(formTemplate));

  const commonEmojis = ['S', 'L', 'R', 'F', 'P', 'B', 'C', 'Y', 'V', 'G', 'D', 'T'];
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="snippets-title"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="snippets-title">Snippets Manager</h2>
        <button class="close-btn" onclick={close} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        <!-- Left Panel: Snippets List -->
        <div class="snippets-list-panel">
          <div class="list-header">
            <input
              type="text"
              class="search-input"
              placeholder="Search snippets..."
              bind:value={searchQuery}
            />
            <div class="list-actions">
              <button class="action-btn create-btn" onclick={startCreate} title="Create snippet">
                + New
              </button>
              <button class="action-btn" onclick={handleImport} title="Import snippets">
                Import
              </button>
              <button
                class="action-btn"
                onclick={handleExport}
                disabled={customSnippets.length === 0}
                title="Export snippets"
              >
                Export
              </button>
            </div>
          </div>

          {#if importError}
            <div class="error-message">{importError}</div>
          {/if}

          <div class="category-filter">
            <button
              class="category-btn"
              class:active={selectedCategory === 'all'}
              onclick={() => (selectedCategory = 'all')}
            >
              All
            </button>
            {#each snippetCategories.filter(c => c.id === 'custom' || customSnippets.some(s => s.category === c.id)) as category}
              <button
                class="category-btn"
                class:active={selectedCategory === category.id}
                onclick={() => (selectedCategory = category.id)}
              >
                {category.icon} {category.name}
              </button>
            {/each}
          </div>

          <div class="snippets-list">
            {#if customSnippets.length === 0}
              <div class="empty-state">
                <p>No custom snippets yet</p>
                <p class="hint">Create your first snippet to get started</p>
              </div>
            {:else if filteredSnippets().length === 0}
              <div class="empty-state">
                <p>No snippets match your search</p>
              </div>
            {:else}
              {#each filteredSnippets() as snippet (snippet.id)}
                <div
                  class="snippet-item"
                  class:active={editingSnippet?.id === snippet.id}
                  role="button"
                  tabindex="0"
                  onclick={() => startEdit(snippet)}
                  onkeydown={(e) => e.key === 'Enter' && startEdit(snippet)}
                >
                  <span class="snippet-icon">{snippet.icon}</span>
                  <div class="snippet-info">
                    <span class="snippet-name">{snippet.name}</span>
                    <span class="snippet-desc">{snippet.description}</span>
                  </div>
                  <button
                    class="delete-btn"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleDelete(snippet.id);
                    }}
                    title="Delete snippet"
                  >
                    Del
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Right Panel: Editor -->
        <div class="editor-panel">
          {#if isCreating || editingSnippet}
            <h3>{isCreating ? 'Create Snippet' : 'Edit Snippet'}</h3>

            <div class="form-group">
              <label for="snippet-name">Name</label>
              <input
                id="snippet-name"
                type="text"
                class="form-input"
                placeholder="e.g., meeting"
                bind:value={formName}
              />
              <span class="hint">Trigger with /{formName || 'name'}</span>
            </div>

            <div class="form-group">
              <label for="snippet-desc">Description</label>
              <input
                id="snippet-desc"
                type="text"
                class="form-input"
                placeholder="Brief description"
                bind:value={formDescription}
              />
            </div>

            <div class="form-row">
              <div class="form-group icon-group">
                <label for="snippet-icon">Icon</label>
                <div class="icon-selector">
                  <input
                    id="snippet-icon"
                    type="text"
                    class="form-input icon-input"
                    maxlength="2"
                    bind:value={formIcon}
                  />
                  <div class="emoji-picker">
                    {#each commonEmojis as emoji}
                      <button
                        type="button"
                        class="emoji-btn"
                        onclick={() => (formIcon = emoji)}
                      >
                        {emoji}
                      </button>
                    {/each}
                  </div>
                </div>
              </div>

              <div class="form-group category-group">
                <label for="snippet-category">Category</label>
                <select
                  id="snippet-category"
                  class="form-input"
                  bind:value={formCategory}
                >
                  {#each snippetCategories as category}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="snippet-template">Template</label>
                <button
                  type="button"
                  class="variables-toggle"
                  onclick={() => (showVariables = !showVariables)}
                >
                  {showVariables ? 'Hide' : 'Show'} Variables
                </button>
              </div>

              {#if showVariables}
                <div class="variables-panel">
                  <p class="variables-hint">Click to insert variable:</p>
                  <div class="variables-grid">
                    {#each availableVariables as variable}
                      <button
                        type="button"
                        class="variable-btn"
                        onclick={() => insertVariable(variable.placeholder)}
                        title={variable.description}
                      >
                        <code>{variable.placeholder}</code>
                        <span class="var-example">{variable.example}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              <textarea
                id="snippet-template"
                class="form-input template-input"
                placeholder="Enter your template content..."
                rows="6"
                bind:value={formTemplate}
              ></textarea>
            </div>

            {#if formTemplate}
              <div class="preview-section">
                <label>Preview</label>
                <pre class="preview-content">{previewTemplate}</pre>
              </div>
            {/if}

            <div class="form-actions">
              <button class="cancel-btn" onclick={resetForm}>Cancel</button>
              <button
                class="save-btn"
                onclick={saveSnippet}
                disabled={!formName.trim() || !formTemplate.trim()}
              >
                {isCreating ? 'Create' : 'Save'}
              </button>
            </div>
          {:else}
            <div class="no-selection">
              <p>Select a snippet to edit or create a new one</p>
              <button class="action-btn create-btn" onclick={startCreate}>
                + Create Snippet
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
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
    padding: 24px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 16px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 6px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Left Panel */
  .snippets-list-panel {
    width: 320px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
  }

  .list-header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .list-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 8px 12px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.create-btn {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .action-btn.create-btn:hover {
    opacity: 0.9;
  }

  .error-message {
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 12px;
  }

  .category-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .category-btn {
    padding: 4px 10px;
    font-size: 11px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .category-btn:hover {
    background: var(--bg-hover);
  }

  .category-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .snippets-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-tertiary);
  }

  .empty-state .hint {
    font-size: 12px;
    margin-top: 8px;
  }

  .snippet-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .snippet-item:hover {
    background: var(--bg-hover);
  }

  .snippet-item.active {
    background: var(--accent-light, rgba(59, 130, 246, 0.1));
  }

  .snippet-icon {
    font-size: 20px;
    width: 32px;
    text-align: center;
  }

  .snippet-info {
    flex: 1;
    min-width: 0;
  }

  .snippet-name {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .snippet-desc {
    display: block;
    font-size: 12px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .delete-btn {
    opacity: 0;
    padding: 4px 8px;
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .snippet-item:hover .delete-btn {
    opacity: 0.6;
  }

  .delete-btn:hover {
    opacity: 1 !important;
    background: rgba(239, 68, 68, 0.1);
  }

  /* Right Panel */
  .editor-panel {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .editor-panel h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 20px;
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-tertiary);
    gap: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    font-size: 14px;
    color: var(--text-primary);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-group .hint {
    display: block;
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .icon-group {
    width: 140px;
  }

  .category-group {
    flex: 1;
  }

  .icon-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .icon-input {
    width: 60px;
    text-align: center;
    font-size: 20px;
  }

  .emoji-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .emoji-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .emoji-btn:hover {
    background: var(--bg-hover);
    transform: scale(1.1);
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .label-row label {
    margin-bottom: 0;
  }

  .variables-toggle {
    padding: 4px 10px;
    font-size: 11px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .variables-toggle:hover {
    background: var(--bg-hover);
  }

  .variables-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .variables-hint {
    font-size: 11px;
    color: var(--text-tertiary);
    margin: 0 0 8px;
  }

  .variables-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .variable-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .variable-btn:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .variable-btn code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
  }

  .var-example {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-top: 2px;
  }

  .template-input {
    font-family: var(--font-mono);
    font-size: 13px;
    resize: vertical;
    min-height: 120px;
  }

  .preview-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .preview-section label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-content {
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
    margin: 0;
    max-height: 150px;
    overflow-y: auto;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .cancel-btn {
    padding: 10px 20px;
    font-size: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: var(--bg-hover);
  }

  .save-btn {
    padding: 10px 24px;
    font-size: 14px;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-weight: 500;
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
