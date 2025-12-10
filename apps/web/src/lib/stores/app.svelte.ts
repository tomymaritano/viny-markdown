// =============================================================================
// App Store - Global state (notebooks, tags, etc.)
// =============================================================================

import type { Notebook, Tag } from '@viny/domain';
import { operationsStore } from './operations.svelte';

// Theme type
type Theme = 'light' | 'dark';

// State
let notebooks = $state<Notebook[]>([]);
let tags = $state<Tag[]>([]);
let selectedNotebookId = $state<string | null>(null); // null = All Notes
let isInitialized = $state(false);
let theme = $state<Theme>('light');
let focusMode = $state(false);
let typewriterMode = $state(false);
let scrollSync = $state(true); // Sync scroll between editor and preview in split view
let wordCountGoal = $state<number | null>(null); // null = no goal set
let sidebarOpen = $state(true); // Mobile sidebar visibility
let mobileShowEditor = $state(false); // Mobile: show editor instead of list

// Derived
const selectedNotebook = $derived(
  selectedNotebookId ? notebooks.find((n) => n.id === selectedNotebookId) ?? null : null
);

// Actions
async function initialize() {
  if (isInitialized) return;

  try {
    // Load theme from localStorage
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('viny-theme') as Theme | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        theme = savedTheme;
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
      }
      applyTheme(theme);
    }

    // Initialize operations store (IndexedDB)
    await operationsStore.initialize();

    const storage = await import('@viny/storage');
    notebooks = await storage.getAllNotebooks();
    tags = await storage.getAllTags();
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize app store:', error);
  }
}

function applyTheme(t: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t);
  }
}

function toggleTheme() {
  theme = theme === 'light' ? 'dark' : 'light';
  if (typeof window !== 'undefined') {
    localStorage.setItem('viny-theme', theme);
  }
  applyTheme(theme);
}

function setTheme(t: Theme) {
  theme = t;
  if (typeof window !== 'undefined') {
    localStorage.setItem('viny-theme', theme);
  }
  applyTheme(theme);
}

function toggleFocusMode() {
  focusMode = !focusMode;
}

function setFocusMode(value: boolean) {
  focusMode = value;
}

function toggleTypewriterMode() {
  typewriterMode = !typewriterMode;
}

function setTypewriterMode(value: boolean) {
  typewriterMode = value;
}

function toggleScrollSync() {
  scrollSync = !scrollSync;
}

function setScrollSync(value: boolean) {
  scrollSync = value;
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
}

function setSidebar(value: boolean) {
  sidebarOpen = value;
}

function setMobileShowEditor(value: boolean) {
  mobileShowEditor = value;
}

function showMobileList() {
  mobileShowEditor = false;
}

function showMobileEditorView() {
  mobileShowEditor = true;
}

function setWordCountGoal(goal: number | null) {
  wordCountGoal = goal;
}

function clearWordCountGoal() {
  wordCountGoal = null;
}

async function createNotebook(name: string, parentId: string | null = null) {
  const storage = await import('@viny/storage');
  const notebook = await storage.createNotebook({ name, parentId });
  notebooks = [...notebooks, notebook].sort((a, b) => a.name.localeCompare(b.name));

  // Log operation for sync
  await operationsStore.logNotebookCreated(notebook.id, {
    name: notebook.name,
    parentId: notebook.parentId,
  });

  return notebook;
}

async function updateNotebook(id: string, updates: { name?: string; color?: string | null }) {
  const storage = await import('@viny/storage');
  const updated = await storage.updateNotebook(id, updates);
  if (updated) {
    notebooks = notebooks
      .map((n) => (n.id === id ? updated : n))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Log operation for sync
    const affectedFields: Array<'name' | 'color' | 'icon'> = [];
    if (updates.name !== undefined) affectedFields.push('name');
    if (updates.color !== undefined) affectedFields.push('color');
    await operationsStore.logNotebookUpdated(id, {
      name: updates.name,
      color: updates.color,
      affectedFields,
    });
  }
  return updated;
}

async function deleteNotebook(id: string) {
  const storage = await import('@viny/storage');
  await storage.deleteNotebook(id);
  notebooks = notebooks.filter((n) => n.id !== id);

  // Log operation for sync
  await operationsStore.logNotebookDeleted(id);

  if (selectedNotebookId === id) {
    selectedNotebookId = null;
  }
}

function selectNotebook(id: string | null) {
  selectedNotebookId = id;
}

function getNotebookNoteCount(notebookId: string): number {
  // This will be called from UI, need to import storage
  return 0; // Placeholder - will be computed in component
}

// Tag actions
async function findOrCreateTag(name: string) {
  const storage = await import('@viny/storage');
  const existingTag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const tag = await storage.findOrCreateTag(name);

  // Add to list if new and log operation
  if (!existingTag) {
    tags = [...tags, tag].sort((a, b) => a.name.localeCompare(b.name));

    // Log operation for sync (only if newly created)
    await operationsStore.logTagCreated(tag.id, {
      name: tag.name,
      color: tag.color,
    });
  }
  return tag;
}

async function deleteTag(id: string) {
  const storage = await import('@viny/storage');
  await storage.deleteTag(id);
  tags = tags.filter((t) => t.id !== id);

  // Log operation for sync
  await operationsStore.logTagDeleted(id);
}

async function renameTag(id: string, newName: string) {
  const storage = await import('@viny/storage');
  const updated = await storage.updateTag(id, { name: newName });
  if (updated) {
    tags = tags
      .map((t) => (t.id === id ? updated : t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return updated;
}

async function mergeTags(sourceTagIds: string[], targetTagId: string) {
  // Get all notes with source tags
  const { notesStore } = await import('./notes.svelte');

  for (const note of notesStore.allNotes) {
    const hasSourceTag = note.tags.some(tagId => sourceTagIds.includes(tagId));
    if (hasSourceTag) {
      // Remove source tags and add target tag if not already present
      const newTags = note.tags.filter(tagId => !sourceTagIds.includes(tagId));
      if (!newTags.includes(targetTagId)) {
        newTags.push(targetTagId);
      }
      await notesStore.updateNoteTags(note.id, newTags);
    }
  }

  // Delete source tags
  for (const tagId of sourceTagIds) {
    await deleteTag(tagId);
  }
}

function getTagById(id: string): Tag | null {
  return tags.find((t) => t.id === id) ?? null;
}

// Export store
export const appStore = {
  get notebooks() {
    return notebooks;
  },
  get tags() {
    return tags;
  },
  get selectedNotebook() {
    return selectedNotebook;
  },
  get selectedNotebookId() {
    return selectedNotebookId;
  },
  get isInitialized() {
    return isInitialized;
  },
  get theme() {
    return theme;
  },
  get focusMode() {
    return focusMode;
  },
  get typewriterMode() {
    return typewriterMode;
  },
  get scrollSync() {
    return scrollSync;
  },
  get wordCountGoal() {
    return wordCountGoal;
  },
  get sidebarOpen() {
    return sidebarOpen;
  },
  get mobileShowEditor() {
    return mobileShowEditor;
  },
  initialize,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  selectNotebook,
  findOrCreateTag,
  deleteTag,
  renameTag,
  mergeTags,
  getTagById,
  toggleTheme,
  setTheme,
  toggleFocusMode,
  setFocusMode,
  toggleTypewriterMode,
  setTypewriterMode,
  toggleScrollSync,
  setScrollSync,
  setWordCountGoal,
  clearWordCountGoal,
  toggleSidebar,
  setSidebar,
  setMobileShowEditor,
  showMobileList,
  showMobileEditorView,
};
