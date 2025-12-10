<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import { operationsStore } from '$lib/stores/operations.svelte';
  import { X } from 'lucide-svelte';

  type ViewMode = 'list' | 'card';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

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

  async function handleClearPendingOps() {
    if (confirm('Clear all pending operations? This cannot be undone.')) {
      await operationsStore.clearAll();
    }
  }

  async function handleExportData() {
    await notesStore.exportAllAsJson();
  }

  async function handleExportMarkdown() {
    await notesStore.exportAllAsMarkdown();
  }

  let importInput: HTMLInputElement;
  let markdownImportInput: HTMLInputElement;
  let zipImportInput: HTMLInputElement;

  function handleImportClick() {
    importInput?.click();
  }

  function handleMarkdownImportClick() {
    markdownImportInput?.click();
  }

  function handleZipImportClick() {
    zipImportInput?.click();
  }

  async function handleExportZip() {
    await notesStore.exportAllAsZip();
  }

  async function handleImportZip(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await notesStore.importFromZip(file);
      const messages = [];
      if (result.notesImported > 0) messages.push(`${result.notesImported} notes`);
      if (result.notebooksImported > 0) messages.push(`${result.notebooksImported} notebooks`);
      if (result.tagsImported > 0) messages.push(`${result.tagsImported} tags`);

      if (messages.length > 0) {
        alert(`Successfully imported: ${messages.join(', ')}`);
      } else {
        alert('No new items to import');
      }

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    input.value = '';
  }

  async function handleImportJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const result = await notesStore.importFromJson(file);
      const messages = [];
      if (result.notesImported > 0) messages.push(`${result.notesImported} notes`);
      if (result.notebooksImported > 0) messages.push(`${result.notebooksImported} notebooks`);
      if (result.tagsImported > 0) messages.push(`${result.tagsImported} tags`);

      if (messages.length > 0) {
        alert(`Successfully imported: ${messages.join(', ')}`);
      } else {
        alert('No new items to import (all already exist)');
      }

      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    input.value = '';
  }

  async function handleImportMarkdown(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    try {
      let count = 0;
      for (const file of files) {
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          const content = await file.text();
          const title = file.name.replace(/\.(md|markdown)$/, '');
          await notesStore.importMarkdownNote(title, content);
          count++;
        }
      }
      alert(`Successfully imported ${count} markdown files!`);
    } catch (e) {
      alert(`Import failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    input.value = '';
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2 id="settings-title">Settings</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div class="modal-body">
        <!-- Appearance -->
        <section class="settings-section">
          <h3 class="section-title">Appearance</h3>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Theme</label>
              <span class="setting-description">Choose light or dark mode</span>
            </div>
            <div class="setting-control">
              <select
                value={appStore.theme}
                onchange={(e) => {
                  const target = e.target as HTMLSelectElement;
                  if (target.value === 'light') appStore.toggleTheme();
                  else if (target.value === 'dark' && appStore.theme === 'light') appStore.toggleTheme();
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Notes View</label>
              <span class="setting-description">Display notes as list or cards</span>
            </div>
            <div class="setting-control">
              <select
                value={notesStore.viewMode}
                onchange={(e) => {
                  const target = e.target as HTMLSelectElement;
                  notesStore.setViewMode(target.value as ViewMode);
                }}
              >
                <option value="list">List</option>
                <option value="card">Cards</option>
              </select>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Default Sort</label>
              <span class="setting-description">How notes are sorted by default</span>
            </div>
            <div class="setting-control">
              <select
                value={`${notesStore.sortBy}-${notesStore.sortOrder}`}
                onchange={(e) => {
                  const target = e.target as HTMLSelectElement;
                  const [by, order] = target.value.split('-');
                  notesStore.setSort(by as 'updatedAt' | 'createdAt' | 'title' | 'manual', order as 'asc' | 'desc');
                }}
              >
                <option value="updatedAt-desc">Modified (Newest)</option>
                <option value="updatedAt-asc">Modified (Oldest)</option>
                <option value="createdAt-desc">Created (Newest)</option>
                <option value="createdAt-asc">Created (Oldest)</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
                <option value="manual-asc">Manual</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Editor -->
        <section class="settings-section">
          <h3 class="section-title">Editor</h3>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Typewriter Mode</label>
              <span class="setting-description">Keep cursor centered while typing</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input
                  type="checkbox"
                  checked={appStore.typewriterMode}
                  onchange={() => appStore.toggleTypewriterMode()}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Scroll Sync</label>
              <span class="setting-description">Sync scrolling in split view</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input
                  type="checkbox"
                  checked={appStore.scrollSync}
                  onchange={() => appStore.toggleScrollSync()}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        <!-- Import/Export -->
        <section class="settings-section">
          <h3 class="section-title">Import / Export</h3>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Export as JSON</label>
              <span class="setting-description">Download all notes in JSON format</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleExportData}>
                Export
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Export as Markdown</label>
              <span class="setting-description">All notes in a single .md file</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleExportMarkdown}>
                Export
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Export as ZIP</label>
              <span class="setting-description">Notes organized by notebook folders</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleExportZip}>
                Export
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Import JSON</label>
              <span class="setting-description">Import notes from Viny JSON backup</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleImportClick}>
                Import
              </button>
              <input
                bind:this={importInput}
                type="file"
                accept=".json"
                class="hidden-input"
                onchange={handleImportJson}
              />
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Import ZIP</label>
              <span class="setting-description">Import notes from ZIP with folders as notebooks</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleZipImportClick}>
                Import
              </button>
              <input
                bind:this={zipImportInput}
                type="file"
                accept=".zip"
                class="hidden-input"
                onchange={handleImportZip}
              />
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Import Markdown</label>
              <span class="setting-description">Import .md files (Obsidian compatible)</span>
            </div>
            <div class="setting-control">
              <button class="action-btn" onclick={handleMarkdownImportClick}>
                Import
              </button>
              <input
                bind:this={markdownImportInput}
                type="file"
                accept=".md,.markdown"
                multiple
                class="hidden-input"
                onchange={handleImportMarkdown}
              />
            </div>
          </div>
        </section>

        <!-- Data -->
        <section class="settings-section">
          <h3 class="section-title">Data</h3>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">Pending Operations</label>
              <span class="setting-description">{operationsStore.pendingCount} operations waiting to sync</span>
            </div>
            <div class="setting-control">
              {#if operationsStore.pendingCount > 0}
                <button class="action-btn danger" onclick={handleClearPendingOps}>
                  Clear
                </button>
              {:else}
                <span class="status-badge">All synced</span>
              {/if}
            </div>
          </div>
        </section>

        <!-- Sync (Future) -->
        <section class="settings-section">
          <h3 class="section-title">Sync</h3>

          <div class="setting-row disabled">
            <div class="setting-info">
              <label class="setting-label">Cloud Sync</label>
              <span class="setting-description">Coming soon - sync across devices</span>
            </div>
            <div class="setting-control">
              <span class="status-badge">Disabled</span>
            </div>
          </div>
        </section>

        <!-- About -->
        <section class="settings-section">
          <h3 class="section-title">About</h3>

          <div class="about-info">
            <div class="app-info">
              <span class="app-name">VINY</span>
              <span class="app-version">v0.1.0</span>
            </div>
            <p class="app-description">
              A modern, fast note-taking app with markdown support.
            </p>
            <div class="stats">
              <span class="stat">{notesStore.allNotes.length} notes</span>
              <span class="stat-separator">•</span>
              <span class="stat">{appStore.notebooks.length} notebooks</span>
              <span class="stat-separator">•</span>
              <span class="stat">{appStore.tags.length} tags</span>
            </div>
          </div>
        </section>
      </div>

      <footer class="modal-footer">
        <span class="tip">Press <kbd>Escape</kbd> to close</span>
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
  }

  .modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
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
    font-size: 20px;
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

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-light);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-row.disabled {
    opacity: 0.5;
  }

  .setting-info {
    flex: 1;
  }

  .setting-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .setting-description {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
  }

  .setting-control {
    margin-left: 16px;
  }

  .setting-control select {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--bg-tertiary);
    border-radius: 24px;
    transition: 0.2s;
  }

  .toggle-slider::before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.2s;
  }

  .toggle input:checked + .toggle-slider {
    background: var(--accent-color);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  .action-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-hover);
  }

  .action-btn.danger {
    background: #dc3545;
    color: white;
  }

  .action-btn.danger:hover {
    background: #c82333;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 10px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-muted);
  }

  .hidden-input {
    display: none;
  }

  /* About section */
  .about-info {
    padding: 12px 0;
  }

  .app-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  .app-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--text-primary);
  }

  .app-version {
    font-size: 12px;
    color: var(--text-muted);
  }

  .app-description {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .stat-separator {
    color: var(--border-color);
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

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal {
      max-width: 100%;
      max-height: 100%;
      height: 100%;
      border-radius: 0;
    }

    .modal-header {
      padding: 12px 16px;
    }

    .modal-body {
      padding: 12px 16px;
    }

    .setting-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .setting-control {
      margin-left: 0;
      width: 100%;
    }

    .setting-control select {
      width: 100%;
    }

    .stats {
      flex-wrap: wrap;
    }

    .modal-footer {
      display: none;
    }
  }
</style>
