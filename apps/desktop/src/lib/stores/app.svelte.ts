/**
 * App Store - Global state (notebooks, tags, theme)
 *
 * Simplified store that consumes Rust commands via Tauri.
 */

import * as api from '$lib/api';
import type { Notebook, Tag } from '$lib/api';

// =============================================================================
// Types
// =============================================================================

type Theme = 'light' | 'dark';

// =============================================================================
// State
// =============================================================================

let notebooks = $state<Notebook[]>([]);
let tags = $state<Tag[]>([]);
let selectedNotebookId = $state<string | null>(null);
let isInitialized = $state(false);

// UI State
let theme = $state<Theme>('light');
let focusMode = $state(false);
let sidebarOpen = $state(true);

// =============================================================================
// Derived State
// =============================================================================

const selectedNotebook = $derived(
  selectedNotebookId ? notebooks.find((n) => n.id === selectedNotebookId) ?? null : null
);

const rootNotebooks = $derived(
  notebooks.filter((n) => n.parent_id === null)
);

// =============================================================================
// Actions
// =============================================================================

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

    // Load data from Rust backend
    notebooks = await api.listNotebooks();
    tags = await api.listTags();

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize app store:', error);
  }
}

// =============================================================================
// Theme Actions
// =============================================================================

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

// =============================================================================
// Notebook Actions
// =============================================================================

async function createNotebook(name: string, parentId: string | null = null) {
  const notebook = await api.createNotebook({
    name,
    parent_id: parentId,
    color: null,
    icon: null,
  });

  notebooks = [...notebooks, notebook].sort((a, b) => a.name.localeCompare(b.name));
  return notebook;
}

async function updateNotebook(id: string, updates: { name?: string; color?: string | null }) {
  const updated = await api.updateNotebook(id, {
    name: updates.name,
    color: updates.color,
  });

  notebooks = notebooks
    .map((n) => (n.id === id ? updated : n))
    .sort((a, b) => a.name.localeCompare(b.name));

  return updated;
}

async function deleteNotebook(id: string) {
  await api.deleteNotebook(id, false);
  notebooks = notebooks.filter((n) => n.id !== id);

  if (selectedNotebookId === id) {
    selectedNotebookId = null;
  }
}

function selectNotebook(id: string | null) {
  selectedNotebookId = id;
}

function getChildNotebooks(parentId: string): Notebook[] {
  return notebooks.filter((n) => n.parent_id === parentId);
}

// =============================================================================
// Tag Actions
// =============================================================================

async function createTag(name: string, color?: string) {
  const tag = await api.createTag({ name, color: color ?? null });
  tags = [...tags, tag].sort((a, b) => a.name.localeCompare(b.name));
  return tag;
}

async function findOrCreateTag(name: string) {
  const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const tag = await api.findOrCreateTag(name);
  if (!tags.find((t) => t.id === tag.id)) {
    tags = [...tags, tag].sort((a, b) => a.name.localeCompare(b.name));
  }
  return tag;
}

async function updateTag(id: string, updates: { name?: string; color?: string | null }) {
  const updated = await api.updateTag(id, {
    name: updates.name,
    color: updates.color,
  });

  tags = tags
    .map((t) => (t.id === id ? updated : t))
    .sort((a, b) => a.name.localeCompare(b.name));

  return updated;
}

async function deleteTag(id: string) {
  await api.deleteTag(id, false);
  tags = tags.filter((t) => t.id !== id);
}

async function mergeTags(sourceId: string, targetId: string) {
  const merged = await api.mergeTags(sourceId, targetId);
  tags = tags.filter((t) => t.id !== sourceId);
  return merged;
}

function getTagById(id: string): Tag | null {
  return tags.find((t) => t.id === id) ?? null;
}

function getTagByName(name: string): Tag | null {
  return tags.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
}

// =============================================================================
// UI Actions
// =============================================================================

function toggleFocusMode() {
  focusMode = !focusMode;
}

function setFocusMode(value: boolean) {
  focusMode = value;
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
}

function setSidebar(value: boolean) {
  sidebarOpen = value;
}

// =============================================================================
// Export Store
// =============================================================================

export const appStore = {
  // State getters
  get notebooks() { return notebooks; },
  get rootNotebooks() { return rootNotebooks; },
  get tags() { return tags; },
  get selectedNotebook() { return selectedNotebook; },
  get selectedNotebookId() { return selectedNotebookId; },
  get isInitialized() { return isInitialized; },
  get theme() { return theme; },
  get focusMode() { return focusMode; },
  get sidebarOpen() { return sidebarOpen; },

  // Actions
  initialize,

  // Theme
  toggleTheme,
  setTheme,

  // Notebooks
  createNotebook,
  updateNotebook,
  deleteNotebook,
  selectNotebook,
  getChildNotebooks,

  // Tags
  createTag,
  findOrCreateTag,
  updateTag,
  deleteTag,
  mergeTags,
  getTagById,
  getTagByName,

  // UI
  toggleFocusMode,
  setFocusMode,
  toggleSidebar,
  setSidebar,
};
