<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let selectedIndex = $state(0);

  // Get all templates
  const templates = $derived(notesStore.getTemplates());

  // Reset selection when opened
  $effect(() => {
    if (open) {
      selectedIndex = 0;
    }
  });

  async function handleSelectTemplate(templateId: string) {
    await notesStore.createNoteFromTemplate(templateId);
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, templates.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (templates[selectedIndex]) {
          handleSelectTemplate(templates[selectedIndex].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }

  // Template descriptions
  function getTemplateDescription(id: string): string {
    const descriptions: Record<string, string> = {
      meeting: 'Structured format for meeting notes with attendees, agenda, and action items',
      daily: 'Daily journal template with goals, notes, and reflection sections',
      project: 'Project planning template with timeline, tasks, and resources',
      brainstorm: 'Capture ideas, questions, and connections for brainstorming sessions',
      review: 'Weekly review template for wins, challenges, and planning ahead',
    };
    return descriptions[id] || 'Custom template';
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="overlay" onclick={onClose} role="presentation">
    <div class="picker" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="picker-header">
        <h2 class="picker-title">Create from Template</h2>
        <button class="close-btn" onclick={onClose}><X size={18} /></button>
      </div>

      <div class="templates-grid">
        {#each templates as template, i (template.id)}
          <button
            class="template-card"
            class:selected={i === selectedIndex}
            onclick={() => handleSelectTemplate(template.id)}
            onmouseenter={() => selectedIndex = i}
          >
            <span class="template-icon">{template.icon}</span>
            <div class="template-info">
              <span class="template-name">{template.name}</span>
              <span class="template-desc">{getTemplateDescription(template.id)}</span>
            </div>
          </button>
        {/each}
      </div>

      <div class="picker-footer">
        <span class="hint"><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
        <span class="hint"><kbd>↵</kbd> to select</span>
        <span class="hint"><kbd>esc</kbd> to close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(2px);
    padding: 24px;
  }

  .picker {
    width: 100%;
    max-width: 600px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .picker-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .templates-grid {
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }

  .template-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .template-card:hover {
    background: var(--bg-hover);
  }

  .template-card.selected {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .template-icon {
    font-size: 28px;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: 8px;
  }

  .template-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .template-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .template-desc {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .picker-footer {
    display: flex;
    gap: 16px;
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .hint kbd {
    padding: 2px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-size: 10px;
    font-family: inherit;
  }

  @media (max-width: 600px) {
    .templates-grid {
      grid-template-columns: 1fr;
    }

    .overlay {
      padding: 16px;
    }
  }
</style>
