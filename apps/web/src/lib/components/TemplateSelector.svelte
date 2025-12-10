<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let showCreateForm = $state(false);
  let newTemplateName = $state('');
  let newTemplateIcon = $state('');

  const templateIcons = ['', '', '', '', '', '', '', '', '', '', '', ''];

  const templates = $derived(() => notesStore.getAllTemplates());

  async function handleSelect(templateId: string) {
    await notesStore.createFromAnyTemplate(templateId);
    onclose();
  }

  function handleDeleteCustom(templateId: string, event: MouseEvent) {
    event.stopPropagation();
    if (confirm('Delete this template?')) {
      notesStore.deleteCustomTemplate(templateId);
    }
  }

  function handleSaveAsTemplate() {
    if (!notesStore.selectedNoteId) return;
    showCreateForm = true;
    newTemplateName = notesStore.selectedNote?.title || 'My Template';
    newTemplateIcon = '';
  }

  function saveNewTemplate() {
    if (!notesStore.selectedNoteId || !newTemplateName.trim()) return;
    notesStore.saveNoteAsTemplate(
      notesStore.selectedNoteId,
      newTemplateName.trim(),
      newTemplateIcon || ''
    );
    showCreateForm = false;
    newTemplateName = '';
    newTemplateIcon = '';
  }

  function cancelCreate() {
    showCreateForm = false;
    newTemplateName = '';
    newTemplateIcon = '';
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showCreateForm) {
        cancelCreate();
      } else {
        onclose();
      }
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="template-title"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2 id="template-title">
          {showCreateForm ? 'Save as Template' : 'New from Template'}
        </h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          x
        </button>
      </header>

      <div class="modal-body">
        {#if showCreateForm}
          <div class="create-form">
            <div class="form-group">
              <label for="template-name">Template Name</label>
              <input
                id="template-name"
                type="text"
                bind:value={newTemplateName}
                placeholder="My Template"
              />
            </div>
            <div class="form-group">
              <label>Icon</label>
              <div class="icon-grid">
                {#each templateIcons as icon}
                  <button
                    class="icon-btn"
                    class:selected={newTemplateIcon === icon}
                    onclick={() => newTemplateIcon = icon}
                    type="button"
                  >
                    {icon}
                  </button>
                {/each}
              </div>
            </div>
            <div class="form-actions">
              <button class="btn secondary" onclick={cancelCreate}>Cancel</button>
              <button class="btn primary" onclick={saveNewTemplate} disabled={!newTemplateName.trim()}>
                Save Template
              </button>
            </div>
          </div>
        {:else}
          {#if templates().custom.length > 0}
            <div class="template-section">
              <h3>My Templates</h3>
              <div class="templates-grid">
                {#each templates().custom as template (template.id)}
                  <div class="template-card-wrapper">
                    <button
                      class="delete-template"
                      onclick={(e) => handleDeleteCustom(template.id, e)}
                      title="Delete template"
                    >
                      x
                    </button>
                    <button
                      class="template-card"
                      onclick={() => handleSelect(template.id)}
                    >
                      <span class="template-icon">{template.icon}</span>
                      <span class="template-name">{template.name}</span>
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="template-section">
            <h3>Built-in Templates</h3>
            <div class="templates-grid">
              {#each templates().builtin as template (template.id)}
                <button
                  class="template-card"
                  onclick={() => handleSelect(template.id)}
                >
                  <span class="template-icon">{template.icon}</span>
                  <span class="template-name">{template.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <footer class="modal-footer">
        {#if !showCreateForm && notesStore.selectedNote}
          <button class="save-template-btn" onclick={handleSaveAsTemplate}>
            + Save current note as template
          </button>
        {:else if !showCreateForm}
          <span class="tip">Select a template to create a new note</span>
        {/if}
      </footer>
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
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .template-section {
    margin-bottom: 24px;
  }

  .template-section:last-child {
    margin-bottom: 0;
  }

  .template-section h3 {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    margin: 0 0 12px 0;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .template-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .template-card:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .delete-template {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .template-card-wrapper:hover .delete-template {
    opacity: 1;
  }

  .template-card-wrapper {
    position: relative;
  }

  .delete-template:hover {
    background: #ef4444;
    color: white;
  }

  .template-icon {
    font-size: 24px;
  }

  .template-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    text-align: center;
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

  .save-template-btn {
    padding: 8px 16px;
    border: 1px dashed var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .save-template-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
    background: var(--bg-hover);
  }

  /* Create form styles */
  .create-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input {
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .icon-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .icon-btn.selected {
    border-color: var(--accent-color);
    background: var(--accent-color);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn.secondary {
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-secondary);
  }

  .btn.secondary:hover {
    background: var(--bg-hover);
  }

  .btn.primary {
    border: none;
    background: var(--accent-color);
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal {
      max-width: 100%;
      max-height: 100%;
      height: 100%;
      border-radius: 0;
    }

    .templates-grid {
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 8px;
    }

    .template-card {
      padding: 12px 8px;
    }

    .template-icon {
      font-size: 20px;
    }

    .template-name {
      font-size: 11px;
    }

    .form-group input {
      font-size: 16px; /* Prevent iOS zoom */
    }

    .modal-footer {
      padding: 12px 16px;
    }
  }
</style>
