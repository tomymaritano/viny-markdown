<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  const stats = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return null;
    return notesStore.getNoteStats(note.id);
  });

  const note = $derived(notesStore.selectedNote);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatNumber(n: number): string {
    return n.toLocaleString();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    }
  }
</script>

{#if open && note && stats()}
  {@const noteStats = stats()!}
  <div
    class="panel-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="info-title"
    tabindex="-1"
  >
    <aside class="info-panel">
      <header class="panel-header">
        <h2 id="info-title">Note Info</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          x
        </button>
      </header>

      <div class="panel-body">
        <section class="info-section">
          <h3>Statistics</h3>
          <dl class="stats-grid">
            <div class="stat-item">
              <dt>Words</dt>
              <dd>{formatNumber(noteStats.wordCount)}</dd>
            </div>
            <div class="stat-item">
              <dt>Characters</dt>
              <dd>{formatNumber(noteStats.characterCount)}</dd>
            </div>
            <div class="stat-item">
              <dt>Characters (no spaces)</dt>
              <dd>{formatNumber(noteStats.characterCountNoSpaces)}</dd>
            </div>
            <div class="stat-item">
              <dt>Lines</dt>
              <dd>{formatNumber(noteStats.lineCount)}</dd>
            </div>
            <div class="stat-item">
              <dt>Paragraphs</dt>
              <dd>{formatNumber(noteStats.paragraphCount)}</dd>
            </div>
            <div class="stat-item">
              <dt>Reading time</dt>
              <dd>{noteStats.readingTime}</dd>
            </div>
          </dl>
        </section>

        <section class="info-section">
          <h3>Links</h3>
          <dl class="stats-grid">
            <div class="stat-item">
              <dt>Outgoing links</dt>
              <dd>{formatNumber(noteStats.linkCount)}</dd>
            </div>
            <div class="stat-item">
              <dt>Backlinks</dt>
              <dd>{formatNumber(noteStats.backlinkCount)}</dd>
            </div>
          </dl>
        </section>

        <section class="info-section">
          <h3>Dates</h3>
          <dl class="dates-list">
            <div class="date-item">
              <dt>Created</dt>
              <dd>{formatDate(noteStats.createdAt)}</dd>
            </div>
            <div class="date-item">
              <dt>Modified</dt>
              <dd>{formatDate(noteStats.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        {#if note.notebookId}
          <section class="info-section">
            <h3>Location</h3>
            <p class="location-info">Notebook ID: {note.notebookId}</p>
          </section>
        {/if}

        {#if note.tags && note.tags.length > 0}
          <section class="info-section">
            <h3>Tags</h3>
            <div class="tags-list">
              {#each note.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </aside>
  </div>
{/if}

<style>
  .panel-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: flex-end;
    z-index: 1000;
  }

  .info-panel {
    width: 320px;
    height: 100%;
    background: var(--bg-primary);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h2 {
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

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .info-section {
    margin-bottom: 24px;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .info-section h3 {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 0;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-item dt {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .stat-item dd {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .dates-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .date-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .date-item dt {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .date-item dd {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .location-info {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-secondary);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .panel-backdrop {
      justify-content: center;
      align-items: flex-end;
    }

    .info-panel {
      width: 100%;
      height: 80%;
      border-radius: 16px 16px 0 0;
      animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
