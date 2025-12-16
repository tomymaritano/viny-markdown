<script lang="ts">
  import { appStore, notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import SyncStatus from './SyncStatus.svelte';
  import { getTodayStats, getWritingGoals, getCurrentStreak } from '$lib/writingStats';

  let {
    onOpenSettings = () => {},
    onOpenConflicts = () => {},
    onOpenGraph = () => {}
  } = $props<{
    onOpenSettings?: () => void;
    onOpenConflicts?: () => void;
    onOpenGraph?: () => void;
  }>();

  let dropTargetId = $state<string | null>(null);

  // Daily progress derived values
  const todayStats = $derived(getTodayStats());
  const writingGoals = $derived(getWritingGoals());
  const currentStreak = $derived(getCurrentStreak());
  const wordProgress = $derived(Math.min(100, Math.round((todayStats.wordsWritten / writingGoals.dailyWordGoal) * 100)));

  function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function selectNotebook(id: string | null) {
    notesStore.setShowingStarred(false);
    notesStore.setNotebook(id);
  }

  function selectTag(name: string | null) {
    notesStore.setShowingStarred(false);
    notesStore.setTagFilter(name);
  }

  function getTotalWords(): string {
    const total = notesStore.allNotes.reduce((sum, note) => {
      const words = note.content.trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);

    if (total >= 1000000) {
      return `${(total / 1000000).toFixed(1)}M`;
    } else if (total >= 1000) {
      return `${(total / 1000).toFixed(1)}K`;
    }
    return total.toString();
  }

  function getNotebookStats(notebookId: string): { notes: number; words: string } {
    const notebookNotes = notesStore.allNotes.filter(n => n.notebook_id === notebookId);
    const noteCount = notebookNotes.length;
    const wordCount = notebookNotes.reduce((sum, note) => {
      const words = note.content.trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);

    let wordsStr: string;
    if (wordCount >= 1000) {
      wordsStr = `${(wordCount / 1000).toFixed(1)}K`;
    } else {
      wordsStr = wordCount.toString();
    }

    return { notes: noteCount, words: wordsStr };
  }

  async function createNotebook() {
    const name = prompt('Notebook name:');
    if (!name || !name.trim()) {
      if (name !== null) { // User didn't cancel, just entered empty
        toast.error('Notebook name cannot be empty');
      }
      return;
    }
    if (name.trim().length > 50) {
      toast.error('Notebook name too long (max 50 characters)');
      return;
    }
    try {
      await appStore.createNotebook({ name: name.trim() });
      toast.success('Notebook created');
    } catch (err) {
      toast.error('Failed to create notebook');
    }
  }

  async function exportNotebook(notebookId: string, notebookName: string) {
    const notebookNotes = notesStore.allNotes.filter(n => n.notebook_id === notebookId);

    if (notebookNotes.length === 0) {
      toast.info('Notebook is empty');
      return;
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

      const folderName = notebookName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const path = await save({
        filters: [
          { name: 'Markdown Archive', extensions: ['zip'] },
          { name: 'Single Markdown File', extensions: ['md'] },
        ],
        defaultPath: `${folderName}.md`,
      });

      if (!path) return;

      if (path.endsWith('.md')) {
        // Export as single merged file
        const content = notebookNotes
          .sort((a, b) => a.title.localeCompare(b.title))
          .map(note => {
            return `# ${note.title || 'Untitled'}\n\n${note.content}\n\n---\n`;
          })
          .join('\n');

        const header = `# ${notebookName}\n\nExported ${notebookNotes.length} notes on ${new Date().toLocaleDateString()}\n\n---\n\n`;
        await writeTextFile(path, header + content);
        toast.success(`Exported ${notebookNotes.length} notes`);
      } else {
        // For zip we'd need additional handling - for now just export as single file
        const content = notebookNotes
          .sort((a, b) => a.title.localeCompare(b.title))
          .map(note => {
            return `# ${note.title || 'Untitled'}\n\n${note.content}\n\n---\n`;
          })
          .join('\n');

        const header = `# ${notebookName}\n\nExported ${notebookNotes.length} notes on ${new Date().toLocaleDateString()}\n\n---\n\n`;
        const mdPath = path.replace('.zip', '.md');
        await writeTextFile(mdPath, header + content);
        toast.success(`Exported ${notebookNotes.length} notes`);
      }
    } catch (err) {
      toast.error('Failed to export notebook');
      console.error(err);
    }
  }

  let notebookMenuId = $state<string | null>(null);

  function toggleNotebookMenu(e: MouseEvent, notebookId: string) {
    e.stopPropagation();
    notebookMenuId = notebookMenuId === notebookId ? null : notebookId;
  }

  function closeNotebookMenu() {
    notebookMenuId = null;
  }

  function handleDragOver(e: DragEvent, notebookId: string | null) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dropTargetId = notebookId;
  }

  function handleDragLeave() {
    dropTargetId = null;
  }

  async function handleDrop(e: DragEvent, notebookId: string | null) {
    e.preventDefault();
    dropTargetId = null;

    const noteId = e.dataTransfer?.getData('text/plain');
    if (!noteId) return;

    try {
      await notesStore.updateNote(noteId, {
        title: null,
        content: null,
        notebook_id: notebookId,
        tags: null,
        status: null,
        is_pinned: null,
      });
      const notebook = notebookId
        ? appStore.notebooks.find((n) => n.id === notebookId)
        : null;
      toast.success(
        notebook ? `Moved to ${notebook.name}` : 'Removed from notebook'
      );
    } catch (err) {
      toast.error('Failed to move note');
    }
  }

  // Tag color customization
  let tagMenuId = $state<string | null>(null);
  const tagColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#666666'
  ];

  function toggleTagMenu(e: MouseEvent, tagId: string) {
    e.stopPropagation();
    e.preventDefault();
    tagMenuId = tagMenuId === tagId ? null : tagId;
  }

  function closeTagMenu() {
    tagMenuId = null;
  }

  async function setTagColor(tagId: string, color: string) {
    try {
      await appStore.updateTag(tagId, { color });
      toast.success('Tag color updated');
    } catch (err) {
      toast.error('Failed to update tag color');
    }
    tagMenuId = null;
  }
</script>

<aside class="sidebar" role="navigation" aria-label="Main navigation">
  <div class="logo">
    <span class="logo-icon">V</span>
    <span class="logo-text">Viny</span>
  </div>

  <nav class="nav" aria-label="Notes filter">
    <button
      class="nav-item"
      class:active={notesStore.selectedNotebookId === null && notesStore.filterByTagId === null && !notesStore.showingStarred && !notesStore.viewingArchived && !notesStore.viewingTrash}
      class:drop-target={dropTargetId === 'all'}
      onclick={() => { selectNotebook(null); selectTag(null); notesStore.setShowingStarred(false); }}
      ondragover={(e) => handleDragOver(e, null)}
      ondragleave={handleDragLeave}
      ondrop={(e) => handleDrop(e, null)}
    >
      <span class="icon">N</span>
      All Notes
      <span class="count">{notesStore.allNotes.length}</span>
    </button>

    <button
      class="nav-item"
      class:active={notesStore.showingStarred}
      onclick={() => notesStore.setShowingStarred(true)}
    >
      <span class="icon">★</span>
      Starred
      {#if notesStore.starredNotes.length > 0}
        <span class="count starred-count">{notesStore.starredNotes.length}</span>
      {/if}
    </button>

    <button
      class="nav-item"
      class:active={notesStore.viewingArchived}
      onclick={() => notesStore.setViewingArchived(true)}
    >
      <span class="icon">A</span>
      Archived
      {#if notesStore.archivedNotes.length > 0}
        <span class="count">{notesStore.archivedNotes.length}</span>
      {/if}
    </button>

    <button
      class="nav-item"
      class:active={notesStore.viewingTrash}
      onclick={() => notesStore.setViewingTrash(true)}
    >
      <span class="icon">T</span>
      Trash
      {#if notesStore.trashedNotes.length > 0}
        <span class="count trash-count">{notesStore.trashedNotes.length}</span>
      {/if}
    </button>
  </nav>

  <!-- Recent Notes -->
  {#if notesStore.recentNotes.length > 0 && !notesStore.showingStarred}
    <div class="section recent-section">
      <div class="section-header">
        <span>Recent</span>
      </div>
      <div class="section-list">
        {#each notesStore.recentNotes as note}
          <button
            class="nav-item recent-item"
            class:active={notesStore.selectedNoteId === note.id}
            onclick={() => notesStore.selectNote(note.id)}
          >
            <span class="recent-title">{note.title || 'Untitled'}</span>
            <span class="recent-time">{formatRelativeTime(note.updated_at)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="section">
    <div class="section-header">
      <span>Notebooks</span>
      <button class="add-btn" onclick={createNotebook} aria-label="Create notebook">+</button>
    </div>
    <div class="section-list">
      {#each appStore.notebooks as notebook}
        {@const stats = getNotebookStats(notebook.id)}
        <div class="notebook-wrapper">
          <div
            class="nav-item notebook-item"
            class:active={notesStore.selectedNotebookId === notebook.id}
            class:drop-target={dropTargetId === notebook.id}
            role="button"
            tabindex="0"
            onclick={() => selectNotebook(notebook.id)}
            onkeydown={(e) => e.key === 'Enter' && selectNotebook(notebook.id)}
            ondragover={(e) => handleDragOver(e, notebook.id)}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, notebook.id)}
          >
            <span class="icon" style:color={notebook.color}>F</span>
            <span class="notebook-name">{notebook.name}</span>
            {#if stats.notes > 0}
              <span class="notebook-stats" title="{stats.notes} notes, {stats.words} words">
                {stats.notes}
              </span>
            {/if}
            <button
              class="notebook-menu-btn"
              onclick={(e) => toggleNotebookMenu(e, notebook.id)}
              title="More options"
            >
              •••
            </button>
          </div>
          {#if notebookMenuId === notebook.id}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="notebook-menu" onmouseleave={closeNotebookMenu}>
              <button class="notebook-menu-item" onclick={() => { exportNotebook(notebook.id, notebook.name); closeNotebookMenu(); }}>
                <span>Export</span>
              </button>
              <button class="notebook-menu-item" onclick={() => { const newName = prompt('Rename notebook:', notebook.name); if (newName) appStore.updateNotebook(notebook.id, { name: newName }); closeNotebookMenu(); }}>
                <span>Rename</span>
              </button>
              <button class="notebook-menu-item danger" onclick={() => { if (confirm(`Delete "${notebook.name}"? Notes will be moved to "All Notes".`)) appStore.deleteNotebook(notebook.id); closeNotebookMenu(); }}>
                <span>Delete</span>
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <span>Tags</span>
    </div>
    <div class="section-list tags">
      {#each appStore.tags as tag}
        <div class="tag-wrapper">
          <button
            class="tag-chip"
            class:active={notesStore.filterByTagId === tag.name}
            style:--tag-color={tag.color || '#666'}
            onclick={() => selectTag(tag.name)}
            oncontextmenu={(e) => toggleTagMenu(e, tag.id)}
          >
            {tag.name}
          </button>
          {#if tagMenuId === tag.id}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="tag-color-menu" onmouseleave={closeTagMenu}>
              <div class="tag-color-title">Tag Color</div>
              <div class="tag-color-grid">
                {#each tagColors as color}
                  <button
                    class="tag-color-btn"
                    class:active={tag.color === color}
                    style:background={color}
                    onclick={() => setTagColor(tag.id, color)}
                    title={color}
                  ></button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Daily Progress Widget -->
  <div class="daily-progress">
    <div class="progress-header">
      <span class="progress-title">Today's Progress</span>
      {#if currentStreak > 0}
        <span class="streak-badge" title="{currentStreak} day streak">{currentStreak} day streak</span>
      {/if}
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: {wordProgress}%"></div>
    </div>
    <div class="progress-details">
      <span class="progress-words">{todayStats.wordsWritten} / {writingGoals.dailyWordGoal} words</span>
      <span class="progress-percent">{wordProgress}%</span>
    </div>
    {#if todayStats.notesEdited > 0}
      <div class="progress-notes">
        {todayStats.notesEdited} note{todayStats.notesEdited !== 1 ? 's' : ''} edited
      </div>
    {/if}
  </div>

  <!-- Stats Section -->
  <div class="stats-section">
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-value">{notesStore.allNotes.length}</span>
        <span class="stat-label">Notes</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{appStore.notebooks.length}</span>
        <span class="stat-label">Notebooks</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{notesStore.starredNotes.length}</span>
        <span class="stat-label">Starred</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{getTotalWords()}</span>
        <span class="stat-label">Words</span>
      </div>
    </div>
  </div>

  <div class="sidebar-footer">
    <SyncStatus onOpenConflicts={onOpenConflicts} />
    <div class="footer-buttons">
      <button class="footer-btn" onclick={onOpenGraph} title="Note Graph">
        <span class="footer-icon">G</span>
        Graph
      </button>
      <button class="footer-btn" onclick={onOpenSettings} title="Settings">
        <span class="footer-icon">S</span>
        Settings
      </button>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 16px;
    font-weight: 600;
    font-size: 18px;
  }

  .logo-icon {
    width: 28px;
    height: 28px;
    background: var(--accent);
    color: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .nav-item:hover {
    background: var(--bg-hover);
  }

  .nav-item.active {
    background: var(--accent-light);
    color: var(--accent);
  }

  .nav-item.drop-target {
    background: var(--accent-light);
    border: 2px dashed var(--accent);
  }

  .icon {
    font-size: 16px;
  }

  .count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .trash-count {
    background: var(--error-light);
    color: var(--error);
  }

  .starred-count {
    background: #fef3c7;
    color: #d97706;
  }

  :global(.dark) .starred-count {
    background: #422006;
    color: #fbbf24;
  }

  .section {
    margin-top: 24px;
    padding: 0 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .add-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
  }

  .add-btn:hover {
    color: var(--accent);
  }

  .section-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-list.tags {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 12px;
  }

  .tag-chip {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    border: 1px solid var(--tag-color);
    background: transparent;
    color: var(--tag-color);
    cursor: pointer;
  }

  .tag-chip.active {
    background: var(--tag-color);
    color: white;
  }

  .tag-wrapper {
    position: relative;
  }

  .tag-color-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px;
    z-index: 100;
    min-width: 120px;
  }

  .tag-color-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 8px;
    text-align: center;
  }

  .tag-color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .tag-color-btn {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .tag-color-btn:hover {
    transform: scale(1.15);
  }

  .tag-color-btn.active {
    border-color: var(--text-primary);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .footer-buttons {
    display: flex;
    gap: 8px;
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .footer-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .footer-icon {
    font-size: 13px;
  }

  /* Daily Progress Widget */
  .daily-progress {
    margin: 16px 12px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .progress-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .streak-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: linear-gradient(135deg, #f59e0b, #ef4444);
    color: white;
    border-radius: 10px;
    font-weight: 600;
  }

  .progress-bar-container {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #22c55e);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .progress-words {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .progress-percent {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
  }

  .progress-notes {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--border);
  }

  .stats-section {
    margin-top: auto;
    padding: 16px;
    border-top: 1px solid var(--border);
    margin-bottom: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: var(--bg-primary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
    margin-top: 2px;
  }

  .recent-section {
    margin-top: 16px;
  }

  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px 12px;
  }

  .recent-title {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .recent-time {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .notebook-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .notebook-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notebook-stats {
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 8px;
    min-width: 20px;
    text-align: center;
  }

  .notebook-item.active .notebook-stats {
    background: var(--accent);
    color: white;
  }

  .notebook-wrapper {
    position: relative;
  }

  .notebook-menu-btn {
    opacity: 0;
    background: none;
    border: none;
    padding: 2px 6px;
    font-size: 10px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
    transition: opacity 0.15s ease;
  }

  .notebook-item:hover .notebook-menu-btn {
    opacity: 1;
  }

  .notebook-menu-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .notebook-menu {
    position: absolute;
    top: 100%;
    left: 12px;
    right: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    overflow: hidden;
    animation: menuFadeIn 0.15s ease;
  }

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .notebook-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
  }

  .notebook-menu-item:hover {
    background: var(--bg-hover);
  }

  .notebook-menu-item.danger {
    color: var(--error);
  }

  .notebook-menu-item.danger:hover {
    background: var(--error-light);
  }
</style>
