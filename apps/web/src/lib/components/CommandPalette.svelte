<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import {
    Search, FileText, Calendar, Dice5, Moon, Sun, Target, PanelLeft,
    Network, Timer, BarChart3, Tag, BookOpen, Zap, FileStack, CalendarDays,
    ListTree, Link, History, Info, Trash2, Archive, Folder, File
  } from 'lucide-svelte';
  import type { ComponentType } from 'svelte';

  // Icon mapping for commands
  const iconMap: Record<string, ComponentType> = {
    'new-note': FileText,
    'daily-note': Calendar,
    'random-note': Dice5,
    'toggle-theme-dark': Moon,
    'toggle-theme-light': Sun,
    'toggle-focus': Target,
    'toggle-sidebar': PanelLeft,
    'open-graph': Network,
    'focus-timer': Timer,
    'writing-stats': BarChart3,
    'tag-manager': Tag,
    'notebook-manager': BookOpen,
    'quick-switcher': Zap,
    'template-manager': FileStack,
    'note-calendar': CalendarDays,
    'note-outline': ListTree,
    'backlinks': Link,
    'word-count-goal': Target,
    'version-history': History,
    'note-info': Info,
    'nav-all-notes': FileText,
    'nav-trash': Trash2,
    'nav-archive': Archive,
    'notebook': Folder,
    'note': File,
    'template': FileStack,
  };

  interface Props {
    open: boolean;
    onClose: () => void;
    onOpenGraph?: () => void;
    onOpenFocusTimer?: () => void;
    onOpenWritingStats?: () => void;
    onOpenTagManager?: () => void;
    onOpenNotebookManager?: () => void;
    onOpenQuickSwitcher?: () => void;
    onOpenTemplateManager?: () => void;
    onOpenNoteCalendar?: () => void;
    onOpenNoteOutline?: () => void;
    onOpenBacklinks?: () => void;
    onOpenWordCountGoal?: () => void;
    onOpenVersionHistory?: () => void;
    onOpenNoteInfo?: () => void;
  }

  let { open, onClose, onOpenGraph, onOpenFocusTimer, onOpenWritingStats, onOpenTagManager, onOpenNotebookManager, onOpenQuickSwitcher, onOpenTemplateManager, onOpenNoteCalendar, onOpenNoteOutline, onOpenBacklinks, onOpenWordCountGoal, onOpenVersionHistory, onOpenNoteInfo }: Props = $props();

  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement;

  // Command types
  type CommandType = 'action' | 'template' | 'note' | 'notebook' | 'navigation';

  interface Command {
    id: string;
    type: CommandType;
    label: string;
    description?: string;
    icon: string;
    action: () => void;
    keywords?: string[];
  }

  // Build command list
  const commands = $derived.by(() => {
    const cmds: Command[] = [];

    // Actions
    cmds.push({
      id: 'new-note',
      type: 'action',
      label: 'New Note',
      description: 'Create a new note',
      icon: '📝',
      action: () => {
        notesStore.createNote();
        onClose();
      },
      keywords: ['create', 'add'],
    });

    cmds.push({
      id: 'daily-note',
      type: 'action',
      label: 'Daily Note',
      description: "Open today's note",
      icon: '📅',
      action: () => {
        notesStore.openDailyNote();
        onClose();
      },
      keywords: ['today', 'journal'],
    });

    cmds.push({
      id: 'random-note',
      type: 'action',
      label: 'Random Note',
      description: 'Open a random note for rediscovery',
      icon: '🎲',
      action: () => {
        notesStore.openRandomNote();
        onClose();
      },
      keywords: ['random', 'surprise', 'discover', 'serendipity'],
    });

    cmds.push({
      id: 'toggle-theme',
      type: 'action',
      label: appStore.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      description: 'Toggle between light and dark theme',
      icon: appStore.theme === 'light' ? '🌙' : '☀️',
      action: () => {
        appStore.toggleTheme();
        onClose();
      },
      keywords: ['dark', 'light', 'theme'],
    });

    cmds.push({
      id: 'toggle-focus',
      type: 'action',
      label: appStore.focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode',
      description: 'Toggle distraction-free writing',
      icon: '🎯',
      action: () => {
        appStore.toggleFocusMode();
        onClose();
      },
      keywords: ['zen', 'distraction'],
    });

    cmds.push({
      id: 'toggle-sidebar',
      type: 'action',
      label: appStore.sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar',
      icon: '📋',
      action: () => {
        appStore.toggleSidebar();
        onClose();
      },
      keywords: ['panel'],
    });

    cmds.push({
      id: 'open-graph',
      type: 'action',
      label: 'Open Graph View',
      description: 'View all notes and connections',
      icon: '🕸️',
      action: () => {
        onClose();
        onOpenGraph?.();
      },
      keywords: ['graph', 'connections', 'links', 'network'],
    });

    cmds.push({
      id: 'focus-timer',
      type: 'action',
      label: 'Focus Timer',
      description: 'Start a Pomodoro timer for focused work',
      icon: '⏱️',
      action: () => {
        onClose();
        onOpenFocusTimer?.();
      },
      keywords: ['pomodoro', 'timer', 'focus', 'productivity', 'break'],
    });

    cmds.push({
      id: 'writing-stats',
      type: 'action',
      label: 'Writing Statistics',
      description: 'View your writing activity and streaks',
      icon: '📊',
      action: () => {
        onClose();
        onOpenWritingStats?.();
      },
      keywords: ['stats', 'statistics', 'activity', 'streak', 'words', 'progress'],
    });

    cmds.push({
      id: 'tag-manager',
      type: 'action',
      label: 'Tag Manager',
      description: 'Rename, merge, and delete tags',
      icon: '🏷️',
      action: () => {
        onClose();
        onOpenTagManager?.();
      },
      keywords: ['tags', 'labels', 'manage', 'rename', 'merge', 'delete'],
    });

    cmds.push({
      id: 'notebook-manager',
      type: 'action',
      label: 'Notebook Manager',
      description: 'Rename, merge, and delete notebooks',
      icon: '📚',
      action: () => {
        onClose();
        onOpenNotebookManager?.();
      },
      keywords: ['notebooks', 'folders', 'manage', 'rename', 'merge', 'delete', 'organize'],
    });

    cmds.push({
      id: 'quick-switcher',
      type: 'action',
      label: 'Quick Switcher',
      description: 'Quickly switch between recent notes',
      icon: '⚡',
      action: () => {
        onClose();
        onOpenQuickSwitcher?.();
      },
      keywords: ['switch', 'recent', 'open', 'find', 'navigate', 'jump'],
    });

    cmds.push({
      id: 'template-manager',
      type: 'action',
      label: 'Template Manager',
      description: 'View and manage note templates',
      icon: '📋',
      action: () => {
        onClose();
        onOpenTemplateManager?.();
      },
      keywords: ['templates', 'manage', 'create', 'custom'],
    });

    cmds.push({
      id: 'note-calendar',
      type: 'action',
      label: 'Note Calendar',
      description: 'Browse notes by date',
      icon: '📆',
      action: () => {
        onClose();
        onOpenNoteCalendar?.();
      },
      keywords: ['calendar', 'date', 'timeline', 'history', 'browse'],
    });

    cmds.push({
      id: 'note-outline',
      type: 'action',
      label: 'Note Outline',
      description: 'View headings and navigate',
      icon: '📑',
      action: () => {
        onClose();
        onOpenNoteOutline?.();
      },
      keywords: ['outline', 'headings', 'toc', 'table of contents', 'structure', 'navigate'],
    });

    cmds.push({
      id: 'backlinks',
      type: 'action',
      label: 'Backlinks',
      description: 'View notes linking to this note',
      icon: '🔗',
      action: () => {
        onClose();
        onOpenBacklinks?.();
      },
      keywords: ['backlinks', 'links', 'references', 'connections', 'incoming'],
    });

    cmds.push({
      id: 'word-count-goal',
      type: 'action',
      label: 'Daily Word Goal',
      description: 'Set and track daily writing targets',
      icon: '🎯',
      action: () => {
        onClose();
        onOpenWordCountGoal?.();
      },
      keywords: ['word', 'count', 'goal', 'target', 'daily', 'writing', 'progress'],
    });

    cmds.push({
      id: 'version-history',
      type: 'action',
      label: 'Version History',
      description: 'View and restore previous versions',
      icon: '📜',
      action: () => {
        onClose();
        onOpenVersionHistory?.();
      },
      keywords: ['version', 'history', 'restore', 'previous', 'undo', 'revert'],
    });

    cmds.push({
      id: 'note-info',
      type: 'action',
      label: 'Note Info',
      description: 'View note statistics and metadata',
      icon: 'ℹ️',
      action: () => {
        onClose();
        onOpenNoteInfo?.();
      },
      keywords: ['info', 'statistics', 'stats', 'metadata', 'details', 'word count'],
    });

    // Templates
    const templates = notesStore.getTemplates();
    for (const template of templates) {
      cmds.push({
        id: `template-${template.id}`,
        type: 'template',
        label: `New ${template.name}`,
        description: `Create from ${template.name.toLowerCase()} template`,
        icon: template.icon,
        action: async () => {
          await notesStore.createNoteFromTemplate(template.id);
          onClose();
        },
        keywords: ['template', template.name.toLowerCase()],
      });
    }

    // Navigation
    cmds.push({
      id: 'nav-all-notes',
      type: 'navigation',
      label: 'All Notes',
      description: 'View all notes',
      icon: '📝',
      action: () => {
        notesStore.setViewingTrash(false);
        notesStore.setNotebook(null);
        onClose();
      },
    });

    cmds.push({
      id: 'nav-trash',
      type: 'navigation',
      label: 'Trash',
      description: 'View deleted notes',
      icon: '🗑',
      action: () => {
        notesStore.setViewingTrash(true);
        onClose();
      },
    });

    cmds.push({
      id: 'nav-archive',
      type: 'navigation',
      label: 'Archive',
      description: 'View archived notes',
      icon: '📦',
      action: () => {
        notesStore.setViewingArchive(true);
        onClose();
      },
    });

    // Notebooks
    for (const notebook of appStore.notebooks) {
      cmds.push({
        id: `notebook-${notebook.id}`,
        type: 'notebook',
        label: notebook.name,
        description: 'Open notebook',
        icon: '📁',
        action: () => {
          notesStore.setViewingTrash(false);
          notesStore.setNotebook(notebook.id);
          onClose();
        },
      });
    }

    // Notes (limit to recent or search results)
    const notesToShow = searchQuery.trim()
      ? notesStore.allNotes.filter(
          (n) =>
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : notesStore.recentNotes;

    for (const note of notesToShow.slice(0, 10)) {
      cmds.push({
        id: `note-${note.id}`,
        type: 'note',
        label: note.title || 'Untitled',
        description: note.content.slice(0, 50) + (note.content.length > 50 ? '...' : ''),
        icon: '📄',
        action: () => {
          notesStore.setViewingTrash(false);
          notesStore.selectNote(note.id);
          onClose();
        },
      });
    }

    return cmds;
  });

  // Filter commands based on search
  const filteredCommands = $derived.by(() => {
    if (!searchQuery.trim()) {
      return commands;
    }

    const query = searchQuery.toLowerCase();
    return commands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(query);
      const matchDesc = cmd.description?.toLowerCase().includes(query);
      const matchKeywords = cmd.keywords?.some((k) => k.includes(query));
      return matchLabel || matchDesc || matchKeywords;
    });
  });

  // Group commands by type for display
  const groupedCommands = $derived.by(() => {
    const groups: Record<CommandType, Command[]> = {
      action: [],
      template: [],
      navigation: [],
      notebook: [],
      note: [],
    };

    for (const cmd of filteredCommands) {
      groups[cmd.type].push(cmd);
    }

    return groups;
  });

  // Flat list for keyboard navigation
  const flatCommands = $derived(() => {
    return [
      ...groupedCommands.action,
      ...groupedCommands.template,
      ...groupedCommands.navigation,
      ...groupedCommands.notebook,
      ...groupedCommands.note,
    ];
  });

  // Reset selection when search changes
  $effect(() => {
    searchQuery;
    selectedIndex = 0;
  });

  // Focus input when opened
  $effect(() => {
    if (open && inputRef) {
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  // Reset on close
  $effect(() => {
    if (!open) {
      searchQuery = '';
      selectedIndex = 0;
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    const cmds = flatCommands();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, cmds.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (cmds[selectedIndex]) {
          cmds[selectedIndex].action();
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }

  function getTypeLabel(type: CommandType): string {
    switch (type) {
      case 'action':
        return 'Actions';
      case 'template':
        return 'Templates';
      case 'navigation':
        return 'Navigation';
      case 'notebook':
        return 'Notebooks';
      case 'note':
        return 'Notes';
    }
  }

  function getCommandIndex(cmd: Command): number {
    return flatCommands().findIndex((c) => c.id === cmd.id);
  }

  function getIconComponent(cmd: Command): ComponentType | null {
    // Check for specific command ID first
    if (iconMap[cmd.id]) return iconMap[cmd.id];

    // Check by type for generic icons
    if (cmd.type === 'notebook') return Folder;
    if (cmd.type === 'note') return File;
    if (cmd.type === 'template') return FileStack;

    // Theme toggle needs special handling
    if (cmd.id === 'toggle-theme') {
      return appStore.theme === 'light' ? Moon : Sun;
    }

    return null;
  }
</script>

{#if open}
  <div class="overlay" onclick={onClose} onkeydown={handleKeydown} role="presentation">
    <div class="palette" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="search-container">
        <span class="search-icon"><Search size={16} /></span>
        <input
          bind:this={inputRef}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="search-input"
          onkeydown={handleKeydown}
        />
        <kbd class="shortcut">ESC</kbd>
      </div>

      <div class="results">
        {#if filteredCommands.length === 0}
          <div class="empty">No results found</div>
        {:else}
          {#each ['action', 'template', 'navigation', 'notebook', 'note'] as type}
            {#if groupedCommands[type as CommandType].length > 0}
              <div class="group">
                <div class="group-label">{getTypeLabel(type as CommandType)}</div>
                {#each groupedCommands[type as CommandType] as cmd (cmd.id)}
                  {@const IconComponent = getIconComponent(cmd)}
                  <button
                    class="command"
                    class:selected={getCommandIndex(cmd) === selectedIndex}
                    onclick={cmd.action}
                    onmouseenter={() => (selectedIndex = getCommandIndex(cmd))}
                  >
                    <span class="command-icon">
                      {#if IconComponent}
                        <IconComponent size={18} />
                      {:else}
                        {cmd.icon}
                      {/if}
                    </span>
                    <div class="command-content">
                      <span class="command-label">{cmd.label}</span>
                      {#if cmd.description}
                        <span class="command-desc">{cmd.description}</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <div class="footer">
        <span class="hint"><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
        <span class="hint"><kbd>↵</kbd> to select</span>
        <span class="hint"><kbd>esc</kbd> to close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 9999;
    backdrop-filter: blur(2px);
  }

  .palette {
    width: 90%;
    max-width: 560px;
    background: var(--bg-primary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .search-icon {
    font-size: 16px;
    opacity: 0.5;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary, #e0e0e0);
    font-size: 16px;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-secondary, #888);
  }

  .shortcut {
    padding: 4px 8px;
    background: var(--bg-secondary, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-family: inherit;
  }

  .results {
    max-height: 400px;
    overflow-y: auto;
    padding: 8px;
  }

  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-secondary, #888);
    font-size: 14px;
  }

  .group {
    margin-bottom: 8px;
  }

  .group-label {
    padding: 8px 12px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary, #666);
    letter-spacing: 0.5px;
  }

  .command {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .command:hover,
  .command.selected {
    background: var(--bg-hover, #2a2a2a);
  }

  .command.selected {
    background: var(--accent-color, #007aff);
  }

  .command-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .command-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .command-label {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-desc {
    font-size: 12px;
    color: var(--text-secondary, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command.selected .command-desc {
    color: rgba(255, 255, 255, 0.7);
  }

  .footer {
    display: flex;
    gap: 16px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #151515);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-secondary, #666);
  }

  .hint kbd {
    padding: 2px 6px;
    background: var(--bg-primary, #2a2a2a);
    border: 1px solid var(--border-color, #444);
    border-radius: 3px;
    font-size: 10px;
    font-family: inherit;
  }

  /* Light theme overrides */
  :global([data-theme='light']) .palette {
    background: #fff;
    border-color: #e0e0e0;
  }

  :global([data-theme='light']) .search-container {
    border-color: #e0e0e0;
  }

  :global([data-theme='light']) .search-input {
    color: #333;
  }

  :global([data-theme='light']) .command {
    color: #333;
  }

  :global([data-theme='light']) .command:hover,
  :global([data-theme='light']) .command.selected {
    background: #f0f0f0;
  }

  :global([data-theme='light']) .command.selected {
    background: #007aff;
    color: #fff;
  }

  :global([data-theme='light']) .footer {
    background: #f8f8f8;
    border-color: #e0e0e0;
  }
</style>
