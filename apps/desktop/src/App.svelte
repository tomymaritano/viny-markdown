<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import NoteList from './components/NoteList.svelte';
  import Editor from './components/Editor.svelte';
  import SearchBar from './components/SearchBar.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import ConflictsModal from './components/ConflictsModal.svelte';
  import ShortcutsModal from './components/ShortcutsModal.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import TrashView from './components/TrashView.svelte';
  import ArchiveView from './components/ArchiveView.svelte';
  import TemplatesModal from './components/TemplatesModal.svelte';
  import MobileNav from './components/MobileNav.svelte';
  import Toast from './components/Toast.svelte';
  import GlobalSearch from './components/GlobalSearch.svelte';
  import SyncIndicator from './components/SyncIndicator.svelte';
  import GraphView from './components/GraphView.svelte';
  import CustomizeShortcutsModal from './components/CustomizeShortcutsModal.svelte';
  import QuickCapture from './components/QuickCapture.svelte';
  import { notesStore, appStore, syncStore } from '$lib/stores';
  import { shortcuts, isMac } from '$lib/shortcuts';
  import { toast } from '$lib/toast';

  let settingsOpen = $state(false);
  let conflictsOpen = $state(false);
  let shortcutsOpen = $state(false);
  let customizeShortcutsOpen = $state(false);
  let commandPaletteOpen = $state(false);
  let templatesOpen = $state(false);
  let globalSearchOpen = $state(false);
  let graphViewOpen = $state(false);
  let quickCaptureOpen = $state(false);
  let isLoading = $state(true);
  let mobileView = $state<'sidebar' | 'list' | 'editor'>('list');
  let isMobile = $state(false);
  let focusMode = $state(false);

  function checkMobile() {
    isMobile = window.innerWidth <= 768;
  }

  onMount(async () => {
    // Check mobile on mount and resize
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Register keyboard shortcuts
    shortcuts.register({
      key: 'n',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'New note',
      action: async () => {
        await notesStore.createNote({ title: '', content: '' });
        toast.success('New note created');
      },
    });

    shortcuts.register({
      key: 'n',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'New from template',
      action: () => {
        templatesOpen = true;
      },
    });

    shortcuts.register({
      key: ',',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Open settings',
      action: () => {
        settingsOpen = true;
      },
    });

    shortcuts.register({
      key: '/',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Keyboard shortcuts',
      action: () => {
        shortcutsOpen = true;
      },
    });

    shortcuts.register({
      key: 'k',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Command palette',
      action: () => {
        commandPaletteOpen = true;
      },
    });

    shortcuts.register({
      key: 'p',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Quick search',
      action: () => {
        commandPaletteOpen = true;
      },
    });

    shortcuts.register({
      key: 'escape',
      description: 'Close modal',
      action: () => {
        settingsOpen = false;
        conflictsOpen = false;
        shortcutsOpen = false;
        customizeShortcutsOpen = false;
        commandPaletteOpen = false;
        templatesOpen = false;
        globalSearchOpen = false;
        graphViewOpen = false;
      },
    });

    // Global search
    shortcuts.register({
      key: 'f',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'Global search',
      action: () => {
        globalSearchOpen = true;
      },
    });

    // Graph view
    shortcuts.register({
      key: 'g',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'Note graph',
      action: () => {
        graphViewOpen = true;
      },
    });

    // Quick Capture
    shortcuts.register({
      key: 'c',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'Quick capture',
      action: () => {
        quickCaptureOpen = true;
      },
    });

    // Navigation history
    shortcuts.register({
      key: '[',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Go back',
      action: () => {
        if (notesStore.canGoBack()) {
          notesStore.goBack();
          toast.info('Back');
        }
      },
    });

    shortcuts.register({
      key: ']',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Go forward',
      action: () => {
        if (notesStore.canGoForward()) {
          notesStore.goForward();
          toast.info('Forward');
        }
      },
    });

    // Note navigation
    shortcuts.register({
      key: 'j',
      description: 'Next note',
      action: () => {
        const notes = notesStore.filteredNotes;
        const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);
        if (currentIndex < notes.length - 1) {
          notesStore.selectNote(notes[currentIndex + 1].id);
        }
      },
    });

    shortcuts.register({
      key: 'k',
      description: 'Previous note',
      action: () => {
        const notes = notesStore.filteredNotes;
        const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);
        if (currentIndex > 0) {
          notesStore.selectNote(notes[currentIndex - 1].id);
        }
      },
    });

    shortcuts.register({
      key: 'ArrowDown',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Next note',
      action: () => {
        const notes = notesStore.filteredNotes;
        const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);
        if (currentIndex < notes.length - 1) {
          notesStore.selectNote(notes[currentIndex + 1].id);
        }
      },
    });

    shortcuts.register({
      key: 'ArrowUp',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Previous note',
      action: () => {
        const notes = notesStore.filteredNotes;
        const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);
        if (currentIndex > 0) {
          notesStore.selectNote(notes[currentIndex - 1].id);
        }
      },
    });

    // Pin/Archive shortcuts
    shortcuts.register({
      key: 'p',
      shift: true,
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Toggle pin',
      action: async () => {
        const note = notesStore.selectedNote;
        if (note) {
          await notesStore.updateNote(note.id, {
            title: null,
            content: null,
            notebook_id: null,
            tags: null,
            status: null,
            is_pinned: !note.is_pinned,
          });
          toast.success(note.is_pinned ? 'Unpinned' : 'Pinned');
        }
      },
    });

    shortcuts.register({
      key: 'Backspace',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Delete note',
      action: async () => {
        const note = notesStore.selectedNote;
        if (note) {
          await notesStore.deleteNote(note.id);
          toast.info('Note moved to trash');
        }
      },
    });

    // Theme toggle
    shortcuts.register({
      key: 'd',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'Toggle dark mode',
      action: () => {
        appStore.toggleTheme();
        toast.success(appStore.theme === 'dark' ? 'Dark mode' : 'Light mode');
      },
    });

    // Focus mode
    shortcuts.register({
      key: '\\',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Toggle focus mode',
      action: () => {
        focusMode = !focusMode;
        toast.success(focusMode ? 'Focus mode on' : 'Focus mode off');
      },
    });

    // Duplicate note
    shortcuts.register({
      key: 'd',
      [isMac ? 'meta' : 'ctrl']: true,
      description: 'Duplicate note',
      action: async () => {
        const note = notesStore.selectedNote;
        if (note) {
          const newNote = await notesStore.createNote({
            title: `${note.title} (copy)`,
            content: note.content,
            notebook_id: note.notebook_id,
            tags: note.tags,
          });
          notesStore.selectNote(newNote.id);
          toast.success('Note duplicated');
        }
      },
    });

    // Copy to clipboard (using Y to avoid conflict with Quick Capture)
    shortcuts.register({
      key: 'y',
      [isMac ? 'meta' : 'ctrl']: true,
      shift: true,
      description: 'Copy note to clipboard',
      action: async () => {
        const note = notesStore.selectedNote;
        if (note) {
          const content = `# ${note.title || 'Untitled'}\n\n${note.content}`;
          await navigator.clipboard.writeText(content);
          toast.success('Copied to clipboard');
        }
      },
    });

    // Initialize app
    try {
      await appStore.initialize();
      await notesStore.loadNotes();
      await syncStore.initialize();
      syncStore.loadAutoSyncSettings();
    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      isLoading = false;
    }
  });

  function openSettings() {
    settingsOpen = true;
  }

  function openConflicts() {
    conflictsOpen = true;
  }

  async function handleNewNoteMobile() {
    await notesStore.createNote({ title: '', content: '' });
    toast.success('New note created');
    mobileView = 'editor';
  }

  function handleMobileViewChange(view: 'sidebar' | 'list' | 'editor') {
    mobileView = view;
  }
</script>

{#if isLoading}
  <div class="loading-screen">
    <div class="loading-content">
      <div class="logo-icon">V</div>
      <div class="loading-spinner"></div>
    </div>
  </div>
{:else}
  <div class="app" class:mobile={isMobile} class:focus-mode={focusMode}>
    {#if (!isMobile || mobileView === 'sidebar') && !focusMode}
      <Sidebar onOpenSettings={openSettings} onOpenConflicts={openConflicts} onOpenGraph={() => graphViewOpen = true} />
    {/if}

    <div class="main">
      {#if !focusMode}
        <header class="header">
          <div class="nav-buttons">
            <button
              class="nav-btn"
              onclick={() => notesStore.goBack()}
              disabled={!notesStore.canGoBack()}
              title="Go back (⌘[)"
            >
              ←
            </button>
            <button
              class="nav-btn"
              onclick={() => notesStore.goForward()}
              disabled={!notesStore.canGoForward()}
              title="Go forward (⌘])"
            >
              →
            </button>
          </div>
          <SearchBar />
          <div class="header-actions">
            <button
              class="header-btn"
              onclick={() => globalSearchOpen = true}
              title="Global search (⌘⇧F)"
            >
              🔎
            </button>
            <button
              class="header-btn"
              onclick={() => templatesOpen = true}
              title="New from template (⌘⇧N)"
            >
              📝
            </button>
            <button
              class="header-btn"
              onclick={() => commandPaletteOpen = true}
              title="Command palette (⌘K)"
            >
              🔍
            </button>
            <button
              class="header-btn"
              onclick={() => appStore.toggleTheme()}
              title="Toggle theme"
            >
              {appStore.theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              class="header-btn"
              onclick={() => { focusMode = true; toast.success('Focus mode on - Press ⌘\\ to exit'); }}
              title="Focus mode (⌘\\)"
            >
              🎯
            </button>
            {#if !isMobile}
              <button
                class="header-btn"
                onclick={() => shortcutsOpen = true}
                title="Keyboard shortcuts (⌘/)"
              >
                ⌨️
              </button>
            {/if}
            <SyncIndicator />
          </div>
        </header>
      {:else}
        <button
          class="exit-focus-btn"
          onclick={() => focusMode = false}
          title="Exit focus mode (⌘\\)"
        >
          Exit Focus Mode
        </button>
      {/if}

      <div class="content">
        {#if notesStore.viewingTrash}
          <TrashView />
        {:else if notesStore.viewingArchived}
          <ArchiveView />
        {:else}
          {#if (!isMobile || mobileView === 'list') && !focusMode}
            <NoteList />
          {/if}
          {#if !isMobile || mobileView === 'editor' || focusMode}
            <Editor />
          {/if}
        {/if}
      </div>
    </div>

    {#if isMobile}
      <MobileNav
        currentView={mobileView}
        onViewChange={handleMobileViewChange}
        onNewNote={handleNewNoteMobile}
        onOpenSettings={openSettings}
      />
    {/if}
  </div>
{/if}

<SettingsModal bind:open={settingsOpen} />
<ConflictsModal bind:open={conflictsOpen} />
<ShortcutsModal bind:open={shortcutsOpen} onCustomize={() => { shortcutsOpen = false; customizeShortcutsOpen = true; }} />
<CustomizeShortcutsModal bind:open={customizeShortcutsOpen} />
<CommandPalette
  bind:open={commandPaletteOpen}
  onOpenSettings={() => { settingsOpen = true; commandPaletteOpen = false; }}
  onOpenShortcuts={() => { shortcutsOpen = true; commandPaletteOpen = false; }}
  onOpenTemplates={() => { templatesOpen = true; commandPaletteOpen = false; }}
  onOpenQuickCapture={() => { quickCaptureOpen = true; commandPaletteOpen = false; }}
/>
<TemplatesModal bind:open={templatesOpen} />
<GlobalSearch bind:open={globalSearchOpen} />
<GraphView bind:open={graphViewOpen} />
<QuickCapture bind:open={quickCaptureOpen} />
<Toast />

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg-primary);
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .logo-icon {
    width: 64px;
    height: 64px;
    background: var(--accent);
    color: white;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    font-weight: 700;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .app {
    display: flex;
    height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-buttons {
    display: flex;
    gap: 4px;
    margin-right: 8px;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.15s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 6px;
    opacity: 0.6;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    opacity: 1;
    background: var(--bg-hover);
  }

  .exit-focus-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 8px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    z-index: 100;
    opacity: 0.4;
    transition: all 0.3s ease;
  }

  .exit-focus-btn:hover {
    opacity: 1;
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .app.focus-mode .main {
    position: relative;
  }

  .app.focus-mode .content {
    max-width: 800px;
    margin: 0 auto;
  }

  .content {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  /* Mobile styles */
  .app.mobile {
    flex-direction: column;
    padding-bottom: 64px; /* Space for bottom nav */
  }

  .app.mobile .main {
    flex: 1;
  }

  .app.mobile .content {
    flex-direction: column;
  }

  @media (max-width: 768px) {
    .header {
      padding: 8px 12px;
    }
  }
</style>
