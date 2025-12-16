<script lang="ts">
  import { notesStore, type NoteVersion } from '$lib/stores';
  import { toast } from '$lib/toast';
  import { X, ArrowLeft, Clock } from '@lucide/svelte';

  let { open = $bindable(false), noteId = '' } = $props();

  let versions = $derived(noteId ? notesStore.getNoteVersions(noteId) : []);
  let selectedVersion = $state<NoteVersion | null>(null);
  let showDiff = $state(false);

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getWordCount(content: string): number {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }

  function getPreview(content: string, maxLength = 100): string {
    const stripped = content.replace(/[#*`\[\]]/g, '').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.slice(0, maxLength) + '...';
  }

  async function restoreVersion(version: Version) {
    const note = notesStore.selectedNote;
    if (!note) return;

    // Save current version before restoring
    notesStore.saveNoteVersion(note, true);

    await notesStore.updateNote(note.id, {
      title: version.title,
      content: version.content,
    });

    toast.success('Version restored');
    selectedVersion = null;
  }

  async function copyVersion(version: Version) {
    const text = `# ${version.title}\n\n${version.content}`;
    await navigator.clipboard.writeText(text);
    toast.success('Version copied to clipboard');
  }

  function close() {
    open = false;
    selectedVersion = null;
    showDiff = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Version History</h2>
        <button class="close-btn" onclick={close} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-content">
        {#if versions.length === 0}
          <div class="empty-state">
            <div class="empty-icon"><Clock size={48} /></div>
            <h3>No versions yet</h3>
            <p>Version snapshots are automatically saved as you edit.</p>
          </div>
        {:else if selectedVersion}
          <div class="version-detail">
            <div class="version-detail-header">
              <button class="back-btn" onclick={() => selectedVersion = null}>
                <ArrowLeft size={14} /> Back
              </button>
              <div class="version-info">
                <span class="version-time">{formatTimestamp(selectedVersion.timestamp)}</span>
                <span class="version-words">{getWordCount(selectedVersion.content)} words</span>
              </div>
            </div>

            <div class="version-preview">
              <div class="preview-title">{selectedVersion.title || 'Untitled'}</div>
              <div class="preview-content">{selectedVersion.content}</div>
            </div>

            <div class="version-actions">
              <button class="action-btn secondary" onclick={() => copyVersion(selectedVersion!)}>
                Copy
              </button>
              <button class="action-btn primary" onclick={() => restoreVersion(selectedVersion!)}>
                Restore this version
              </button>
            </div>
          </div>
        {:else}
          <div class="version-list">
            {#each versions as version (version.id)}
              <button
                class="version-item"
                onclick={() => selectedVersion = version}
              >
                <div class="version-header">
                  <span class="version-timestamp">{formatTimestamp(version.timestamp)}</span>
                  <span class="version-words">{getWordCount(version.content)} words</span>
                </div>
                <div class="version-title">{version.title || 'Untitled'}</div>
                <div class="version-excerpt">{getPreview(version.content)}</div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <span class="footer-info">
          {versions.length} version{versions.length !== 1 ? 's' : ''} saved
        </span>
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
    max-width: 600px;
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

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-tertiary);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--text-secondary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  .version-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .version-item {
    width: 100%;
    padding: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .version-item:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .version-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .version-timestamp {
    font-size: 12px;
    color: var(--accent);
    font-weight: 500;
  }

  .version-words {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .version-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .version-excerpt {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Version Detail View */
  .version-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .version-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .back-btn {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .version-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
  }

  .version-time {
    color: var(--accent);
    font-weight: 500;
  }

  .version-preview {
    flex: 1;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    overflow-y: auto;
    max-height: 400px;
  }

  .preview-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .preview-content {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: var(--font-mono);
  }

  .version-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .action-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn.secondary {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .action-btn.secondary:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .action-btn.primary {
    background: var(--accent);
    border: none;
    color: white;
  }

  .action-btn.primary:hover {
    opacity: 0.9;
  }

  .modal-footer {
    padding: 12px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
  }

  .footer-info {
    font-size: 12px;
    color: var(--text-tertiary);
  }
</style>
