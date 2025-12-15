<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';

  let {
    open = $bindable(false)
  } = $props<{
    open?: boolean;
  }>();

  interface Template {
    id: string;
    name: string;
    icon: string;
    description: string;
    title: string;
    content: string;
    isCustom?: boolean;
  }

  // Load custom templates from localStorage
  function loadCustomTemplates(): Template[] {
    try {
      const stored = localStorage.getItem('viny-custom-templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  function saveCustomTemplates(templates: Template[]): void {
    localStorage.setItem('viny-custom-templates', JSON.stringify(templates));
  }

  let customTemplates = $state<Template[]>(loadCustomTemplates());
  let showCreateForm = $state(false);
  let editingTemplate = $state<Template | null>(null);
  let newTemplateIcon = $state('📝');
  let newTemplateName = $state('');
  let newTemplateDescription = $state('');
  let newTemplateTitle = $state('');
  let newTemplateContent = $state('');

  const emojiOptions = ['📝', '📋', '📌', '💼', '🎯', '💡', '🔖', '📚', '🗂️', '⭐', '🏷️', '📊', '🎨', '🔬', '📐', '💻'];

  const builtInTemplates: Template[] = [
    {
      id: 'blank',
      name: 'Blank Note',
      icon: '📄',
      description: 'Start with an empty note',
      title: '',
      content: ''
    },
    {
      id: 'meeting',
      name: 'Meeting Notes',
      icon: '📅',
      description: 'Capture meeting outcomes and action items',
      title: 'Meeting Notes - ',
      content: `## Meeting Details
**Date:** ${new Date().toLocaleDateString()}
**Attendees:**

## Agenda
-

## Discussion Points


## Action Items
- [ ]

## Next Steps

`
    },
    {
      id: 'todo',
      name: 'To-Do List',
      icon: '✅',
      description: 'Simple task list template',
      title: 'Tasks - ',
      content: `## Priority Tasks
- [ ]

## In Progress
- [ ]

## Completed
- [x]

## Notes

`
    },
    {
      id: 'journal',
      name: 'Daily Journal',
      icon: '📔',
      description: 'Reflect on your day',
      title: `Journal - ${new Date().toLocaleDateString()}`,
      content: `## Today's Date
${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

## Morning Intentions
What do I want to accomplish today?


## Gratitude
Three things I'm grateful for:
1.
2.
3.

## Reflection
How was my day?


## Tomorrow
What's one thing I want to do tomorrow?

`
    },
    {
      id: 'project',
      name: 'Project Plan',
      icon: '🚀',
      description: 'Plan and track a project',
      title: 'Project: ',
      content: `## Project Overview
**Project Name:**
**Start Date:** ${new Date().toLocaleDateString()}
**Target Completion:**

## Goals
1.

## Milestones
- [ ] Phase 1:
- [ ] Phase 2:
- [ ] Phase 3:

## Resources Needed


## Risks & Challenges


## Progress Log

`
    },
    {
      id: 'brainstorm',
      name: 'Brainstorm',
      icon: '💡',
      description: 'Capture ideas freely',
      title: 'Brainstorm: ',
      content: `## Topic


## Ideas
-

## Connections


## Questions to Explore


## Next Actions

`
    },
    {
      id: 'weekly',
      name: 'Weekly Review',
      icon: '📊',
      description: 'Review your week and plan ahead',
      title: `Week of ${new Date().toLocaleDateString()}`,
      content: `## This Week's Wins
1.
2.
3.

## Challenges
What didn't go well?


## Lessons Learned


## Next Week's Focus
Top 3 priorities:
1.
2.
3.

## Notes

`
    },
    {
      id: 'recipe',
      name: 'Recipe',
      icon: '🍳',
      description: 'Save your favorite recipes',
      title: 'Recipe: ',
      content: `## Recipe Name


## Details
**Prep Time:**
**Cook Time:**
**Servings:**

## Ingredients
-

## Instructions
1.

## Notes


## Rating: ⭐️⭐️⭐️⭐️⭐️
`
    }
  ];

  // Combined templates (built-in + custom)
  const allTemplates = $derived([...builtInTemplates, ...customTemplates]);

  async function selectTemplate(template: Template) {
    try {
      const note = await notesStore.createNote({
        title: template.title,
        content: template.content
      });
      notesStore.selectNote(note.id);
      toast.success(`Created from "${template.name}" template`);
      open = false;
    } catch (err) {
      toast.error('Failed to create note');
    }
  }

  function openCreateForm() {
    showCreateForm = true;
    editingTemplate = null;
    newTemplateIcon = '📝';
    newTemplateName = '';
    newTemplateDescription = '';
    newTemplateTitle = '';
    newTemplateContent = '';
  }

  function openEditForm(template: Template) {
    showCreateForm = true;
    editingTemplate = template;
    newTemplateIcon = template.icon;
    newTemplateName = template.name;
    newTemplateDescription = template.description;
    newTemplateTitle = template.title;
    newTemplateContent = template.content;
  }

  function saveTemplate() {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    if (editingTemplate) {
      // Update existing template
      customTemplates = customTemplates.map(t =>
        t.id === editingTemplate!.id
          ? {
              ...t,
              icon: newTemplateIcon,
              name: newTemplateName,
              description: newTemplateDescription,
              title: newTemplateTitle,
              content: newTemplateContent,
            }
          : t
      );
      toast.success('Template updated');
    } else {
      // Create new template
      const newTemplate: Template = {
        id: `custom-${Date.now()}`,
        icon: newTemplateIcon,
        name: newTemplateName,
        description: newTemplateDescription || 'Custom template',
        title: newTemplateTitle,
        content: newTemplateContent,
        isCustom: true,
      };
      customTemplates = [...customTemplates, newTemplate];
      toast.success('Template created');
    }

    saveCustomTemplates(customTemplates);
    showCreateForm = false;
    editingTemplate = null;
  }

  function deleteTemplate(templateId: string) {
    customTemplates = customTemplates.filter(t => t.id !== templateId);
    saveCustomTemplates(customTemplates);
    toast.success('Template deleted');
  }

  function saveCurrentNoteAsTemplate() {
    const note = notesStore.selectedNote;
    if (!note) return;

    newTemplateIcon = '📝';
    newTemplateName = note.title ? `${note.title} Template` : 'Custom Template';
    newTemplateDescription = 'Saved from current note';
    newTemplateTitle = note.title || '';
    newTemplateContent = note.content || '';
    showCreateForm = true;
    editingTemplate = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showCreateForm) {
        showCreateForm = false;
      } else {
        open = false;
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="templates-title"
    tabindex="-1"
    onclick={() => open = false}
    onkeydown={handleKeydown}
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()}>
      {#if showCreateForm}
        <!-- Create/Edit Template Form -->
        <div class="modal-header">
          <h2 id="templates-title">{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>
          <button class="close-btn" onclick={() => showCreateForm = false} aria-label="Back">&larr;</button>
        </div>

        <div class="template-form">
          <div class="form-row">
            <label class="form-label">Icon</label>
            <div class="emoji-picker">
              {#each emojiOptions as emoji}
                <button
                  type="button"
                  class="emoji-option"
                  class:selected={newTemplateIcon === emoji}
                  onclick={() => newTemplateIcon = emoji}
                >
                  {emoji}
                </button>
              {/each}
            </div>
          </div>

          <div class="form-row">
            <label class="form-label" for="template-name">Name *</label>
            <input
              id="template-name"
              type="text"
              class="form-input"
              placeholder="My Template"
              bind:value={newTemplateName}
            />
          </div>

          <div class="form-row">
            <label class="form-label" for="template-desc">Description</label>
            <input
              id="template-desc"
              type="text"
              class="form-input"
              placeholder="What is this template for?"
              bind:value={newTemplateDescription}
            />
          </div>

          <div class="form-row">
            <label class="form-label" for="template-title">Default Title</label>
            <input
              id="template-title"
              type="text"
              class="form-input"
              placeholder="Note title prefix"
              bind:value={newTemplateTitle}
            />
          </div>

          <div class="form-row">
            <label class="form-label" for="template-content">Content</label>
            <textarea
              id="template-content"
              class="form-textarea"
              placeholder="## Heading&#10;&#10;Your template content here..."
              bind:value={newTemplateContent}
              rows="8"
            ></textarea>
          </div>

          <div class="form-actions">
            <button class="btn-secondary" onclick={() => showCreateForm = false}>Cancel</button>
            <button class="btn-primary" onclick={saveTemplate}>
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      {:else}
        <!-- Template List -->
        <div class="modal-header">
          <h2 id="templates-title">Create from Template</h2>
          <div class="header-actions">
            {#if notesStore.selectedNote}
              <button class="header-btn" onclick={saveCurrentNoteAsTemplate} title="Save current note as template">
                + Save Current
              </button>
            {/if}
            <button class="header-btn primary" onclick={openCreateForm}>+ New Template</button>
            <button class="close-btn" onclick={() => open = false} aria-label="Close">✕</button>
          </div>
        </div>

        <div class="templates-grid">
          {#each allTemplates as template (template.id)}
            <div class="template-card-wrapper">
              <button
                class="template-card"
                class:custom={template.isCustom}
                onclick={() => selectTemplate(template)}
              >
                <span class="template-icon">{template.icon}</span>
                <span class="template-name">{template.name}</span>
                <span class="template-description">{template.description}</span>
                {#if template.isCustom}
                  <span class="custom-badge">Custom</span>
                {/if}
              </button>
              {#if template.isCustom}
                <div class="template-actions">
                  <button class="action-btn" onclick={() => openEditForm(template)} title="Edit">✏️</button>
                  <button class="action-btn danger" onclick={() => deleteTemplate(template.id)} title="Delete">🗑️</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
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
    max-width: 640px;
    max-height: 80vh;
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
    color: var(--text-primary);
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

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 24px;
    overflow-y: auto;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .template-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .template-icon {
    font-size: 28px;
    margin-bottom: 12px;
  }

  .template-name {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .template-description {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  @media (max-width: 500px) {
    .templates-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Header actions */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-btn {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .header-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .header-btn.primary:hover {
    opacity: 0.9;
  }

  /* Template card wrapper */
  .template-card-wrapper {
    position: relative;
  }

  .template-card.custom {
    border-color: var(--accent);
    border-style: dashed;
  }

  .custom-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 6px;
    background: var(--accent);
    color: white;
    font-size: 9px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .template-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .template-card-wrapper:hover .template-actions {
    opacity: 1;
  }

  .template-card-wrapper:hover .custom-badge {
    opacity: 0;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .action-btn.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }

  /* Template form */
  .template-form {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    max-height: calc(80vh - 70px);
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-input {
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-primary);
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .form-textarea {
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-family: var(--font-mono);
    color: var(--text-primary);
    resize: vertical;
    min-height: 150px;
    transition: border-color 0.15s ease;
  }

  .form-textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .emoji-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .emoji-option {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .emoji-option:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .emoji-option.selected {
    background: var(--accent);
    border-color: var(--accent);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .btn-secondary {
    padding: 10px 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn-primary {
    padding: 10px 20px;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }
</style>
