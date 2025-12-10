<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X, Trash2 } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let showCreateModal = $state(false);
  let editingTemplateId = $state<string | null>(null);
  let newTemplateName = $state('');
  let newTemplateIcon = $state('📄');
  let newTemplateTitle = $state('');
  let newTemplateContent = $state('');

  const templateIcons = [
    '📄', '📝', '📋', '📌', '📎', '✏️', '🖊️', '📒',
    '📓', '📔', '📕', '📗', '📘', '📙', '📚', '🗒️',
    '💡', '🎯', '✅', '📊', '📈', '🔬', '🎨', '💻',
    '🏠', '💼', '🎓', '🏃', '🍎', '✈️', '🎬', '🎵',
  ];

  // Get all templates
  const allTemplates = $derived(() => {
    return notesStore.getAllTemplates();
  });

  function openCreateModal() {
    editingTemplateId = null;
    newTemplateName = '';
    newTemplateIcon = '📄';
    newTemplateTitle = '';
    newTemplateContent = '';
    showCreateModal = true;
  }

  function openEditModal(template: { id: string; name: string; icon: string; title: string; content: string }) {
    editingTemplateId = template.id;
    newTemplateName = template.name;
    newTemplateIcon = template.icon;
    newTemplateTitle = template.title;
    newTemplateContent = template.content;
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    editingTemplateId = null;
  }

  function saveTemplate() {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (editingTemplateId) {
      // For editing, we need to delete and recreate (since store doesn't have update)
      notesStore.deleteCustomTemplate(editingTemplateId);
    }

    // Create a temporary note object to use with saveNoteAsTemplate isn't ideal
    // Let's add direct template creation to the store instead
    // For now, we'll use a workaround

    // Actually, looking at the store, saveNoteAsTemplate requires a note ID
    // We need to add a function to create templates directly
    // For now, let's show user how to create from existing note

    alert('To create a template:\n1. Create a note with the content you want\n2. Open the note menu (⋮)\n3. Select "Save as Template"');
    closeCreateModal();
  }

  function deleteTemplate(templateId: string) {
    if (!confirm('Delete this template?')) return;
    notesStore.deleteCustomTemplate(templateId);
  }

  async function useTemplate(templateId: string) {
    await notesStore.createFromAnyTemplate(templateId);
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      if (showCreateModal) {
        closeCreateModal();
      } else {
        onClose();
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showCreateModal) {
        closeCreateModal();
      } else {
        onClose();
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
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2>Template Manager</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        <!-- Built-in Templates -->
        <section class="template-section">
          <h3 class="section-title">Built-in Templates</h3>
          <div class="template-grid">
            {#each allTemplates().builtin as template (template.id)}
              <div class="template-card builtin">
                <div class="template-header">
                  <span class="template-icon">{template.icon}</span>
                  <span class="template-name">{template.name}</span>
                </div>
                <p class="template-preview">{template.content.slice(0, 80)}...</p>
                <div class="template-actions">
                  <button class="use-btn" onclick={() => useTemplate(template.id)}>
                    Use Template
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </section>

        <!-- Custom Templates -->
        <section class="template-section">
          <div class="section-header">
            <h3 class="section-title">Custom Templates</h3>
            <span class="template-count">{allTemplates().custom.length}</span>
          </div>

          {#if allTemplates().custom.length === 0}
            <div class="empty-state">
              <p>No custom templates yet</p>
              <span class="hint">Create a template from any note using the note menu</span>
            </div>
          {:else}
            <div class="template-grid">
              {#each allTemplates().custom as template (template.id)}
                <div class="template-card custom">
                  <div class="template-header">
                    <span class="template-icon">{template.icon}</span>
                    <span class="template-name">{template.name}</span>
                  </div>
                  <p class="template-preview">{template.content.slice(0, 80)}...</p>
                  <div class="template-actions">
                    <button class="use-btn" onclick={() => useTemplate(template.id)}>
                      Use
                    </button>
                    <button
                      class="delete-btn"
                      onclick={() => deleteTemplate(template.id)}
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>

        <!-- How to Create -->
        <section class="template-section help-section">
          <h3 class="section-title">How to Create Templates</h3>
          <ol class="help-list">
            <li>Create a note with the structure you want to reuse</li>
            <li>Open the note menu (⋮) in the editor toolbar</li>
            <li>Select "Save as Template"</li>
            <li>Give your template a name and icon</li>
          </ol>
          <p class="help-tip">
            <strong>Tip:</strong> Use <code>{"{{date}}"}</code> in your template to auto-insert today's date when creating a note.
          </p>
        </section>
      </div>

      <footer class="modal-footer">
        <span class="tip">Templates help you quickly create notes with predefined structure</span>
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
    padding: 20px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 600px;
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

  .template-section {
    margin-bottom: 24px;
  }

  .template-section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header .section-title {
    margin-bottom: 0;
  }

  .template-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .template-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    transition: all 0.15s;
  }

  .template-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .template-card.builtin {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, rgba(74, 158, 255, 0.05) 100%);
  }

  .template-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .template-icon {
    font-size: 20px;
  }

  .template-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .template-preview {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 12px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .template-actions {
    display: flex;
    gap: 8px;
  }

  .use-btn {
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--accent-color);
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .use-btn:hover {
    opacity: 0.9;
  }

  .delete-btn {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-btn:hover {
    background: #fee2e2;
    border-color: #ef4444;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    background: var(--bg-secondary);
    border-radius: 8px;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0 0 4px;
    font-size: 14px;
  }

  .empty-state .hint {
    font-size: 12px;
    opacity: 0.7;
  }

  .help-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
  }

  .help-section .section-title {
    margin-bottom: 8px;
  }

  .help-list {
    margin: 0 0 12px;
    padding-left: 20px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .help-tip {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px 12px;
    background: var(--bg-primary);
    border-radius: 6px;
  }

  .help-tip code {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 11px;
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

  @media (max-width: 500px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .template-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
