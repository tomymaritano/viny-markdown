<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { History, X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Get current note
  const currentNote = $derived(() => notesStore.selectedNote);

  // Get versions for current note
  const versions = $derived(() => {
    const note = currentNote();
    if (!note) return [];
    return notesStore.getNoteVersions(note.id);
  });

  // Selected version for preview
  let selectedVersionId = $state<string | null>(null);

  // Get selected version
  const selectedVersion = $derived(() => {
    if (!selectedVersionId) return null;
    return versions().find(v => v.id === selectedVersionId) || null;
  });

  // Reset selection when modal opens
  $effect(() => {
    if (open) {
      selectedVersionId = null;
    }
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatFullDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function restoreVersion(versionId: string) {
    const note = currentNote();
    if (!note) return;

    const confirmed = window.confirm(
      'Restore this version? Your current content will be saved as a new version first.'
    );

    if (confirmed) {
      await notesStore.restoreNoteVersion(note.id, versionId);
      selectedVersionId = null;
      onClose();
    }
  }

  function selectVersion(versionId: string) {
    selectedVersionId = selectedVersionId === versionId ? null : versionId;
  }

  function getPreviewText(content: string, maxLength: number = 100): string {
    const text = content.replace(/[#*_`\[\]]/g, '').trim();
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (selectedVersionId) {
        selectedVersionId = null;
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
    <div class="modal" class:with-preview={selectedVersionId}>
      <header class="modal-header">
        <h2>Version History</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        {#if !currentNote()}
          <div class="empty-state">
            <p>No note selected</p>
            <span class="hint">Select a note to view its version history</span>
          </div>
        {:else if versions().length === 0}
          <div class="empty-state">
            <div class="empty-icon"><History size={40} /></div>
            <p>No version history yet</p>
            <span class="hint">Versions are saved automatically as you edit</span>
          </div>
        {:else}
          <div class="content-wrapper">
            <!-- Version List -->
            <div class="version-list">
              <div class="note-info">
                <span class="note-label">History for</span>
                <h3 class="note-title">{currentNote()?.title || 'Untitled'}</h3>
              </div>

              <div class="versions-count">
                {versions().length} version{versions().length === 1 ? '' : 's'}
              </div>

              <ul class="versions">
                {#each versions() as version, index (version.id)}
                  <li>
                    <button
                      class="version-item"
                      class:selected={selectedVersionId === version.id}
                      onclick={() => selectVersion(version.id)}
                    >
                      <div class="version-header">
                        <span class="version-number">v{versions().length - index}</span>
                        <span class="version-time">{formatDate(version.createdAt)}</span>
                      </div>

                      <div class="version-title">{version.title || 'Untitled'}</div>

                      <div class="version-meta">
                        <span class="word-count">{version.wordCount} words</span>
                      </div>

                      <p class="version-preview-text">{getPreviewText(version.content)}</p>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>

            <!-- Version Preview -->
            {#if selectedVersion()}
              <div class="version-preview-panel">
                <div class="preview-header">
                  <div class="preview-info">
                    <h4>Version Preview</h4>
                    <span class="preview-date">{formatFullDate(selectedVersion()!.createdAt)}</span>
                  </div>
                  <button
                    class="restore-btn"
                    onclick={() => restoreVersion(selectedVersion()!.id)}
                  >
                    Restore
                  </button>
                </div>

                <div class="preview-content">
                  <div class="preview-title">{selectedVersion()!.title || 'Untitled'}</div>
                  <div class="preview-body">{selectedVersion()!.content}</div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <footer class="modal-footer">
        <span class="tip">
          {#if selectedVersionId}
            Press <kbd>Escape</kbd> to deselect
          {:else}
            Click a version to preview
          {/if}
        </span>
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
    transition: max-width 0.2s ease;
  }

  .modal.with-preview {
    max-width: 800px;
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
    flex: 1;
    overflow: hidden;
  }

  .content-wrapper {
    display: flex;
    height: 100%;
    max-height: calc(80vh - 120px);
  }

  .version-list {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-color);
    overflow: hidden;
  }

  .modal:not(.with-preview) .version-list {
    flex: 1;
    border-right: none;
  }

  .note-info {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .note-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .note-title {
    margin: 4px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .versions-count {
    padding: 8px 16px;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color);
  }

  .versions {
    list-style: none;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    flex: 1;
  }

  .version-item {
    width: 100%;
    display: block;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    text-align: left;
    cursor: pointer;
    margin-bottom: 6px;
    transition: all 0.15s;
  }

  .version-item:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .version-item.selected {
    border-color: var(--accent-color);
    background: rgba(74, 158, 255, 0.1);
  }

  .version-item:last-child {
    margin-bottom: 0;
  }

  .version-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .version-number {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 5px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .version-time {
    font-size: 10px;
    color: var(--text-muted);
  }

  .version-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .version-meta {
    margin-bottom: 4px;
  }

  .word-count {
    font-size: 10px;
    color: var(--text-muted);
  }

  .version-preview-text {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .version-preview-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    gap: 12px;
  }

  .preview-info h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .preview-date {
    font-size: 11px;
    color: var(--text-muted);
  }

  .restore-btn {
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

  .restore-btn:hover {
    opacity: 0.9;
  }

  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .preview-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .preview-body {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: inherit;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .empty-state p {
    margin: 0 0 6px;
    font-size: 15px;
    color: var(--text-secondary);
  }

  .empty-state .hint {
    font-size: 12px;
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

  .tip kbd {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .modal.with-preview {
      max-width: 100%;
    }

    .content-wrapper {
      flex-direction: column;
      max-height: calc(100vh - 120px);
    }

    .version-list {
      flex: 0 0 auto;
      max-height: 35vh;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
    }

    .modal:not(.with-preview) .version-list {
      max-height: none;
    }

    .version-preview-panel {
      flex: 1;
      min-height: 200px;
    }
  }
</style>
