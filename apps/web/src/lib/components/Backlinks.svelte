<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  interface BacklinkItem {
    noteId: string;
    noteTitle: string;
    context: string;
    linkType: 'wiki' | 'title';
  }

  // Get current note title
  const currentNoteTitle = $derived(() => {
    return notesStore.selectedNote?.title || '';
  });

  // Find all notes that link to the current note
  const backlinks = $derived(() => {
    const currentNote = notesStore.selectedNote;
    if (!currentNote) return [];

    const items: BacklinkItem[] = [];
    const currentTitle = currentNote.title.toLowerCase().trim();
    const currentId = currentNote.id;

    // Search through all active notes
    for (const note of notesStore.allNotes) {
      if (note.status !== 'active' || note.id === currentId) continue;

      const content = note.content;
      const lines = content.split('\n');

      // Check for [[wiki links]] to this note
      const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
      let match;

      while ((match = wikiLinkPattern.exec(content)) !== null) {
        const linkedTitle = match[1].toLowerCase().trim();
        if (linkedTitle === currentTitle || linkedTitle === currentNote.title) {
          // Find the line containing this link for context
          const lineIndex = content.substring(0, match.index).split('\n').length - 1;
          const contextLine = lines[lineIndex] || '';

          items.push({
            noteId: note.id,
            noteTitle: note.title || 'Untitled',
            context: contextLine.trim().substring(0, 100) + (contextLine.length > 100 ? '...' : ''),
            linkType: 'wiki',
          });
          break; // Only add once per note
        }
      }

      // Also check for title mentions (case-insensitive)
      if (currentTitle && currentTitle.length > 2) {
        const titleMentionIndex = content.toLowerCase().indexOf(currentTitle);
        if (titleMentionIndex !== -1) {
          // Check if we already added this note via wiki link
          const alreadyAdded = items.some(item => item.noteId === note.id);
          if (!alreadyAdded) {
            const lineIndex = content.substring(0, titleMentionIndex).split('\n').length - 1;
            const contextLine = lines[lineIndex] || '';

            items.push({
              noteId: note.id,
              noteTitle: note.title || 'Untitled',
              context: contextLine.trim().substring(0, 100) + (contextLine.length > 100 ? '...' : ''),
              linkType: 'title',
            });
          }
        }
      }
    }

    // Sort by note title
    return items.sort((a, b) => a.noteTitle.localeCompare(b.noteTitle));
  });

  // Get outgoing links from current note
  const outgoingLinks = $derived(() => {
    const currentNote = notesStore.selectedNote;
    if (!currentNote) return [];

    const links: { noteId: string; noteTitle: string }[] = [];
    const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkPattern.exec(currentNote.content)) !== null) {
      const linkedTitle = match[1].trim();

      // Find the note with this title
      const linkedNote = notesStore.allNotes.find(
        n => n.status === 'active' && n.title.toLowerCase() === linkedTitle.toLowerCase()
      );

      if (linkedNote && !links.some(l => l.noteId === linkedNote.id)) {
        links.push({
          noteId: linkedNote.id,
          noteTitle: linkedNote.title || 'Untitled',
        });
      }
    }

    return links.sort((a, b) => a.noteTitle.localeCompare(b.noteTitle));
  });

  function openNote(noteId: string) {
    notesStore.selectNote(noteId);
    notesStore.setViewingTrash(false);
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
        <h2>Backlinks</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        {#if !notesStore.selectedNote}
          <div class="empty-state">
            <p>No note selected</p>
            <span class="hint">Select a note to view its backlinks</span>
          </div>
        {:else}
          <!-- Current Note Info -->
          <div class="note-info">
            <span class="note-label">Links to</span>
            <h3 class="note-title">{currentNoteTitle() || 'Untitled'}</h3>
          </div>

          <!-- Backlinks (incoming) -->
          <section class="links-section">
            <div class="section-header">
              <h4 class="section-title">Backlinks</h4>
              <span class="count">{backlinks().length}</span>
            </div>

            {#if backlinks().length === 0}
              <div class="empty-section">
                <p>No notes link to this note</p>
                <span class="hint">Create links using [[Note Title]] syntax</span>
              </div>
            {:else}
              <ul class="links-list">
                {#each backlinks() as link (link.noteId)}
                  <li>
                    <button class="link-item" onclick={() => openNote(link.noteId)}>
                      <div class="link-main">
                        <span class="link-title">{link.noteTitle}</span>
                        <span class="link-type" class:wiki={link.linkType === 'wiki'}>
                          {link.linkType === 'wiki' ? '[[]]' : 'mention'}
                        </span>
                      </div>
                      {#if link.context}
                        <p class="link-context">{link.context}</p>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>

          <!-- Outgoing Links -->
          <section class="links-section">
            <div class="section-header">
              <h4 class="section-title">Outgoing Links</h4>
              <span class="count">{outgoingLinks().length}</span>
            </div>

            {#if outgoingLinks().length === 0}
              <div class="empty-section">
                <p>No outgoing links</p>
                <span class="hint">Link to other notes using [[Note Title]]</span>
              </div>
            {:else}
              <ul class="links-list compact">
                {#each outgoingLinks() as link (link.noteId)}
                  <li>
                    <button class="link-item compact" onclick={() => openNote(link.noteId)}>
                      <span class="link-title">{link.noteTitle}</span>
                      <span class="link-arrow">→</span>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/if}
      </div>

      <footer class="modal-footer">
        <span class="tip">Use [[Note Title]] to create links between notes</span>
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
    max-width: 450px;
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
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .note-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .note-title {
    margin: 4px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .links-section {
    margin-bottom: 20px;
  }

  .links-section:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
  }

  .empty-state,
  .empty-section {
    text-align: center;
    padding: 24px 16px;
    color: var(--text-muted);
  }

  .empty-section {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .empty-state p,
  .empty-section p {
    margin: 0 0 4px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .empty-state .hint,
  .empty-section .hint {
    font-size: 12px;
    display: block;
  }

  .links-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .links-list.compact {
    gap: 4px;
  }

  .link-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .link-item:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .link-item.compact {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    gap: 8px;
  }

  .link-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-type {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .link-type.wiki {
    background: rgba(74, 158, 255, 0.15);
    color: var(--accent-color);
  }

  .link-context {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-arrow {
    color: var(--text-muted);
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

  @media (max-width: 450px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .link-item {
      padding: 10px;
    }
  }
</style>
