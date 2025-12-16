/**
 * Notes Store (Svelte 5 Runes) - Desktop Version
 *
 * Simplified store that consumes Rust commands via Tauri.
 * All data operations go through the API layer.
 */

import * as api from '$lib/api';
import type { Note, NoteStatus, ListNotesFilter } from '$lib/api';
import { addWordsWritten, incrementNotesEdited } from '$lib/writingStats';

// =============================================================================
// Types
// =============================================================================

type SortBy = 'updatedAt' | 'createdAt' | 'title';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'card';

// =============================================================================
// State
// =============================================================================

let notes = $state<Note[]>([]);
let trashedNotes = $state<Note[]>([]);
let archivedNotes = $state<Note[]>([]);
let selectedNoteId = $state<string | null>(null);
let selectedNotebookId = $state<string | null>(null);
let viewingTrash = $state(false);
let viewingArchived = $state(false);
let showingStarred = $state(false);

let searchQuery = $state('');
let filterByTagId = $state<string | null>(null);
let sortBy = $state<SortBy>('updatedAt');
let sortOrder = $state<SortOrder>('desc');
let viewMode = $state<ViewMode>('list');

let isLoading = $state(false);
let isInitialized = $state(false);

// Starred notes (stored in localStorage)
let starredIds = $state<Set<string>>(new Set());

// Navigation history
let navigationHistory = $state<string[]>([]);
let historyIndex = $state(-1);
let isNavigating = $state(false);

// Version history (stored in localStorage)
export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  timestamp: string;
}

let noteVersions = $state<Map<string, NoteVersion[]>>(new Map());
const MAX_VERSIONS_PER_NOTE = 20;
const VERSION_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastVersionSaved = $state<Map<string, number>>(new Map());

// Load versions from localStorage
function loadVersions() {
  try {
    const stored = localStorage.getItem('viny_note_versions');
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, NoteVersion[]>;
      noteVersions = new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error('Failed to load note versions:', e);
  }
}

function saveVersionsToStorage() {
  try {
    const obj: Record<string, NoteVersion[]> = {};
    noteVersions.forEach((versions, noteId) => {
      obj[noteId] = versions;
    });
    localStorage.setItem('viny_note_versions', JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save note versions:', e);
  }
}

function saveNoteVersion(note: Note, force = false) {
  const now = Date.now();
  const lastSaved = lastVersionSaved.get(note.id) || 0;

  // Only save if forced or enough time has passed
  if (!force && now - lastSaved < VERSION_SAVE_INTERVAL) {
    return;
  }

  const existingVersions = noteVersions.get(note.id) || [];

  // Skip if content hasn't changed from last version
  if (existingVersions.length > 0) {
    const lastVersion = existingVersions[0];
    if (lastVersion.content === note.content && lastVersion.title === note.title) {
      return;
    }
  }

  const newVersion: NoteVersion = {
    id: crypto.randomUUID(),
    noteId: note.id,
    title: note.title,
    content: note.content,
    timestamp: new Date().toISOString(),
  };

  // Add new version at the beginning, limit to MAX_VERSIONS_PER_NOTE
  const updatedVersions = [newVersion, ...existingVersions].slice(0, MAX_VERSIONS_PER_NOTE);
  noteVersions.set(note.id, updatedVersions);
  lastVersionSaved.set(note.id, now);

  saveVersionsToStorage();
}

function getNoteVersions(noteId: string): NoteVersion[] {
  return noteVersions.get(noteId) || [];
}

function deleteNoteVersions(noteId: string) {
  noteVersions.delete(noteId);
  lastVersionSaved.delete(noteId);
  saveVersionsToStorage();
}

// Load starred from localStorage
function loadStarred() {
  try {
    const stored = localStorage.getItem('viny_starred_notes');
    if (stored) {
      starredIds = new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Failed to load starred notes:', e);
  }
}

function saveStarred() {
  try {
    localStorage.setItem('viny_starred_notes', JSON.stringify([...starredIds]));
  } catch (e) {
    console.error('Failed to save starred notes:', e);
  }
}

function toggleStar(noteId: string) {
  const newSet = new Set(starredIds);
  if (newSet.has(noteId)) {
    newSet.delete(noteId);
  } else {
    newSet.add(noteId);
  }
  starredIds = newSet;
  saveStarred();
}

function isStarred(noteId: string): boolean {
  return starredIds.has(noteId);
}

// =============================================================================
// Derived State
// =============================================================================

const starredNotes = $derived(() => {
  return notes.filter(n => starredIds.has(n.id));
});

const recentNotes = $derived(() => {
  return [...notes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);
});

const filteredNotes = $derived(() => {
  let result = notes;

  // Filter by starred first (highest priority)
  if (showingStarred) {
    result = result.filter((n) => starredIds.has(n.id));
  }

  // Filter by notebook
  if (selectedNotebookId !== null) {
    result = result.filter((n) => n.notebook_id === selectedNotebookId);
  }

  // Filter by tag
  if (filterByTagId) {
    result = result.filter((n) => n.tags.includes(filterByTagId!));
  }

  // Filter by search
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  }

  // Sort
  return [...result].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else {
      comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
});

const selectedNote = $derived(
  selectedNoteId ? notes.find((n) => n.id === selectedNoteId) ?? null : null
);

const pinnedNotes = $derived(filteredNotes().filter((n) => n.is_pinned));
const unpinnedNotes = $derived(filteredNotes().filter((n) => !n.is_pinned));

// =============================================================================
// Actions
// =============================================================================

async function initialize() {
  if (isInitialized) return;
  isLoading = true;

  try {
    // Restore preferences from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedViewMode = localStorage.getItem('viny-view-mode');
      if (savedViewMode === 'list' || savedViewMode === 'card') {
        viewMode = savedViewMode;
      }
      const savedSortBy = localStorage.getItem('viny-sort-by');
      if (savedSortBy === 'updatedAt' || savedSortBy === 'createdAt' || savedSortBy === 'title') {
        sortBy = savedSortBy;
      }
      const savedSortOrder = localStorage.getItem('viny-sort-order');
      if (savedSortOrder === 'asc' || savedSortOrder === 'desc') {
        sortOrder = savedSortOrder;
      }
    }

    // Load starred from localStorage
    loadStarred();

    // Load version history from localStorage
    loadVersions();

    // Load notes from Rust backend
    notes = await api.listNotes({ status: 'active' as NoteStatus });
    trashedNotes = await api.getTrashedNotes();
    archivedNotes = await api.listNotes({ status: 'archived' as NoteStatus });

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize notes store:', error);
  } finally {
    isLoading = false;
  }
}

async function createNote(input: { title?: string; content?: string } = {}) {
  const note = await api.createNote({
    title: input.title,
    content: input.content,
    notebook_id: selectedNotebookId,
    tags: [],
  });

  notes = [note, ...notes];
  selectedNoteId = note.id;
  searchQuery = '';

  return note;
}

async function updateNote(id: string, updates: {
  title?: string;
  content?: string;
  tags?: string[];
  notebook_id?: string | null;
  status?: NoteStatus;
  is_pinned?: boolean;
}) {
  // Save version before updating
  const currentNote = notes.find((n) => n.id === id);
  if (currentNote) {
    saveNoteVersion(currentNote);
  }

  // Track writing stats for content changes
  if (updates.content !== undefined && currentNote) {
    const oldWords = currentNote.content.split(/\s+/).filter(w => w.length > 0).length;
    const newWords = updates.content.split(/\s+/).filter(w => w.length > 0).length;
    const wordsDiff = newWords - oldWords;
    if (wordsDiff > 0) {
      addWordsWritten(wordsDiff);
    }
    incrementNotesEdited();
  }

  const updated = await api.updateNote(id, {
    title: updates.title,
    content: updates.content,
    tags: updates.tags,
    notebook_id: updates.notebook_id,
    status: updates.status,
    is_pinned: updates.is_pinned,
  });

  notes = notes.map((n) => (n.id === id ? updated : n));
  return updated;
}

async function deleteNote(id: string) {
  await api.deleteNote(id, false); // soft delete

  const note = notes.find((n) => n.id === id);
  notes = notes.filter((n) => n.id !== id);

  if (note) {
    trashedNotes = [{ ...note, deleted_at: new Date().toISOString() }, ...trashedNotes];
  }

  if (selectedNoteId === id) {
    selectedNoteId = filteredNotes()[0]?.id ?? null;
  }
}

async function restoreNote(id: string) {
  const restored = await api.restoreNote(id);

  trashedNotes = trashedNotes.filter((n) => n.id !== id);
  notes = [restored, ...notes];

  return restored;
}

async function permanentlyDeleteNote(id: string) {
  await api.deleteNote(id, true); // hard delete
  trashedNotes = trashedNotes.filter((n) => n.id !== id);
}

async function togglePin(id: string) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  const updated = await api.updateNote(id, { is_pinned: !note.is_pinned });
  notes = notes.map((n) => (n.id === id ? updated : n));
}

async function moveNote(id: string, toNotebookId: string | null) {
  const updated = await api.updateNote(id, { notebook_id: toNotebookId });
  notes = notes.map((n) => (n.id === id ? updated : n));
  return updated;
}

async function addTag(noteId: string, tagName: string) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  const newTags = [...note.tags, tagName];
  const updated = await api.updateNote(noteId, { tags: newTags });
  notes = notes.map((n) => (n.id === noteId ? updated : n));
  return updated;
}

async function removeTag(noteId: string, tagName: string) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  const newTags = note.tags.filter((t) => t !== tagName);
  const updated = await api.updateNote(noteId, { tags: newTags });
  notes = notes.map((n) => (n.id === noteId ? updated : n));
  return updated;
}

async function archiveNote(id: string) {
  const updated = await api.updateNote(id, { status: 'archived' as NoteStatus });
  const note = notes.find((n) => n.id === id);
  notes = notes.filter((n) => n.id !== id);

  if (note) {
    archivedNotes = [updated, ...archivedNotes];
  }

  if (selectedNoteId === id) {
    selectedNoteId = filteredNotes()[0]?.id ?? null;
  }

  return updated;
}

async function unarchiveNote(id: string) {
  const updated = await api.updateNote(id, { status: 'active' as NoteStatus });
  archivedNotes = archivedNotes.filter((n) => n.id !== id);
  notes = [updated, ...notes];
  return updated;
}

async function emptyTrash() {
  for (const note of trashedNotes) {
    await api.deleteNote(note.id, true);
  }
  trashedNotes = [];
}

// =============================================================================
// UI State Actions
// =============================================================================

function selectNote(id: string | null) {
  // Track navigation history
  if (id && !isNavigating && id !== selectedNoteId) {
    // If we're not at the end of history, truncate forward history
    if (historyIndex < navigationHistory.length - 1) {
      navigationHistory = navigationHistory.slice(0, historyIndex + 1);
    }
    navigationHistory = [...navigationHistory, id];
    historyIndex = navigationHistory.length - 1;

    // Limit history size
    if (navigationHistory.length > 50) {
      navigationHistory = navigationHistory.slice(-50);
      historyIndex = navigationHistory.length - 1;
    }
  }

  selectedNoteId = id;
  isNavigating = false;
}

function canGoBack(): boolean {
  return historyIndex > 0;
}

function canGoForward(): boolean {
  return historyIndex < navigationHistory.length - 1;
}

function goBack() {
  if (!canGoBack()) return;
  isNavigating = true;
  historyIndex--;
  selectedNoteId = navigationHistory[historyIndex];
}

function goForward() {
  if (!canGoForward()) return;
  isNavigating = true;
  historyIndex++;
  selectedNoteId = navigationHistory[historyIndex];
}

function selectNextNote() {
  const notesList = notes;
  if (notesList.length === 0) return;

  const currentIndex = notesList.findIndex(n => n.id === selectedNoteId);
  if (currentIndex === -1) {
    selectNote(notesList[0].id);
  } else if (currentIndex < notesList.length - 1) {
    selectNote(notesList[currentIndex + 1].id);
  }
}

function selectPreviousNote() {
  const notesList = notes;
  if (notesList.length === 0) return;

  const currentIndex = notesList.findIndex(n => n.id === selectedNoteId);
  if (currentIndex === -1) {
    selectNote(notesList[0].id);
  } else if (currentIndex > 0) {
    selectNote(notesList[currentIndex - 1].id);
  }
}

function selectFirstNote() {
  const notesList = notes;
  if (notesList.length > 0) {
    selectNote(notesList[0].id);
  }
}

function selectLastNote() {
  const notesList = notes;
  if (notesList.length > 0) {
    selectNote(notesList[notesList.length - 1].id);
  }
}

function setNotebook(notebookId: string | null) {
  selectedNotebookId = notebookId;
  if (selectedNoteId) {
    const note = notes.find((n) => n.id === selectedNoteId);
    if (note && notebookId !== null && note.notebook_id !== notebookId) {
      selectedNoteId = null;
    }
  }
}

function setViewingTrash(value: boolean) {
  viewingTrash = value;
  viewingArchived = false;
  showingStarred = false;
  selectedNoteId = null;
  if (value) {
    selectedNotebookId = null;
  }
}

function setViewingArchived(value: boolean) {
  viewingArchived = value;
  viewingTrash = false;
  showingStarred = false;
  selectedNoteId = null;
  if (value) {
    selectedNotebookId = null;
  }
}

function setShowingStarred(value: boolean) {
  showingStarred = value;
  viewingTrash = false;
  viewingArchived = false;
  if (value) {
    selectedNotebookId = null;
    filterByTagId = null;
  }
}

function setSearchQuery(query: string) {
  searchQuery = query;
}

function setTagFilter(tagId: string | null) {
  filterByTagId = tagId;
}

function clearTagFilter() {
  filterByTagId = null;
}

function setSort(by: SortBy, order: SortOrder) {
  sortBy = by;
  sortOrder = order;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-sort-by', by);
    localStorage.setItem('viny-sort-order', order);
  }
}

function setViewMode(mode: ViewMode) {
  viewMode = mode;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-view-mode', mode);
  }
}

function toggleViewMode() {
  setViewMode(viewMode === 'list' ? 'card' : 'list');
}

// =============================================================================
// Backlinks
// =============================================================================

/**
 * Get all notes that link to a given note (by title)
 */
function getBacklinks(noteTitle: string): Note[] {
  if (!noteTitle) return [];

  const titleLower = noteTitle.toLowerCase();
  const linkPattern = new RegExp(`\\[\\[${escapeRegex(titleLower)}\\]\\]`, 'i');

  return notes.filter(note => {
    // Check if note content contains a wiki link to the target note
    return linkPattern.test(note.content.toLowerCase());
  });
}

/**
 * Get all notes that the given note links to
 */
function getOutgoingLinks(noteId: string): Note[] {
  const note = notes.find(n => n.id === noteId);
  if (!note) return [];

  // Extract wiki links from content
  const linkMatches = note.content.match(/\[\[([^\]]+)\]\]/g);
  if (!linkMatches) return [];

  const linkedTitles = linkMatches.map(m => m.slice(2, -2).toLowerCase());

  return notes.filter(n =>
    linkedTitles.includes(n.title.toLowerCase()) && n.id !== noteId
  );
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Export Store
// =============================================================================

export const notesStore = {
  // State getters
  get notes() { return filteredNotes(); },
  get allNotes() { return notes; },
  get trashedNotes() { return trashedNotes; },
  get archivedNotes() { return archivedNotes; },
  get filteredNotes() { return filteredNotes(); },
  get selectedNote() { return selectedNote; },
  get selectedNoteId() { return selectedNoteId; },
  get selectedNotebookId() { return selectedNotebookId; },
  get viewingTrash() { return viewingTrash; },
  get viewingArchived() { return viewingArchived; },
  get showingStarred() { return showingStarred; },
  get pinnedNotes() { return pinnedNotes; },
  get unpinnedNotes() { return unpinnedNotes; },
  get starredNotes() { return starredNotes(); },
  get recentNotes() { return recentNotes(); },
  get searchQuery() { return searchQuery; },
  get filterByTagId() { return filterByTagId; },
  get sortBy() { return sortBy; },
  get sortOrder() { return sortOrder; },
  get viewMode() { return viewMode; },
  get isLoading() { return isLoading; },
  get isInitialized() { return isInitialized; },

  // Actions
  initialize,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  togglePin,
  moveNote,
  addTag,
  removeTag,
  archiveNote,
  unarchiveNote,
  emptyTrash,

  // Starred
  toggleStar,
  isStarred,

  // Version history
  getNoteVersions,
  saveNoteVersion,
  deleteNoteVersions,

  // Navigation history
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  selectNextNote,
  selectPreviousNote,
  selectFirstNote,
  selectLastNote,

  // UI State
  selectNote,
  setNotebook,
  setViewingTrash,
  setViewingArchived,
  setShowingStarred,
  setSearchQuery,
  setTagFilter,
  clearTagFilter,
  setSort,
  setViewMode,
  toggleViewMode,

  // Backlinks
  getBacklinks,
  getOutgoingLinks,
};
