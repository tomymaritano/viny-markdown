<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  interface HeadingItem {
    level: number;
    text: string;
    line: number;
  }

  // Extract headings from current note content
  const headings = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return [];

    const lines = note.content.split('\n');
    const items: HeadingItem[] = [];

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        items.push({
          level: match[1].length,
          text: match[2].trim(),
          line: index,
        });
      }
    });

    return items;
  });

  // Get note title
  const noteTitle = $derived(() => {
    return notesStore.selectedNote?.title || 'Untitled';
  });

  // Calculate word count
  const wordCount = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return 0;
    return note.content.trim().split(/\s+/).filter(Boolean).length;
  });

  // Calculate reading time (average 200 words per minute)
  const readingTime = $derived(() => {
    const words = wordCount();
    const minutes = Math.ceil(words / 200);
    return minutes;
  });

  function scrollToHeading(line: number) {
    // Dispatch a custom event that NoteEditor can listen to
    const event = new CustomEvent('scroll-to-line', { detail: { line } });
    window.dispatchEvent(event);
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  function getLevelIndent(level: number): string {
    return `${(level - 1) * 16}px`;
  }

  function getLevelIcon(level: number): string {
    switch (level) {
      case 1: return 'H1';
      case 2: return 'H2';
      case 3: return 'H3';
      case 4: return 'H4';
      case 5: return 'H5';
      case 6: return 'H6';
      default: return 'H';
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
        <h2>Note Outline</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        {#if !notesStore.selectedNote}
          <div class="empty-state">
            <p>No note selected</p>
            <span class="hint">Select a note to view its outline</span>
          </div>
        {:else}
          <!-- Note Info -->
          <div class="note-info">
            <h3 class="note-title">{noteTitle()}</h3>
            <div class="note-stats">
              <span class="stat">{wordCount()} words</span>
              <span class="stat-divider">•</span>
              <span class="stat">{readingTime()} min read</span>
            </div>
          </div>

          <!-- Outline -->
          {#if headings().length === 0}
            <div class="empty-state">
              <p>No headings found</p>
              <span class="hint">Add headings using # syntax to create an outline</span>
              <div class="hint-examples">
                <code># Heading 1</code>
                <code>## Heading 2</code>
                <code>### Heading 3</code>
              </div>
            </div>
          {:else}
            <nav class="outline-nav" aria-label="Document outline">
              <ul class="outline-list">
                {#each headings() as heading, index (index)}
                  <li>
                    <button
                      class="outline-item"
                      style="padding-left: calc(12px + {getLevelIndent(heading.level)})"
                      onclick={() => scrollToHeading(heading.line)}
                    >
                      <span class="level-badge level-{heading.level}">{getLevelIcon(heading.level)}</span>
                      <span class="heading-text">{heading.text}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            </nav>
          {/if}
        {/if}
      </div>

      <footer class="modal-footer">
        <span class="tip">Click a heading to jump to it</span>
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
    max-width: 400px;
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

  .note-info {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .note-title {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .stat-divider {
    opacity: 0.5;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .empty-state .hint {
    font-size: 13px;
    display: block;
    margin-bottom: 16px;
  }

  .hint-examples {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  .hint-examples code {
    font-size: 12px;
    padding: 4px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: 'SF Mono', Consolas, monospace;
    color: var(--text-secondary);
  }

  .outline-nav {
    margin: 0 -20px;
  }

  .outline-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .outline-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
    color: var(--text-primary);
  }

  .outline-item:hover {
    background: var(--bg-hover);
  }

  .level-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .level-badge.level-1 {
    background: rgba(74, 158, 255, 0.2);
    color: var(--accent-color);
  }

  .level-badge.level-2 {
    background: rgba(74, 158, 255, 0.15);
    color: var(--accent-color);
  }

  .level-badge.level-3 {
    background: rgba(74, 158, 255, 0.1);
    color: var(--accent-color);
  }

  .heading-text {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  @media (max-width: 450px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .outline-item {
      padding: 12px 16px;
    }
  }
</style>
