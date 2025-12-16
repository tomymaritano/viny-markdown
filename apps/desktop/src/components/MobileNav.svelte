<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { FolderOpen, FileText, Plus, Edit3, Settings } from '@lucide/svelte';

  let {
    currentView = 'list',
    onViewChange = (view: 'sidebar' | 'list' | 'editor') => {},
    onNewNote = () => {},
    onOpenSettings = () => {},
  } = $props<{
    currentView: 'sidebar' | 'list' | 'editor';
    onViewChange: (view: 'sidebar' | 'list' | 'editor') => void;
    onNewNote: () => void;
    onOpenSettings?: () => void;
  }>();
</script>

<nav class="mobile-nav">
  <button
    class="nav-btn"
    class:active={currentView === 'sidebar'}
    onclick={() => onViewChange('sidebar')}
  >
    <span class="nav-icon"><FolderOpen size={22} /></span>
    <span class="nav-label">Browse</span>
  </button>

  <button
    class="nav-btn"
    class:active={currentView === 'list'}
    onclick={() => onViewChange('list')}
  >
    <span class="nav-icon"><FileText size={22} /></span>
    <span class="nav-label">Notes</span>
    {#if notesStore.filteredNotes.length > 0}
      <span class="badge">{notesStore.filteredNotes.length}</span>
    {/if}
  </button>

  <button class="nav-btn new-note" onclick={onNewNote}>
    <span class="nav-icon"><Plus size={26} /></span>
  </button>

  <button
    class="nav-btn"
    class:active={currentView === 'editor'}
    onclick={() => onViewChange('editor')}
    disabled={!notesStore.selectedNoteId}
  >
    <span class="nav-icon"><Edit3 size={22} /></span>
    <span class="nav-label">Edit</span>
  </button>

  <button class="nav-btn" onclick={onOpenSettings}>
    <span class="nav-icon"><Settings size={22} /></span>
    <span class="nav-label">Settings</span>
  </button>
</nav>

<style>
  .mobile-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 8px 16px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    justify-content: space-around;
    align-items: center;
    z-index: 100;
  }

  @media (max-width: 768px) {
    .mobile-nav {
      display: flex;
    }
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--text-secondary);
    position: relative;
  }

  .nav-btn:disabled {
    opacity: 0.4;
  }

  .nav-btn.active {
    color: var(--accent);
  }

  .nav-btn.new-note {
    width: 48px;
    height: 48px;
    background: var(--accent);
    color: white;
    border-radius: 50%;
    justify-content: center;
    margin-top: -16px;
    box-shadow: var(--shadow-md);
  }

  .nav-btn.new-note .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-label {
    font-size: 10px;
    font-weight: 500;
  }

  .badge {
    position: absolute;
    top: 0;
    right: 4px;
    background: var(--accent);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
</style>
