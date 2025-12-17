<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import { fly, fade } from 'svelte/transition';
  import { X, Minus, Zap } from '@lucide/svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();

  let content = $state('');
  let title = $state('');
  let selectedNotebook = $state<string | null>(null);
  let addToExisting = $state(false);
  let targetNoteId = $state<string | null>(null);
  let isMinimized = $state(false);
  let isSaving = $state(false);
  let inputRef: HTMLTextAreaElement;

  // Load draft from localStorage
  $effect(() => {
    if (open && typeof localStorage !== 'undefined') {
      const draft = localStorage.getItem('viny-quick-capture-draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          content = parsed.content || '';
          title = parsed.title || '';
        } catch {
          // Ignore parse errors
        }
      }
      // Focus input when opened
      setTimeout(() => inputRef?.focus(), 100);
    }
  });

  // Save draft to localStorage
  $effect(() => {
    if (typeof localStorage !== 'undefined' && (content || title)) {
      localStorage.setItem('viny-quick-capture-draft', JSON.stringify({ content, title }));
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (content.trim() || title.trim()) {
        isMinimized = true;
      } else {
        close();
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  }

  async function save() {
    if (!content.trim() && !title.trim()) {
      toast.error('Cannot save empty note');
      return;
    }

    if (isSaving) return;
    isSaving = true;

    try {
      if (addToExisting && targetNoteId) {
        // Append to existing note
        const targetNote = notesStore.allNotes.find(n => n.id === targetNoteId);
        if (targetNote) {
          const separator = targetNote.content ? '\n\n---\n\n' : '';
          const newContent = targetNote.content + separator + (title ? `## ${title}\n\n` : '') + content;
          await notesStore.updateNote(targetNoteId, { content: newContent });
          toast.success('Added to note');
        }
      } else {
        // Create new note
        await notesStore.createNote({
          title: title || `Quick Note - ${new Date().toLocaleString()}`,
          content: content,
        });
        toast.success('Quick note saved');
      }

      // Clear draft
      localStorage.removeItem('viny-quick-capture-draft');
      content = '';
      title = '';
      close();
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      isSaving = false;
    }
  }

  function discard() {
    localStorage.removeItem('viny-quick-capture-draft');
    content = '';
    title = '';
    close();
  }

  function close() {
    open = false;
    isMinimized = false;
    addToExisting = false;
    targetNoteId = null;
  }

  function maximize() {
    isMinimized = false;
    setTimeout(() => inputRef?.focus(), 100);
  }
</script>

<svelte:window on:keydown={(e) => {
  // Global shortcut to open quick capture (Cmd/Ctrl + Shift + C)
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c' && !open) {
    e.preventDefault();
    open = true;
  }
}} />

{#if open}
  {#if isMinimized}
    <!-- Minimized indicator -->
    <button
      class="minimized-indicator"
      onclick={maximize}
      transition:fly={{ y: 50, duration: 200 }}
    >
      <span class="indicator-icon">Draft</span>
      <span class="indicator-text">Draft</span>
      <span class="indicator-preview">{content.slice(0, 30)}{content.length > 30 ? '...' : ''}</span>
    </button>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <!-- Backdrop -->
    <div
      class="backdrop"
      onclick={() => isMinimized = true}
      transition:fade={{ duration: 150 }}
    ></div>

    <!-- Quick Capture Modal -->
    <div
      class="quick-capture"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-capture-title"
      tabindex="-1"
      transition:fly={{ y: -20, duration: 200 }}
    >
      <div class="header">
        <h3 id="quick-capture-title">
          <span class="header-icon"><Zap size={16} /></span>
          Quick Capture
        </h3>
        <div class="header-actions">
          <button class="header-btn" onclick={() => isMinimized = true} title="Minimize (Esc)" aria-label="Minimize">
            <Minus size={14} />
          </button>
          <button class="header-btn close" onclick={discard} title="Discard" aria-label="Discard">
            <X size={14} />
          </button>
        </div>
      </div>

      <div class="content">
        <input
          type="text"
          class="title-input"
          placeholder="Title (optional)"
          bind:value={title}
          onkeydown={handleKeydown}
        />

        <textarea
          bind:this={inputRef}
          class="content-input"
          placeholder="Capture your thought... (Markdown supported)"
          bind:value={content}
          onkeydown={handleKeydown}
          rows="6"
        ></textarea>

        <!-- Options -->
        <div class="options">
          <label class="option-toggle">
            <input type="checkbox" bind:checked={addToExisting} />
            <span class="toggle-label">Add to existing note</span>
          </label>

          {#if addToExisting}
            <select class="note-select" bind:value={targetNoteId}>
              <option value={null}>Select a note...</option>
              {#each notesStore.allNotes.slice(0, 20) as note}
                <option value={note.id}>{note.title || 'Untitled'}</option>
              {/each}
            </select>
          {/if}
        </div>

        <!-- Character count -->
        <div class="stats">
          <span class="char-count">{content.length} characters</span>
          <span class="word-count">{content.trim() ? content.trim().split(/\s+/).length : 0} words</span>
        </div>
      </div>

      <div class="footer">
        <div class="footer-hint">
          <kbd>⌘</kbd>+<kbd>↵</kbd> to save
          <span class="hint-divider">•</span>
          <kbd>Esc</kbd> to minimize
        </div>
        <div class="footer-actions">
          <button class="btn-secondary" onclick={discard}>
            Discard
          </button>
          <button
            class="btn-primary"
            onclick={save}
            disabled={isSaving || (!content.trim() && !title.trim())}
          >
            {#if isSaving}
              Saving...
            {:else}
              {addToExisting && targetNoteId ? 'Append' : 'Save Note'}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    z-index: 9998;
  }

  .quick-capture {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 520px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-icon {
    font-size: 16px;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .header-btn.close:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .title-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .title-input:focus {
    border-color: var(--accent);
  }

  .title-input::placeholder {
    color: var(--text-tertiary);
  }

  .content-input {
    width: 100%;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-primary);
    outline: none;
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.15s ease;
  }

  .content-input:focus {
    border-color: var(--accent);
  }

  .content-input::placeholder {
    color: var(--text-tertiary);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .option-toggle input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .toggle-label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .note-select {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
  }

  .note-select:focus {
    border-color: var(--accent);
  }

  .stats {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
  }

  .footer-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .footer-hint kbd {
    padding: 2px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
  }

  .hint-divider {
    margin: 0 6px;
    opacity: 0.5;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .btn-secondary {
    padding: 8px 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn-primary {
    padding: 8px 14px;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Minimized indicator */
  .minimized-indicator {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--accent);
    border: none;
    border-radius: 24px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    z-index: 9999;
    transition: all 0.2s ease;
  }

  .minimized-indicator:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  .indicator-icon {
    font-size: 14px;
  }

  .indicator-text {
    font-size: 13px;
    font-weight: 600;
    color: white;
  }

  .indicator-preview {
    max-width: 150px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .quick-capture {
      width: 95%;
      max-height: 80vh;
    }

    .footer {
      flex-direction: column;
      gap: 12px;
    }

    .footer-actions {
      width: 100%;
    }

    .btn-secondary,
    .btn-primary {
      flex: 1;
    }
  }
</style>
