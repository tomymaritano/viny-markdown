<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import NotesList from '$lib/components/NotesList.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import TrashList from '$lib/components/TrashList.svelte';
  import TrashNoteViewer from '$lib/components/TrashNoteViewer.svelte';
  import ArchiveList from '$lib/components/ArchiveList.svelte';
  import ArchiveNoteViewer from '$lib/components/ArchiveNoteViewer.svelte';
  // Keep frequently used modals static
  import KeyboardShortcutsModal from '$lib/components/KeyboardShortcutsModal.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  // Heavy modals will be lazy loaded

  let showShortcuts = $state(false);
  let showCommandPalette = $state(false);
  let showSettings = $state(false);
  let showTemplates = $state(false);
  let showGlobalGraph = $state(false);
  let showFocusTimer = $state(false);
  let showWritingStats = $state(false);
  let showTagManager = $state(false);
  let showNotebookManager = $state(false);
  let showQuickSwitcher = $state(false);
  let showTemplateManager = $state(false);
  let showNoteCalendar = $state(false);
  let showNoteOutline = $state(false);
  let showBacklinks = $state(false);
  let showWordCountGoal = $state(false);
  let showVersionHistory = $state(false);
  let showNoteInfo = $state(false);

  // Touch gesture handling
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  const SWIPE_THRESHOLD = 50;
  const EDGE_ZONE = 30; // pixels from left edge to trigger sidebar
  const MAX_SWIPE_TIME = 300; // ms

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }

  function handleTouchEnd(e: TouchEvent) {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const elapsed = Date.now() - touchStartTime;

    // Only process quick swipes
    if (elapsed > MAX_SWIPE_TIME) return;

    // Ignore if vertical movement is greater than horizontal
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Swipe right from left edge → open sidebar
    if (deltaX > SWIPE_THRESHOLD && touchStartX < EDGE_ZONE && !appStore.sidebarOpen) {
      appStore.setSidebar(true);
      return;
    }

    // Swipe left when sidebar is open → close sidebar
    if (deltaX < -SWIPE_THRESHOLD && appStore.sidebarOpen) {
      appStore.setSidebar(false);
      return;
    }

    // Swipe right in editor → go back to notes list
    if (deltaX > SWIPE_THRESHOLD && appStore.mobileShowEditor && !appStore.sidebarOpen) {
      appStore.setMobileShowEditor(false);
      return;
    }

    // Swipe left/right in editor from right edge → navigate between notes
    if (appStore.mobileShowEditor && !appStore.sidebarOpen && notesStore.selectedNoteId) {
      const notes = notesStore.filteredNotes;
      const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);

      // Swipe left from right edge → next note
      if (deltaX < -SWIPE_THRESHOLD && touchStartX > window.innerWidth - EDGE_ZONE && currentIndex < notes.length - 1) {
        notesStore.selectNote(notes[currentIndex + 1].id);
        return;
      }
    }
  }

  onMount(async () => {
    await notesStore.initialize();
    await appStore.initialize();

    // Handle PWA shortcuts from manifest
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'new') {
      notesStore.createNote();
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (action === 'daily') {
      notesStore.openDailyNote();
      window.history.replaceState({}, '', '/');
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl + N: New note
    if (modifier && event.key === 'n') {
      event.preventDefault();
      notesStore.createNote();
    }

    // Cmd/Ctrl + F: Focus search
    if (modifier && event.key === 'f') {
      event.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('.search-input');
      searchInput?.focus();
    }

    // Cmd/Ctrl + Backspace: Delete note
    if (modifier && event.key === 'Backspace' && notesStore.selectedNoteId) {
      event.preventDefault();
      if (confirm('Delete this note?')) {
        notesStore.deleteNote(notesStore.selectedNoteId);
      }
    }

    // Escape: Clear selection / blur
    if (event.key === 'Escape') {
      const active = document.activeElement as HTMLElement;
      active?.blur();
    }

    // Arrow Up/Down: Navigate notes
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const active = document.activeElement;
      if (active?.tagName === 'TEXTAREA' || active?.tagName === 'INPUT') return;

      event.preventDefault();
      const notes = notesStore.notes;
      const currentIndex = notes.findIndex((n) => n.id === notesStore.selectedNoteId);

      if (event.key === 'ArrowUp' && currentIndex > 0) {
        notesStore.selectNote(notes[currentIndex - 1].id);
      } else if (event.key === 'ArrowDown' && currentIndex < notes.length - 1) {
        notesStore.selectNote(notes[currentIndex + 1].id);
      }
    }

    // ?: Show keyboard shortcuts (only when not in input/textarea)
    if (event.key === '?' || (modifier && event.key === '/')) {
      const active = document.activeElement;
      if (active?.tagName === 'TEXTAREA' || active?.tagName === 'INPUT') return;
      event.preventDefault();
      showShortcuts = true;
    }

    // Cmd/Ctrl + .: Toggle focus mode
    if (modifier && event.key === '.') {
      event.preventDefault();
      appStore.toggleFocusMode();
    }

    // Cmd/Ctrl + K: Open command palette
    if (modifier && event.key === 'k') {
      event.preventDefault();
      showCommandPalette = true;
    }

    // Cmd/Ctrl + D: Open daily note
    if (modifier && event.key === 'd') {
      event.preventDefault();
      notesStore.openDailyNote();
    }

    // Cmd/Ctrl + P: Toggle pin on current note
    if (modifier && event.key === 'p' && notesStore.selectedNoteId) {
      event.preventDefault();
      notesStore.togglePin(notesStore.selectedNoteId);
    }

    // Cmd/Ctrl + Shift + A: Archive note
    if (modifier && event.shiftKey && event.key === 'a' && notesStore.selectedNoteId) {
      event.preventDefault();
      if (confirm('Archive this note?')) {
        notesStore.archiveNote(notesStore.selectedNoteId);
      }
    }

    // Cmd/Ctrl + Shift + D: Duplicate note
    if (modifier && event.shiftKey && event.key === 'd' && notesStore.selectedNoteId) {
      event.preventDefault();
      notesStore.duplicateNote(notesStore.selectedNoteId);
    }

    // Cmd/Ctrl + Shift + E: Export note
    if (modifier && event.shiftKey && event.key === 'e' && notesStore.selectedNoteId) {
      event.preventDefault();
      notesStore.exportNote(notesStore.selectedNoteId);
    }

    // Cmd/Ctrl + Shift + C: Copy note to clipboard
    if (modifier && event.shiftKey && event.key === 'c' && notesStore.selectedNoteId) {
      event.preventDefault();
      notesStore.copyNoteToClipboard(notesStore.selectedNoteId);
    }

    // Cmd/Ctrl + Shift + V: Toggle view mode (list/card)
    if (modifier && event.shiftKey && event.key === 'v') {
      event.preventDefault();
      notesStore.toggleViewMode();
    }

    // Cmd/Ctrl + Shift + T: Open templates picker
    if (modifier && event.shiftKey && event.key === 't') {
      event.preventDefault();
      showTemplates = true;
    }

    // Cmd/Ctrl + Shift + S: Toggle select mode
    if (modifier && event.shiftKey && event.key === 's') {
      event.preventDefault();
      notesStore.toggleSelectMode();
    }

    // Cmd/Ctrl + Shift + G: Open global graph
    if (modifier && event.shiftKey && event.key === 'g') {
      event.preventDefault();
      showGlobalGraph = true;
    }

    // Cmd/Ctrl + Shift + Y: Open focus timer
    if (modifier && event.shiftKey && event.key === 'y') {
      event.preventDefault();
      showFocusTimer = true;
    }

    // Cmd/Ctrl + Shift + W: Open writing stats
    if (modifier && event.shiftKey && event.key === 'w') {
      event.preventDefault();
      showWritingStats = true;
    }

    // Cmd/Ctrl + Shift + L: Open tag manager
    if (modifier && event.shiftKey && event.key === 'l') {
      event.preventDefault();
      showTagManager = true;
    }

    // Cmd/Ctrl + Shift + B: Open notebook manager
    if (modifier && event.shiftKey && event.key === 'b') {
      event.preventDefault();
      showNotebookManager = true;
    }

    // Cmd/Ctrl + O: Open quick switcher
    if (modifier && event.key === 'o') {
      event.preventDefault();
      showQuickSwitcher = true;
    }

    // Cmd/Ctrl + Shift + R: Open random note
    if (modifier && event.shiftKey && event.key === 'r') {
      event.preventDefault();
      notesStore.openRandomNote();
    }

    // Cmd/Ctrl + Shift + M: Open template manager
    if (modifier && event.shiftKey && event.key === 'm') {
      event.preventDefault();
      showTemplateManager = true;
    }

    // Cmd/Ctrl + Shift + J: Open note calendar
    if (modifier && event.shiftKey && event.key === 'j') {
      event.preventDefault();
      showNoteCalendar = true;
    }

    // Cmd/Ctrl + Shift + U: Open note outline
    if (modifier && event.shiftKey && event.key === 'u') {
      event.preventDefault();
      showNoteOutline = true;
    }

    // Cmd/Ctrl + Shift + K: Open backlinks
    if (modifier && event.shiftKey && event.key === 'k') {
      event.preventDefault();
      showBacklinks = true;
    }

    // Cmd/Ctrl + Shift + X: Open word count goal
    if (modifier && event.shiftKey && event.key === 'x') {
      event.preventDefault();
      showWordCountGoal = true;
    }

    // Cmd/Ctrl + H: Open version history
    if (modifier && event.key === 'h') {
      event.preventDefault();
      showVersionHistory = true;
    }

    // Cmd/Ctrl + I: Show note info
    if (modifier && event.key === 'i') {
      event.preventDefault();
      showNoteInfo = true;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:touchstart={handleTouchStart} on:touchend={handleTouchEnd} />

<svelte:head>
  <title>VINY - Notes</title>
</svelte:head>

<div class="app-container" class:focus-mode={appStore.focusMode}>
  <!-- Mobile menu button -->
  {#if !appStore.focusMode}
    <button
      class="mobile-menu-btn"
      onclick={() => appStore.toggleSidebar()}
      aria-label="Toggle menu"
    >
      ☰
    </button>
  {/if}

  <!-- Mobile overlay -->
  {#if appStore.sidebarOpen}
    <button
      class="mobile-overlay"
      onclick={() => appStore.setSidebar(false)}
      aria-label="Close sidebar"
    ></button>
  {/if}

  {#if !appStore.focusMode}
    <Sidebar onShowSettings={() => showSettings = true} />
  {/if}
  {#if notesStore.viewingTrash}
    {#if !appStore.focusMode}
      <div class="notes-list-wrapper" class:mobile-hidden={appStore.mobileShowEditor}>
        <TrashList />
      </div>
    {/if}
    <div class="note-editor-wrapper" class:mobile-hidden={!appStore.mobileShowEditor && !appStore.focusMode}>
      <TrashNoteViewer />
    </div>
  {:else if notesStore.viewingArchive}
    {#if !appStore.focusMode}
      <div class="notes-list-wrapper" class:mobile-hidden={appStore.mobileShowEditor}>
        <ArchiveList />
      </div>
    {/if}
    <div class="note-editor-wrapper" class:mobile-hidden={!appStore.mobileShowEditor && !appStore.focusMode}>
      <ArchiveNoteViewer />
    </div>
  {:else}
    {#if !appStore.focusMode}
      <div class="notes-list-wrapper" class:mobile-hidden={appStore.mobileShowEditor}>
        <NotesList />
      </div>
    {/if}
    <div class="note-editor-wrapper" class:mobile-hidden={!appStore.mobileShowEditor && !appStore.focusMode}>
      <NoteEditor />
    </div>
  {/if}

  {#if appStore.focusMode}
    <button
      class="exit-focus-btn"
      onclick={() => appStore.setFocusMode(false)}
      title="Exit focus mode (Cmd+.)"
    >
      ← Exit Focus
    </button>
  {/if}
</div>

<!-- Static modals (frequently used) -->
<KeyboardShortcutsModal open={showShortcuts} onclose={() => showShortcuts = false} />
<CommandPalette open={showCommandPalette} onClose={() => showCommandPalette = false} onOpenGraph={() => showGlobalGraph = true} onOpenFocusTimer={() => showFocusTimer = true} onOpenWritingStats={() => showWritingStats = true} onOpenTagManager={() => showTagManager = true} onOpenNotebookManager={() => showNotebookManager = true} onOpenQuickSwitcher={() => showQuickSwitcher = true} onOpenTemplateManager={() => showTemplateManager = true} onOpenNoteCalendar={() => showNoteCalendar = true} onOpenNoteOutline={() => showNoteOutline = true} onOpenBacklinks={() => showBacklinks = true} onOpenWordCountGoal={() => showWordCountGoal = true} onOpenVersionHistory={() => showVersionHistory = true} onOpenNoteInfo={() => showNoteInfo = true} />
<InstallPrompt />

<!-- Lazy loaded modals -->
{#if showSettings}
  {#await import('$lib/components/SettingsPanel.svelte') then { default: SettingsPanel }}
    <SettingsPanel open={showSettings} onclose={() => showSettings = false} />
  {/await}
{/if}

{#if showTemplates}
  {#await import('$lib/components/TemplatesPicker.svelte') then { default: TemplatesPicker }}
    <TemplatesPicker open={showTemplates} onClose={() => showTemplates = false} />
  {/await}
{/if}

{#if showGlobalGraph}
  {#await import('$lib/components/GlobalGraph.svelte') then { default: GlobalGraph }}
    <GlobalGraph open={showGlobalGraph} onClose={() => showGlobalGraph = false} />
  {/await}
{/if}

{#if showFocusTimer}
  {#await import('$lib/components/FocusTimer.svelte') then { default: FocusTimer }}
    <FocusTimer open={showFocusTimer} onClose={() => showFocusTimer = false} />
  {/await}
{/if}

{#if showWritingStats}
  {#await import('$lib/components/WritingStats.svelte') then { default: WritingStats }}
    <WritingStats open={showWritingStats} onClose={() => showWritingStats = false} />
  {/await}
{/if}

{#if showTagManager}
  {#await import('$lib/components/TagManager.svelte') then { default: TagManager }}
    <TagManager open={showTagManager} onClose={() => showTagManager = false} />
  {/await}
{/if}

{#if showNotebookManager}
  {#await import('$lib/components/NotebookManager.svelte') then { default: NotebookManager }}
    <NotebookManager open={showNotebookManager} onClose={() => showNotebookManager = false} />
  {/await}
{/if}

{#if showQuickSwitcher}
  {#await import('$lib/components/QuickSwitcher.svelte') then { default: QuickSwitcher }}
    <QuickSwitcher open={showQuickSwitcher} onclose={() => showQuickSwitcher = false} />
  {/await}
{/if}

{#if showTemplateManager}
  {#await import('$lib/components/TemplateManager.svelte') then { default: TemplateManager }}
    <TemplateManager open={showTemplateManager} onClose={() => showTemplateManager = false} />
  {/await}
{/if}

{#if showNoteCalendar}
  {#await import('$lib/components/NoteCalendar.svelte') then { default: NoteCalendar }}
    <NoteCalendar open={showNoteCalendar} onClose={() => showNoteCalendar = false} />
  {/await}
{/if}

{#if showNoteOutline}
  {#await import('$lib/components/NoteOutline.svelte') then { default: NoteOutline }}
    <NoteOutline open={showNoteOutline} onClose={() => showNoteOutline = false} />
  {/await}
{/if}

{#if showBacklinks}
  {#await import('$lib/components/Backlinks.svelte') then { default: Backlinks }}
    <Backlinks open={showBacklinks} onClose={() => showBacklinks = false} />
  {/await}
{/if}

{#if showWordCountGoal}
  {#await import('$lib/components/WordCountGoal.svelte') then { default: WordCountGoal }}
    <WordCountGoal open={showWordCountGoal} onClose={() => showWordCountGoal = false} />
  {/await}
{/if}

{#if showVersionHistory}
  {#await import('$lib/components/VersionHistory.svelte') then { default: VersionHistory }}
    <VersionHistory open={showVersionHistory} onClose={() => showVersionHistory = false} />
  {/await}
{/if}

{#if showNoteInfo}
  {#await import('$lib/components/NoteInfoPanel.svelte') then { default: NoteInfoPanel }}
    <NoteInfoPanel open={showNoteInfo} onclose={() => showNoteInfo = false} />
  {/await}
{/if}

<style>
  .app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: relative;
  }

  .app-container.focus-mode {
    background: var(--bg-primary);
    justify-content: center;
  }

  .app-container.focus-mode .note-editor-wrapper {
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }

  .exit-focus-btn {
    position: absolute;
    top: 16px;
    left: 16px;
    padding: 6px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, background 0.15s;
    z-index: 100;
  }

  .app-container.focus-mode:hover .exit-focus-btn {
    opacity: 0.5;
  }

  .exit-focus-btn:hover {
    opacity: 1 !important;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  /* Mobile menu button - hidden on desktop */
  .mobile-menu-btn {
    display: none;
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 999;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 20px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .mobile-menu-btn:hover {
    background: var(--bg-hover);
  }

  /* Mobile overlay - hidden on desktop */
  .mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
  }

  /* Wrappers for mobile responsiveness */
  .notes-list-wrapper {
    display: contents;
  }

  .note-editor-wrapper {
    display: contents;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: flex;
    }

    .mobile-overlay {
      display: block;
    }

    .notes-list-wrapper {
      display: block;
      width: 100%;
      height: 100%;
    }

    .note-editor-wrapper {
      display: block;
      width: 100%;
      height: 100%;
    }

    .notes-list-wrapper.mobile-hidden,
    .note-editor-wrapper.mobile-hidden {
      display: none;
    }
  }
</style>
