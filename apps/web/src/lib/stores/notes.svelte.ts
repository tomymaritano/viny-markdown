// =============================================================================
// Notes Store (Svelte 5 Runes)
// =============================================================================

import type { Note } from '@viny/domain';
import { operationsStore } from './operations.svelte';

// Local NoteVersion interface (not exported from domain yet)
interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

// Sort options
type SortBy = 'updatedAt' | 'createdAt' | 'title' | 'manual';
type SortOrder = 'asc' | 'desc';

// View mode options
type ViewMode = 'list' | 'card';

// Template type
interface NoteTemplate {
  id: string;
  name: string;
  icon: string;
  title: string;
  content: string;
}

// Built-in templates
const noteTemplates: NoteTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    icon: '📋',
    title: 'Meeting Notes',
    content: `# Meeting Notes

## Date
{{date}}

## Attendees
-

## Agenda
1.

## Discussion Notes


## Action Items
- [ ]

## Next Steps

`,
  },
  {
    id: 'daily',
    name: 'Daily Log',
    icon: '📅',
    title: '{{date}}',
    content: `# {{date}}

## Goals for Today
- [ ]

## Notes


## Accomplishments
-

## Tomorrow
-
`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    icon: '🎯',
    title: 'Project: ',
    content: `# Project: [Name]

## Overview


## Goals
-

## Timeline
| Phase | Start | End | Status |
|-------|-------|-----|--------|
| Planning | | | |
| Development | | | |
| Review | | | |

## Tasks
- [ ]

## Resources


## Notes

`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    icon: '💡',
    title: 'Brainstorm: ',
    content: `# Brainstorm: [Topic]

## Main Ideas
-

## Questions
-

## Connections
-

## Next Actions
- [ ]
`,
  },
  {
    id: 'review',
    name: 'Weekly Review',
    icon: '📊',
    title: 'Week of {{date}}',
    content: `# Week of {{date}}

## Wins
-

## Challenges
-

## Lessons Learned
-

## Goals for Next Week
- [ ]

## Notes

`,
  },
];

// State
let allNotes = $state<Note[]>([]);
let trashedNotes = $state<Note[]>([]);
let archivedNotes = $state<Note[]>([]);
let selectedNoteId = $state<string | null>(null);
let selectedNotebookId = $state<string | null>(null); // null = All Notes
let viewingTrash = $state(false);
let viewingArchive = $state(false);
let selectedTrashedNoteId = $state<string | null>(null);
let selectedArchivedNoteId = $state<string | null>(null);
let searchQuery = $state('');
let filterByTagId = $state<string | null>(null); // null = no tag filter
let sortBy = $state<SortBy>('updatedAt');
let sortOrder = $state<SortOrder>('desc');
let viewMode = $state<ViewMode>('list');
let isLoading = $state(false);
let isInitialized = $state(false);
let recentNoteIds = $state<string[]>([]); // Track last 10 accessed notes
const MAX_RECENT_NOTES = 10;
let manualNoteOrder = $state<string[]>([]); // Manual order for drag-and-drop
let noteVersions = $state<Map<string, NoteVersion[]>>(new Map()); // Version history per note
const MAX_VERSIONS_PER_NOTE = 50;
let customTemplates = $state<NoteTemplate[]>([]); // User-created templates

// Multi-select state
let isSelectMode = $state(false);
let selectedNoteIds = $state<Set<string>>(new Set());

// Recent searches
let recentSearches = $state<string[]>([]);
const MAX_RECENT_SEARCHES = 10;

// Search filters
interface SearchFilters {
  searchInTitle: boolean;
  searchInContent: boolean;
  searchInTags: boolean;
  dateFrom: string | null; // ISO date string
  dateTo: string | null;
  useFuzzySearch: boolean;
}

let searchFilters = $state<SearchFilters>({
  searchInTitle: true,
  searchInContent: true,
  searchInTags: true,
  dateFrom: null,
  dateTo: null,
  useFuzzySearch: true,
});

// Fuzzy search scoring function
function fuzzyScore(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;

  // Contains exact query
  if (lowerText.includes(lowerQuery)) {
    // Bonus for match at start
    if (lowerText.startsWith(lowerQuery)) return 90;
    // Bonus for match at word boundary
    const wordBoundaryIndex = lowerText.indexOf(' ' + lowerQuery);
    if (wordBoundaryIndex >= 0) return 80;
    return 70;
  }

  // Fuzzy match - check if all query chars appear in order
  let score = 0;
  let textIndex = 0;
  let consecutiveMatches = 0;
  let lastMatchIndex = -2;

  for (let i = 0; i < lowerQuery.length; i++) {
    const char = lowerQuery[i];
    const foundIndex = lowerText.indexOf(char, textIndex);

    if (foundIndex === -1) {
      return 0; // Character not found, no match
    }

    // Consecutive match bonus
    if (foundIndex === lastMatchIndex + 1) {
      consecutiveMatches++;
      score += 10 + consecutiveMatches * 2;
    } else {
      consecutiveMatches = 0;
      score += 5;
    }

    // Word boundary bonus
    if (foundIndex === 0 || lowerText[foundIndex - 1] === ' ') {
      score += 5;
    }

    lastMatchIndex = foundIndex;
    textIndex = foundIndex + 1;
  }

  // Normalize by query length and penalize long texts
  const lengthPenalty = Math.max(0, (lowerText.length - lowerQuery.length) / 50);
  return Math.max(0, Math.min(60, score - lengthPenalty));
}

// Search result with score for ranking
interface SearchResult {
  note: Note;
  score: number;
  matchedIn: ('title' | 'content' | 'tags')[];
}

function searchNotes(notes: Note[], query: string): SearchResult[] {
  if (!query.trim()) return notes.map(n => ({ note: n, score: 0, matchedIn: [] }));

  const { appStore } = appStoreModule || {};
  const results: SearchResult[] = [];

  for (const note of notes) {
    let totalScore = 0;
    const matchedIn: ('title' | 'content' | 'tags')[] = [];

    // Search in title
    if (searchFilters.searchInTitle) {
      const titleScore = searchFilters.useFuzzySearch
        ? fuzzyScore(note.title, query)
        : note.title.toLowerCase().includes(query.toLowerCase()) ? 70 : 0;
      if (titleScore > 0) {
        totalScore += titleScore * 2; // Title matches weighted higher
        matchedIn.push('title');
      }
    }

    // Search in content
    if (searchFilters.searchInContent) {
      const contentScore = searchFilters.useFuzzySearch
        ? fuzzyScore(note.content.slice(0, 1000), query) // Limit for performance
        : note.content.toLowerCase().includes(query.toLowerCase()) ? 50 : 0;
      if (contentScore > 0) {
        totalScore += contentScore;
        matchedIn.push('content');
      }
    }

    // Search in tags
    if (searchFilters.searchInTags && appStore) {
      for (const tagId of note.tags) {
        const tag = appStore.tags.find(t => t.id === tagId);
        if (tag) {
          const tagScore = searchFilters.useFuzzySearch
            ? fuzzyScore(tag.name, query)
            : tag.name.toLowerCase().includes(query.toLowerCase()) ? 60 : 0;
          if (tagScore > 0) {
            totalScore += tagScore;
            if (!matchedIn.includes('tags')) matchedIn.push('tags');
          }
        }
      }
    }

    if (totalScore > 0 || matchedIn.length > 0) {
      results.push({ note, score: totalScore, matchedIn });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

// Store app store module reference for search (lazy loaded)
let appStoreModule: { appStore: typeof import('./app.svelte').appStore } | null = null;

// Initialize app store reference
async function initAppStoreRef() {
  if (!appStoreModule) {
    const mod = await import('./app.svelte');
    appStoreModule = { appStore: mod.appStore };
  }
}

// Derived - filtered by notebook
const notebookNotes = $derived(() => {
  if (selectedNotebookId === null) return allNotes;
  return allNotes.filter((n) => n.notebookId === selectedNotebookId);
});

// Sort function
function sortNotes(notes: Note[]): Note[] {
  if (sortBy === 'manual') {
    // Manual sort: order by manualNoteOrder array
    return [...notes].sort((a, b) => {
      const aIndex = manualNoteOrder.indexOf(a.id);
      const bIndex = manualNoteOrder.indexOf(b.id);
      // Notes not in order array go to end
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }
  return [...notes].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'title') {
      comparison = (a.title || '').localeCompare(b.title || '');
    } else if (sortBy === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      // updatedAt (default)
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

// Derived - filtered by search and tag (on top of notebook filter) and sorted
const filteredNotes = $derived(() => {
  const notes = notebookNotes();
  let result = notes;

  // Filter by tag if set
  if (filterByTagId) {
    const tagId = filterByTagId;
    result = result.filter((n) => n.tags.includes(tagId));
  }

  // Filter by date range
  if (searchFilters.dateFrom) {
    const fromDate = new Date(searchFilters.dateFrom);
    result = result.filter((n) => new Date(n.updatedAt) >= fromDate);
  }
  if (searchFilters.dateTo) {
    const toDate = new Date(searchFilters.dateTo);
    toDate.setHours(23, 59, 59, 999); // End of day
    result = result.filter((n) => new Date(n.updatedAt) <= toDate);
  }

  // Filter by search query (using fuzzy search if enabled)
  if (searchQuery.trim()) {
    if (searchFilters.useFuzzySearch) {
      // Use fuzzy search with scoring
      const searchResults = searchNotes(result, searchQuery);
      // Return notes sorted by search score (not by regular sort)
      return searchResults.map((r) => r.note);
    } else {
      // Simple includes search
      const query = searchQuery.toLowerCase();
      result = result.filter((n) => {
        const matchTitle = searchFilters.searchInTitle && n.title.toLowerCase().includes(query);
        const matchContent = searchFilters.searchInContent && n.content.toLowerCase().includes(query);
        let matchTags = false;
        if (searchFilters.searchInTags && appStoreModule) {
          matchTags = n.tags.some((tagId) => {
            const tag = appStoreModule!.appStore.tags.find((t) => t.id === tagId);
            return tag?.name.toLowerCase().includes(query);
          });
        }
        return matchTitle || matchContent || matchTags;
      });
    }
  }
  return sortNotes(result);
});

const selectedNote = $derived(
  selectedNoteId ? allNotes.find((n) => n.id === selectedNoteId) ?? null : null
);

const selectedTrashedNote = $derived(
  selectedTrashedNoteId ? trashedNotes.find((n) => n.id === selectedTrashedNoteId) ?? null : null
);

const selectedArchivedNote = $derived(
  selectedArchivedNoteId ? archivedNotes.find((n) => n.id === selectedArchivedNoteId) ?? null : null
);

const pinnedNotes = $derived(filteredNotes().filter((n) => n.isPinned));
const unpinnedNotes = $derived(filteredNotes().filter((n) => !n.isPinned));

// Recent notes - map IDs to actual notes, filter out deleted/nonexistent
const recentNotes = $derived(
  recentNoteIds
    .map((id) => allNotes.find((n) => n.id === id))
    .filter((n): n is Note => n !== undefined)
);

// Current notes (filtered by notebook + search)
const notes = $derived(filteredNotes());

// Actions
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
      if (savedSortBy === 'updatedAt' || savedSortBy === 'createdAt' || savedSortBy === 'title' || savedSortBy === 'manual') {
        sortBy = savedSortBy;
      }
      const savedSortOrder = localStorage.getItem('viny-sort-order');
      if (savedSortOrder === 'asc' || savedSortOrder === 'desc') {
        sortOrder = savedSortOrder;
      }
      const savedRecentSearches = localStorage.getItem('viny-recent-searches');
      if (savedRecentSearches) {
        try {
          recentSearches = JSON.parse(savedRecentSearches);
        } catch {
          recentSearches = [];
        }
      }
    }

    // Dynamic import to avoid SSR issues
    const storage = await import('@viny/storage');
    await storage.initDatabase();
    allNotes = await storage.getAllNotes();
    trashedNotes = await storage.getDeletedNotes();

    // Initialize app store reference for search
    await initAppStoreRef();

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  } finally {
    isLoading = false;
  }
}

async function createNote(input: { title?: string; content?: string } = {}) {
  const storage = await import('@viny/storage');
  // Create note in current notebook
  const note = await storage.createNote({ ...input, notebookId: selectedNotebookId });
  allNotes = [note, ...allNotes];
  selectedNoteId = note.id;
  searchQuery = ''; // Clear search when creating

  // Log operation for sync
  await operationsStore.logNoteCreated(note.id, {
    title: note.title,
    content: note.content,
    notebookId: note.notebookId,
    status: note.status,
  });

  return note;
}

// Generate a simple UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Save a version of a note before updating
function saveNoteVersion(note: Note) {
  const version: NoteVersion = {
    id: generateId(),
    noteId: note.id,
    title: note.title,
    content: note.content,
    createdAt: new Date().toISOString(),
    wordCount: note.content.trim().split(/\s+/).filter((w) => w.length > 0).length,
  };

  const existingVersions = noteVersions.get(note.id) || [];
  // Add new version at the beginning, limit to max
  const newVersions = [version, ...existingVersions].slice(0, MAX_VERSIONS_PER_NOTE);
  noteVersions = new Map(noteVersions).set(note.id, newVersions);
}

async function updateNote(id: string, updates: { title?: string; content?: string }) {
  const storage = await import('@viny/storage');

  // Save version before updating (only if content changed)
  const currentNote = allNotes.find((n) => n.id === id);
  if (currentNote && (updates.title !== undefined || updates.content !== undefined)) {
    const hasChanges =
      (updates.title !== undefined && updates.title !== currentNote.title) ||
      (updates.content !== undefined && updates.content !== currentNote.content);
    if (hasChanges) {
      saveNoteVersion(currentNote);
    }
  }

  const updated = await storage.updateNote(id, updates);
  if (updated) {
    // Track writing stats (word count delta)
    if (currentNote && updates.content !== undefined) {
      const oldWords = currentNote.content.split(/\s+/).filter(Boolean).length;
      const newWords = updates.content.split(/\s+/).filter(Boolean).length;
      const delta = newWords - oldWords;
      if (delta > 0) {
        trackWritingStats(delta, false);
      }
    }

    allNotes = allNotes.map((n) => (n.id === id ? updated : n));

    // Log operation for sync
    const affectedFields: Array<'title' | 'content'> = [];
    if (updates.title !== undefined) affectedFields.push('title');
    if (updates.content !== undefined) affectedFields.push('content');
    await operationsStore.logNoteUpdated(id, {
      title: updates.title,
      content: updates.content,
      affectedFields,
    });
  }
  return updated;
}

async function deleteNote(id: string) {
  const storage = await import('@viny/storage');
  const note = allNotes.find((n) => n.id === id);
  await storage.deleteNote(id);
  allNotes = allNotes.filter((n) => n.id !== id);
  // Add to trash with updated deletedAt
  if (note) {
    const deletedNote = { ...note, deletedAt: new Date().toISOString() };
    trashedNotes = [deletedNote, ...trashedNotes];

    // Log operation for sync
    await operationsStore.logNoteDeleted(id);
  }
  if (selectedNoteId === id) {
    const currentNotes = filteredNotes();
    selectedNoteId = currentNotes[0]?.id ?? null;
  }
}

async function restoreNote(id: string) {
  const storage = await import('@viny/storage');
  const restored = await storage.restoreNote(id);
  if (restored) {
    trashedNotes = trashedNotes.filter((n) => n.id !== id);
    allNotes = [restored, ...allNotes];

    // Log operation for sync
    await operationsStore.logNoteRestored(id);
  }
  return restored;
}

async function permanentlyDeleteNote(id: string) {
  const storage = await import('@viny/storage');
  await storage.permanentlyDeleteNote(id);
  trashedNotes = trashedNotes.filter((n) => n.id !== id);
  if (selectedTrashedNoteId === id) {
    selectedTrashedNoteId = trashedNotes[0]?.id ?? null;
  }
}

function setViewingTrash(value: boolean) {
  viewingTrash = value;
  viewingArchive = false;
  selectedNoteId = null;
  selectedTrashedNoteId = null;
  selectedArchivedNoteId = null;
  if (value) {
    selectedNotebookId = null;
  }
}

function setViewingArchive(value: boolean) {
  viewingArchive = value;
  viewingTrash = false;
  selectedNoteId = null;
  selectedTrashedNoteId = null;
  selectedArchivedNoteId = null;
  if (value) {
    selectedNotebookId = null;
  }
}

function selectTrashedNote(id: string | null) {
  selectedTrashedNoteId = id;
}

function selectArchivedNote(id: string | null) {
  selectedArchivedNoteId = id;
}

// Archive a note (move from active to archived)
async function archiveNote(id: string) {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  allNotes = allNotes.filter((n) => n.id !== id);
  archivedNotes = [{ ...note, updatedAt: new Date().toISOString() }, ...archivedNotes];

  // Log operation for sync
  await operationsStore.logNoteStatusChanged(id, {
    fromStatus: note.status,
    toStatus: 'archived',
  });

  if (selectedNoteId === id) {
    const currentNotes = filteredNotes();
    selectedNoteId = currentNotes[0]?.id ?? null;
  }
}

// Unarchive a note (move from archived back to active)
async function unarchiveNote(id: string) {
  const note = archivedNotes.find((n) => n.id === id);
  if (!note) return;

  archivedNotes = archivedNotes.filter((n) => n.id !== id);
  allNotes = [{ ...note, updatedAt: new Date().toISOString() }, ...allNotes];

  // Log operation for sync
  await operationsStore.logNoteStatusChanged(id, {
    fromStatus: 'archived',
    toStatus: 'active',
  });

  if (selectedArchivedNoteId === id) {
    selectedArchivedNoteId = archivedNotes[0]?.id ?? null;
  }
}

async function togglePin(id: string) {
  const storage = await import('@viny/storage');
  const note = allNotes.find((n) => n.id === id);
  const updated = await storage.toggleNotePin(id);
  if (updated) {
    allNotes = allNotes.map((n) => (n.id === id ? updated : n));

    // Log operation for sync
    if (note?.isPinned) {
      await operationsStore.logNoteUnpinned(id);
    } else {
      await operationsStore.logNotePinned(id);
    }
  }
}

function setNotebook(notebookId: string | null) {
  selectedNotebookId = notebookId;
  // Clear selection if current note is not in new notebook
  if (selectedNoteId) {
    const note = allNotes.find((n) => n.id === selectedNoteId);
    if (note && notebookId !== null && note.notebookId !== notebookId) {
      selectedNoteId = null;
    }
  }
}

function selectNote(id: string | null) {
  selectedNoteId = id;
  // Track in recent notes (only if selecting a note, not deselecting)
  if (id) {
    addToRecentNotes(id);
  }
}

// Add a note to recent notes list
function addToRecentNotes(id: string) {
  // Remove if already exists (to move to front)
  const filtered = recentNoteIds.filter((nid) => nid !== id);
  // Add to front and limit size
  recentNoteIds = [id, ...filtered].slice(0, MAX_RECENT_NOTES);
}

// Clear recent notes history
function clearRecentNotes() {
  recentNoteIds = [];
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

// Recent searches functions
function addRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;

  // Remove if already exists (will be added to front)
  const filtered = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
  recentSearches = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);

  // Persist to localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-recent-searches', JSON.stringify(recentSearches));
  }
}

function removeRecentSearch(query: string) {
  recentSearches = recentSearches.filter(s => s !== query);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-recent-searches', JSON.stringify(recentSearches));
  }
}

function clearRecentSearches() {
  recentSearches = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('viny-recent-searches');
  }
}

// Search filter functions
function setSearchFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
  searchFilters = { ...searchFilters, [key]: value };
}

function resetSearchFilters() {
  searchFilters = {
    searchInTitle: true,
    searchInContent: true,
    searchInTags: true,
    dateFrom: null,
    dateTo: null,
    useFuzzySearch: true,
  };
}

function toggleFuzzySearch() {
  searchFilters = { ...searchFilters, useFuzzySearch: !searchFilters.useFuzzySearch };
}

function setDateFilter(from: string | null, to: string | null) {
  searchFilters = { ...searchFilters, dateFrom: from, dateTo: to };
}

function clearDateFilter() {
  searchFilters = { ...searchFilters, dateFrom: null, dateTo: null };
}

// Writing stats tracking
interface DailyStats {
  date: string;
  wordCount: number;
  notesEdited: number;
  notesCreated: number;
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function trackWritingStats(wordsDelta: number, isNewNote: boolean = false) {
  if (typeof localStorage === 'undefined') return;

  const today = getDateString();
  let stats: DailyStats[] = [];

  try {
    const stored = localStorage.getItem('viny-writing-stats');
    if (stored) stats = JSON.parse(stored);
  } catch {
    stats = [];
  }

  const todayIndex = stats.findIndex(s => s.date === today);

  if (todayIndex >= 0) {
    stats[todayIndex].wordCount += Math.max(0, wordsDelta);
    stats[todayIndex].notesEdited += 1;
    if (isNewNote) stats[todayIndex].notesCreated += 1;
  } else {
    stats.push({
      date: today,
      wordCount: Math.max(0, wordsDelta),
      notesEdited: 1,
      notesCreated: isNewNote ? 1 : 0,
    });
  }

  // Keep only last 365 days
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const yearAgoStr = yearAgo.toISOString().split('T')[0];
  stats = stats.filter(s => s.date >= yearAgoStr);

  localStorage.setItem('viny-writing-stats', JSON.stringify(stats));
}

function getWritingStats(): DailyStats[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const stored = localStorage.getItem('viny-writing-stats');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setSort(by: SortBy, order: SortOrder) {
  sortBy = by;
  sortOrder = order;
  // Persist sort preferences
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-sort-by', by);
    localStorage.setItem('viny-sort-order', order);
  }
}

function setViewMode(mode: ViewMode) {
  viewMode = mode;
  // Persist view mode preference
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-view-mode', mode);
  }
}

function toggleViewMode() {
  setViewMode(viewMode === 'list' ? 'card' : 'list');
}

// Reorder notes (for drag-and-drop)
function reorderNotes(fromIndex: number, toIndex: number) {
  // Get current list based on pinned status
  const unpinned = filteredNotes().filter((n) => !n.isPinned);
  const noteIds = unpinned.map((n) => n.id);

  // Perform reorder
  const [movedId] = noteIds.splice(fromIndex, 1);
  noteIds.splice(toIndex, 0, movedId);

  // Update manual order
  manualNoteOrder = noteIds;

  // Switch to manual sort mode
  sortBy = 'manual';
}

// Multi-select functions
function toggleSelectMode() {
  isSelectMode = !isSelectMode;
  if (!isSelectMode) {
    selectedNoteIds = new Set();
  }
}

function exitSelectMode() {
  isSelectMode = false;
  selectedNoteIds = new Set();
}

function toggleNoteSelection(noteId: string) {
  const newSet = new Set(selectedNoteIds);
  if (newSet.has(noteId)) {
    newSet.delete(noteId);
  } else {
    newSet.add(noteId);
  }
  selectedNoteIds = newSet;
}

function selectAllNotes() {
  const visibleNotes = filteredNotes();
  selectedNoteIds = new Set(visibleNotes.map((n) => n.id));
}

function deselectAllNotes() {
  selectedNoteIds = new Set();
}

function isNoteSelected(noteId: string): boolean {
  return selectedNoteIds.has(noteId);
}

// Bulk action functions
async function bulkDeleteNotes() {
  const ids = Array.from(selectedNoteIds);
  for (const id of ids) {
    await deleteNote(id);
  }
  exitSelectMode();
}

async function bulkArchiveNotes() {
  const ids = Array.from(selectedNoteIds);
  for (const id of ids) {
    await archiveNote(id);
  }
  exitSelectMode();
}

async function bulkMoveNotes(toNotebookId: string | null) {
  const ids = Array.from(selectedNoteIds);
  for (const id of ids) {
    await moveNote(id, toNotebookId);
  }
  exitSelectMode();
}

async function bulkTogglePin() {
  const ids = Array.from(selectedNoteIds);
  for (const id of ids) {
    await togglePin(id);
  }
  exitSelectMode();
}

async function bulkAddTag(tagId: string) {
  const ids = Array.from(selectedNoteIds);
  for (const id of ids) {
    await addTag(id, tagId);
  }
  exitSelectMode();
}

async function addTag(noteId: string, tagId: string) {
  const storage = await import('@viny/storage');
  const updated = await storage.addNoteTag(noteId, tagId);
  if (updated) {
    allNotes = allNotes.map((n) => (n.id === noteId ? updated : n));

    // Log operation for sync
    await operationsStore.logNoteTagAdded(noteId, { tagId });
  }
  return updated;
}

async function removeTag(noteId: string, tagId: string) {
  const storage = await import('@viny/storage');
  const updated = await storage.removeNoteTag(noteId, tagId);
  if (updated) {
    allNotes = allNotes.map((n) => (n.id === noteId ? updated : n));

    // Log operation for sync
    await operationsStore.logNoteTagRemoved(noteId, { tagId });
  }
  return updated;
}

async function updateNoteTags(noteId: string, newTags: string[]) {
  const storage = await import('@viny/storage');
  const note = allNotes.find((n) => n.id === noteId);
  if (!note) return null;

  // Get current tags
  const currentTags = new Set(note.tags);
  const targetTags = new Set(newTags);

  // Remove tags no longer in the list
  for (const tagId of currentTags) {
    if (!targetTags.has(tagId)) {
      await storage.removeNoteTag(noteId, tagId);
      await operationsStore.logNoteTagRemoved(noteId, { tagId });
    }
  }

  // Add new tags
  for (const tagId of targetTags) {
    if (!currentTags.has(tagId)) {
      await storage.addNoteTag(noteId, tagId);
      await operationsStore.logNoteTagAdded(noteId, { tagId });
    }
  }

  // Refresh note from storage
  const updated = await storage.getNote(noteId);
  if (updated) {
    allNotes = allNotes.map((n) => (n.id === noteId ? updated : n));
  }
  return updated;
}

async function moveNote(noteId: string, toNotebookId: string | null) {
  const storage = await import('@viny/storage');
  const note = allNotes.find((n) => n.id === noteId);
  const updated = await storage.moveNote(noteId, toNotebookId);
  if (updated) {
    allNotes = allNotes.map((n) => (n.id === noteId ? updated : n));

    // Log operation for sync
    await operationsStore.logNoteMoved(noteId, {
      fromNotebookId: note?.notebookId ?? null,
      toNotebookId,
    });
  }
  return updated;
}

async function duplicateNote(id: string) {
  const storage = await import('@viny/storage');
  const duplicate = await storage.duplicateNote(id);
  if (duplicate) {
    allNotes = [duplicate, ...allNotes];
    selectedNoteId = duplicate.id;

    // Log operation for sync
    await operationsStore.logNoteCreated(duplicate.id, {
      title: duplicate.title,
      content: duplicate.content,
      notebookId: duplicate.notebookId,
      status: duplicate.status,
    });
  }
  return duplicate;
}

// Find a note by title (case-insensitive) or create a new one
async function navigateToNoteByTitle(title: string) {
  // Search for existing note by title (case-insensitive)
  const existingNote = allNotes.find(
    (n) => n.title.toLowerCase() === title.toLowerCase()
  );

  if (existingNote) {
    // Navigate to existing note
    selectedNoteId = existingNote.id;
    viewingTrash = false;
    return existingNote;
  } else {
    // Create new note with this title
    const newNote = await createNote({ title });
    return newNote;
  }
}

// Find all notes that link to a given title using [[title]] syntax
function getBacklinks(title: string): Note[] {
  if (!title.trim()) return [];

  // Create regex pattern to match [[title]] (case-insensitive)
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[\\[${escapedTitle}\\]\\]`, 'i');

  return allNotes.filter((note) => {
    // Don't include the note itself
    if (note.title.toLowerCase() === title.toLowerCase()) return false;
    // Check if content contains the wiki link
    return pattern.test(note.content);
  });
}

// Extract all [[wiki-links]] from content and return matching notes (forward links)
function getForwardLinks(content: string): Note[] {
  if (!content.trim()) return [];

  // Match all [[...]] patterns
  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];

  // Extract unique titles from matches
  const linkedTitles = new Set<string>();
  for (const match of matches) {
    const title = match.slice(2, -2).trim(); // Remove [[ and ]]
    if (title) linkedTitles.add(title.toLowerCase());
  }

  // Find notes matching these titles
  return allNotes.filter((note) =>
    linkedTitles.has(note.title.toLowerCase())
  );
}

// Get all wiki-link titles from content (including those that don't have notes yet)
function getLinkedTitles(content: string): string[] {
  if (!content.trim()) return [];

  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];

  const titles = new Set<string>();
  for (const match of matches) {
    const title = match.slice(2, -2).trim();
    if (title) titles.add(title);
  }

  return Array.from(titles);
}

// Graph data types for visualization
interface GraphNode {
  id: string;
  title: string;
  notebookId: string | null;
  connectionCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

// Get graph data for visualization (all notes and their connections)
function getGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const titleToId = new Map<string, string>();

  // Build title -> id mapping
  for (const note of allNotes) {
    titleToId.set(note.title.toLowerCase(), note.id);
  }

  // Build edges and count connections
  const connectionCounts = new Map<string, number>();

  for (const note of allNotes) {
    // Initialize connection count
    if (!connectionCounts.has(note.id)) {
      connectionCounts.set(note.id, 0);
    }

    // Find all wiki-links in this note's content
    const matches = note.content.match(/\[\[([^\]]+)\]\]/g);
    if (matches) {
      for (const match of matches) {
        const linkedTitle = match.slice(2, -2).trim().toLowerCase();
        const targetId = titleToId.get(linkedTitle);

        if (targetId && targetId !== note.id) {
          // Add edge
          edges.push({
            source: note.id,
            target: targetId,
          });

          // Increment connection counts for both nodes
          connectionCounts.set(note.id, (connectionCounts.get(note.id) || 0) + 1);
          connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
        }
      }
    }
  }

  // Build nodes with connection counts
  for (const note of allNotes) {
    nodes.push({
      id: note.id,
      title: note.title || 'Untitled',
      notebookId: note.notebookId,
      connectionCount: connectionCounts.get(note.id) || 0,
    });
  }

  return { nodes, edges };
}

// Get today's date formatted as YYYY-MM-DD
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Navigate to today's daily note (create if doesn't exist)
async function openDailyNote() {
  const dateTitle = getTodayDateString();

  // Check if daily note exists
  const existingNote = allNotes.find((n) => n.title === dateTitle);

  if (existingNote) {
    selectedNoteId = existingNote.id;
    viewingTrash = false;
    return existingNote;
  }

  // Create new daily note with date title
  const dailyNote = await createNote({
    title: dateTitle,
    content: `# ${dateTitle}\n\n`,
  });

  return dailyNote;
}

function openRandomNote() {
  // Filter to only active notes (not trashed)
  const activeNotes = allNotes.filter((n) => n.status === 'active');

  if (activeNotes.length === 0) return null;

  // Select a random note
  const randomIndex = Math.floor(Math.random() * activeNotes.length);
  const randomNote = activeNotes[randomIndex];

  // Navigate to the note
  selectedNoteId = randomNote.id;
  viewingTrash = false;
  viewingArchive = false;

  return randomNote;
}

// Create a note from a template
async function createNoteFromTemplate(templateId: string) {
  const template = noteTemplates.find((t) => t.id === templateId);
  if (!template) return null;

  const dateStr = getTodayDateString();

  // Replace {{date}} placeholders
  const title = template.title.replace(/\{\{date\}\}/g, dateStr);
  const content = template.content.replace(/\{\{date\}\}/g, dateStr);

  const note = await createNote({ title, content });
  return note;
}

// Get available templates (built-in + custom)
function getTemplates(): NoteTemplate[] {
  return noteTemplates;
}

// Get all templates (built-in + custom)
function getAllTemplates(): { builtin: NoteTemplate[]; custom: NoteTemplate[] } {
  return { builtin: noteTemplates, custom: customTemplates };
}

// Save current note as a custom template
function saveNoteAsTemplate(noteId: string, name: string, icon: string): NoteTemplate | null {
  const note = allNotes.find((n) => n.id === noteId);
  if (!note) return null;

  const template: NoteTemplate = {
    id: `custom-${generateId()}`,
    name,
    icon,
    title: note.title,
    content: note.content,
  };

  customTemplates = [...customTemplates, template];
  return template;
}

// Delete a custom template
function deleteCustomTemplate(templateId: string) {
  customTemplates = customTemplates.filter((t) => t.id !== templateId);
}

// Create note from any template (built-in or custom)
async function createFromAnyTemplate(templateId: string) {
  // Check built-in templates first
  const builtinTemplate = noteTemplates.find((t) => t.id === templateId);
  if (builtinTemplate) {
    return createNoteFromTemplate(templateId);
  }

  // Check custom templates
  const customTemplate = customTemplates.find((t) => t.id === templateId);
  if (customTemplate) {
    const dateStr = getTodayDateString();
    const title = customTemplate.title.replace(/\{\{date\}\}/g, dateStr);
    const content = customTemplate.content.replace(/\{\{date\}\}/g, dateStr);
    const note = await createNote({ title, content });
    return note;
  }

  return null;
}

// Export note as Markdown file
function exportNote(id: string) {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  // Build markdown content with title as heading
  const markdown = `# ${note.title}\n\n${note.content}`;

  // Create filename from title (sanitize for filesystem)
  const filename = `${note.title || 'Untitled'}.md`
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Create blob and trigger download
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Copy note content to clipboard
async function copyNoteToClipboard(id: string): Promise<boolean> {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return false;

  const markdown = `# ${note.title}\n\n${note.content}`;

  try {
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch {
    return false;
  }
}

// Empty trash - permanently delete all trashed notes
async function emptyTrash() {
  const storage = await import('@viny/storage');
  for (const note of trashedNotes) {
    await storage.permanentlyDeleteNote(note.id);
  }
  trashedNotes = [];
  selectedTrashedNoteId = null;
}

// Note statistics interface
interface NoteStats {
  wordCount: number;
  characterCount: number;
  characterCountNoSpaces: number;
  lineCount: number;
  paragraphCount: number;
  linkCount: number;
  backlinkCount: number;
  createdAt: string;
  updatedAt: string;
  readingTime: string;
}

// Get detailed statistics for a note
function getNoteStats(id: string): NoteStats | null {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return null;

  const content = note.content;

  // Word count
  const words = content.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = content.trim() === '' ? 0 : words.length;

  // Character counts
  const characterCount = content.length;
  const characterCountNoSpaces = content.replace(/\s/g, '').length;

  // Line count
  const lineCount = content === '' ? 0 : content.split('\n').length;

  // Paragraph count (non-empty lines separated by blank lines)
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // Wiki link count [[...]]
  const linkMatches = content.match(/\[\[[^\]]+\]\]/g);
  const linkCount = linkMatches ? linkMatches.length : 0;

  // Backlink count
  const backlinks = getBacklinks(note.title);
  const backlinkCount = backlinks.length;

  // Reading time (average 200 words per minute)
  const minutes = Math.ceil(wordCount / 200);
  const readingTime = minutes <= 1 ? '< 1 min' : `${minutes} min`;

  return {
    wordCount,
    characterCount,
    characterCountNoSpaces,
    lineCount,
    paragraphCount,
    linkCount,
    backlinkCount,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    readingTime,
  };
}

// Export note as HTML file
async function exportNoteAsHtml(id: string) {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  // Dynamic import marked for markdown parsing
  const { marked } = await import('marked');

  // Convert markdown to HTML
  const htmlContent = await marked(note.content);

  // Create full HTML document
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${note.title || 'Untitled'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
      background: #fff;
    }
    h1 { font-size: 28px; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    h2 { font-size: 22px; margin-top: 24px; }
    h3 { font-size: 18px; margin-top: 20px; }
    p { margin: 12px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: 'SF Mono', Consolas, monospace; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 16px 0; padding-left: 16px; color: #666; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f4; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    img { max-width: 100%; }
    a { color: #0066cc; }
    .task-list-item { list-style: none; margin-left: -20px; }
    .task-list-item input { margin-right: 8px; }
  </style>
</head>
<body>
  <article>
    <h1>${note.title || 'Untitled'}</h1>
    ${htmlContent}
  </article>
</body>
</html>`;

  // Create filename from title (sanitize for filesystem)
  const filename = `${note.title || 'Untitled'}.html`
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Create blob and trigger download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Print note with formatted HTML
async function printNote(id: string) {
  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  // Dynamic import marked for markdown parsing
  const { marked } = await import('marked');

  // Convert markdown to HTML
  const htmlContent = await marked(note.content);

  // Create print-friendly HTML document
  const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${note.title || 'Untitled'}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { font-size: 28px; margin-bottom: 8px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    h2 { font-size: 22px; margin-top: 24px; }
    h3 { font-size: 18px; margin-top: 20px; }
    p { margin: 12px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 16px 0; padding-left: 16px; color: #666; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f4; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    img { max-width: 100%; }
    .print-header { font-size: 12px; color: #888; margin-bottom: 24px; }
    .print-footer { font-size: 11px; color: #888; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="print-header">
    <strong>${note.title || 'Untitled'}</strong> · Printed from VINY
  </div>
  <article>
    ${htmlContent}
  </article>
  <div class="print-footer">
    Created: ${new Date(note.createdAt).toLocaleDateString()} ·
    Last modified: ${new Date(note.updatedAt).toLocaleDateString()}
  </div>
</body>
</html>`;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    // Small delay to ensure content is rendered
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

// Get version history for a note
function getNoteVersions(noteId: string): NoteVersion[] {
  return noteVersions.get(noteId) || [];
}

// Restore a note to a previous version
async function restoreNoteVersion(noteId: string, versionId: string) {
  const versions = noteVersions.get(noteId);
  if (!versions) return null;

  const version = versions.find((v) => v.id === versionId);
  if (!version) return null;

  // Update note with version content
  const updated = await updateNote(noteId, {
    title: version.title,
    content: version.content,
  });

  return updated;
}

// Export store
// Import notes from markdown files
async function importNotesFromMarkdown(files: FileList): Promise<number> {
  let importedCount = 0;

  for (const file of Array.from(files)) {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && !file.name.endsWith('.txt')) {
      continue;
    }

    try {
      const content = await file.text();

      // Extract title from first heading or filename
      let title: string;
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      } else {
        // Use filename without extension
        title = file.name.replace(/\.(md|markdown|txt)$/, '');
      }

      await createNote({ title, content });
      importedCount++;
    } catch (error) {
      console.error(`Failed to import ${file.name}:`, error);
    }
  }

  return importedCount;
}

// -----------------------------------------------------------------------------
// Bulk Export Functions
// -----------------------------------------------------------------------------

interface ExportData {
  version: string;
  exportedAt: string;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    notebookId: string | null;
    tags: string[];
    status: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  notebooks: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
}

async function exportAllAsJson(): Promise<void> {
  const { appStore } = await import('./app.svelte');

  const exportData: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    notes: allNotes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      notebookId: note.notebookId,
      tags: note.tags,
      status: note.status,
      isPinned: note.isPinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    notebooks: appStore.notebooks.map((nb) => ({
      id: nb.id,
      name: nb.name,
      color: nb.color,
    })),
    tags: appStore.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `viny-export-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportAllAsMarkdown(): Promise<void> {
  const { appStore } = await import('./app.svelte');

  let markdown = `# VINY Notes Export\n\n`;
  markdown += `Exported: ${new Date().toLocaleString()}\n`;
  markdown += `Total notes: ${allNotes.length}\n\n`;
  markdown += `---\n\n`;

  // Group notes by notebook
  const notesByNotebook = new Map<string | null, typeof allNotes>();

  for (const note of allNotes) {
    const existing = notesByNotebook.get(note.notebookId) || [];
    existing.push(note);
    notesByNotebook.set(note.notebookId, existing);
  }

  // Export notes without notebook first
  const unorganizedNotes = notesByNotebook.get(null) || [];
  if (unorganizedNotes.length > 0) {
    markdown += `## Uncategorized\n\n`;
    for (const note of unorganizedNotes) {
      markdown += `### ${note.title || 'Untitled'}\n\n`;
      markdown += `${note.content}\n\n`;
      markdown += `---\n\n`;
    }
  }

  // Export notes by notebook
  for (const [notebookId, notes] of notesByNotebook) {
    if (notebookId === null) continue;

    const notebook = appStore.notebooks.find((nb) => nb.id === notebookId);
    const notebookName = notebook?.name || 'Unknown Notebook';

    markdown += `## ${notebookName}\n\n`;
    for (const note of notes) {
      markdown += `### ${note.title || 'Untitled'}\n\n`;
      markdown += `${note.content}\n\n`;
      markdown += `---\n\n`;
    }
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `viny-export-${date}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export all notes as ZIP (organized by notebook)
async function exportAllAsZip(): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const { appStore } = await import('./app.svelte');

  const zip = new JSZip();
  const date = new Date().toISOString().split('T')[0];

  // Create manifest with metadata
  const manifest = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    noteCount: allNotes.length,
    notebookCount: appStore.notebooks.length,
    tagCount: appStore.tags.length,
    notebooks: appStore.notebooks.map((nb) => ({
      id: nb.id,
      name: nb.name,
      color: nb.color,
    })),
    tags: appStore.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Helper to sanitize filenames
  const sanitizeFilename = (name: string): string => {
    return (name || 'Untitled')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100); // Limit filename length
  };

  // Group notes by notebook
  const notesByNotebook = new Map<string | null, typeof allNotes>();

  for (const note of allNotes) {
    const existing = notesByNotebook.get(note.notebookId) || [];
    existing.push(note);
    notesByNotebook.set(note.notebookId, existing);
  }

  // Track used filenames to avoid duplicates
  const usedFilenames = new Map<string, number>();

  const getUniqueFilename = (folder: string, baseName: string): string => {
    const key = `${folder}/${baseName}`;
    const count = usedFilenames.get(key) || 0;
    usedFilenames.set(key, count + 1);
    if (count === 0) {
      return baseName;
    }
    return `${baseName.replace(/\.md$/, '')} (${count}).md`;
  };

  // Export notes without notebook to root/Uncategorized folder
  const unorganizedNotes = notesByNotebook.get(null) || [];
  if (unorganizedNotes.length > 0) {
    const folder = zip.folder('Uncategorized');
    for (const note of unorganizedNotes) {
      const baseName = `${sanitizeFilename(note.title)}.md`;
      const filename = getUniqueFilename('Uncategorized', baseName);
      const content = `# ${note.title}\n\n${note.content}`;
      folder?.file(filename, content);
    }
  }

  // Export notes by notebook
  for (const [notebookId, notes] of notesByNotebook) {
    if (notebookId === null) continue;

    const notebook = appStore.notebooks.find((nb) => nb.id === notebookId);
    const folderName = sanitizeFilename(notebook?.name || 'Unknown');
    const folder = zip.folder(folderName);

    for (const note of notes) {
      const baseName = `${sanitizeFilename(note.title)}.md`;
      const filename = getUniqueFilename(folderName, baseName);
      const content = `# ${note.title}\n\n${note.content}`;
      folder?.file(filename, content);
    }
  }

  // Generate ZIP and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `viny-export-${date}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import notes from ZIP file
async function importFromZip(file: File): Promise<ImportResult> {
  const JSZip = (await import('jszip')).default;
  const { appStore } = await import('./app.svelte');
  const storage = await import('@viny/storage');

  const result: ImportResult = {
    notesImported: 0,
    notebooksImported: 0,
    tagsImported: 0,
    errors: [],
  };

  try {
    const zip = await JSZip.loadAsync(file);

    // Check for manifest
    const manifestFile = zip.file('manifest.json');
    let manifest: {
      notebooks?: Array<{ id: string; name: string; color: string | null }>;
      tags?: Array<{ id: string; name: string; color: string | null }>;
    } | null = null;

    if (manifestFile) {
      try {
        const manifestText = await manifestFile.async('text');
        manifest = JSON.parse(manifestText);
      } catch {
        // Ignore manifest parse errors, continue with import
      }
    }

    // Import notebooks from manifest if available
    const notebookNameToId = new Map<string, string>();
    const existingNotebooks = new Map(appStore.notebooks.map((nb) => [nb.name.toLowerCase(), nb]));

    if (manifest?.notebooks) {
      for (const nb of manifest.notebooks) {
        const existing = existingNotebooks.get(nb.name.toLowerCase());
        if (existing) {
          notebookNameToId.set(nb.name, existing.id);
        } else {
          try {
            const newNb = await storage.createNotebook({ name: nb.name, color: nb.color });
            notebookNameToId.set(nb.name, newNb.id);
            result.notebooksImported++;
          } catch {
            result.errors.push(`Failed to create notebook "${nb.name}"`);
          }
        }
      }
    }

    // Import tags from manifest if available
    if (manifest?.tags) {
      const existingTagNames = new Set(appStore.tags.map((t) => t.name.toLowerCase()));
      for (const tag of manifest.tags) {
        if (!existingTagNames.has(tag.name.toLowerCase())) {
          try {
            await storage.findOrCreateTag(tag.name);
            result.tagsImported++;
          } catch {
            result.errors.push(`Failed to create tag "${tag.name}"`);
          }
        }
      }
    }

    // Process all markdown files
    const markdownFiles = Object.keys(zip.files).filter(
      (name) => name.endsWith('.md') && !zip.files[name].dir
    );

    for (const filePath of markdownFiles) {
      try {
        const content = await zip.files[filePath].async('text');

        // Extract folder name (notebook)
        const parts = filePath.split('/');
        const folderName = parts.length > 1 ? parts[0] : null;

        // Parse markdown - extract title from first # heading
        let title = '';
        let noteContent = content;

        const lines = content.split('\n');
        if (lines[0]?.startsWith('# ')) {
          title = lines[0].slice(2).trim();
          noteContent = lines.slice(1).join('\n').trim();
        } else {
          // Use filename without extension as title
          const fileName = parts[parts.length - 1];
          title = fileName.replace(/\.md$/i, '');
        }

        // Determine notebook ID
        let notebookId: string | null = null;
        if (folderName && folderName !== 'Uncategorized') {
          // Check if we have a mapping from manifest
          notebookId = notebookNameToId.get(folderName) || null;

          // If not, try to find or create by folder name
          if (!notebookId) {
            const existing = appStore.notebooks.find(
              (nb) => nb.name.toLowerCase() === folderName.toLowerCase()
            );
            if (existing) {
              notebookId = existing.id;
            } else {
              try {
                const newNb = await storage.createNotebook({ name: folderName, color: null });
                notebookId = newNb.id;
                notebookNameToId.set(folderName, newNb.id);
                result.notebooksImported++;
              } catch {
                // Continue without notebook
              }
            }
          }
        }

        // Create the note
        const note = await storage.createNote({
          title,
          content: noteContent,
          notebookId,
        });

        allNotes = [...allNotes, note];
        result.notesImported++;
      } catch (error) {
        result.errors.push(`Failed to import "${filePath}"`);
      }
    }

    // Reload app store to get updated notebooks/tags
    await appStore.initialize();
  } catch (error) {
    result.errors.push(`Failed to read ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// -----------------------------------------------------------------------------
// Bulk Import Functions
// -----------------------------------------------------------------------------

interface ImportResult {
  notesImported: number;
  notebooksImported: number;
  tagsImported: number;
  errors: string[];
}

async function importFromJson(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    notesImported: 0,
    notebooksImported: 0,
    tagsImported: 0,
    errors: [],
  };

  try {
    const text = await file.text();
    const data = JSON.parse(text) as ExportData;

    // Validate format
    if (!data.version || !data.notes) {
      throw new Error('Invalid VINY export format');
    }

    const { appStore } = await import('./app.svelte');
    const storage = await import('@viny/storage');

    // Track existing items to avoid duplicates
    const existingNoteIds = new Set(allNotes.map((n) => n.id));
    const existingNotebookIds = new Set(appStore.notebooks.map((n) => n.id));
    const existingTagNames = new Set(appStore.tags.map((t) => t.name.toLowerCase()));

    // Import notebooks first (notes reference them)
    if (data.notebooks) {
      for (const notebook of data.notebooks) {
        if (!existingNotebookIds.has(notebook.id)) {
          try {
            await storage.createNotebook({
              name: notebook.name,
              color: notebook.color,
            });
            // We can't preserve the original ID, so we need to map old ID to new ID
            result.notebooksImported++;
          } catch (error) {
            result.errors.push(`Failed to import notebook "${notebook.name}"`);
          }
        }
      }
    }

    // Import tags
    if (data.tags) {
      for (const tag of data.tags) {
        if (!existingTagNames.has(tag.name.toLowerCase())) {
          try {
            await storage.findOrCreateTag(tag.name);
            result.tagsImported++;
          } catch (error) {
            result.errors.push(`Failed to import tag "${tag.name}"`);
          }
        }
      }
    }

    // Import notes
    for (const noteData of data.notes) {
      // Skip if note with same ID already exists
      if (existingNoteIds.has(noteData.id)) {
        continue;
      }

      try {
        // Find notebook by name (since IDs might differ)
        let notebookId: string | null = null;
        if (noteData.notebookId && data.notebooks) {
          const originalNotebook = data.notebooks.find((nb) => nb.id === noteData.notebookId);
          if (originalNotebook) {
            const matchingNotebook = appStore.notebooks.find(
              (nb) => nb.name.toLowerCase() === originalNotebook.name.toLowerCase()
            );
            notebookId = matchingNotebook?.id ?? null;
          }
        }

        // Create the note
        const note = await storage.createNote({
          title: noteData.title,
          content: noteData.content,
          notebookId,
        });

        // Add tags by name
        if (noteData.tags && noteData.tags.length > 0) {
          for (const tagId of noteData.tags) {
            // Find tag name from export data
            const tagData = data.tags?.find((t) => t.id === tagId);
            if (tagData) {
              const existingTag = appStore.tags.find(
                (t) => t.name.toLowerCase() === tagData.name.toLowerCase()
              );
              if (existingTag) {
                await storage.addNoteTag(note.id, existingTag.id);
              }
            }
          }
        }

        // Update isPinned if needed
        if (noteData.isPinned) {
          await storage.toggleNotePin(note.id);
        }

        result.notesImported++;
      } catch (error) {
        result.errors.push(`Failed to import note "${noteData.title || 'Untitled'}"`);
      }
    }

    // Refresh state from storage
    await initialize();

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Import a single markdown note (for Obsidian import)
async function importMarkdownNote(title: string, content: string): Promise<void> {
  const storage = await import('@viny/storage');

  // Check if a note with this title already exists
  const existingNote = allNotes.find(
    (n) => n.title.toLowerCase() === title.toLowerCase()
  );

  if (existingNote) {
    // Update existing note's content
    await storage.updateNote(existingNote.id, {
      content: existingNote.content + '\n\n---\n\n' + content,
    });
  } else {
    // Create new note
    const note = await storage.createNote({
      title,
      content,
      notebookId: null,
    });

    allNotes = [...allNotes, note];
    selectedNoteId = note.id;
  }
}

export const notesStore = {
  get notes() {
    return notes;
  },
  get allNotes() {
    return allNotes;
  },
  get trashedNotes() {
    return trashedNotes;
  },
  get filteredNotes() {
    return filteredNotes();
  },
  get selectedNote() {
    return selectedNote;
  },
  get selectedNoteId() {
    return selectedNoteId;
  },
  get selectedNotebookId() {
    return selectedNotebookId;
  },
  get viewingTrash() {
    return viewingTrash;
  },
  get viewingArchive() {
    return viewingArchive;
  },
  get selectedTrashedNote() {
    return selectedTrashedNote;
  },
  get selectedTrashedNoteId() {
    return selectedTrashedNoteId;
  },
  get archivedNotes() {
    return archivedNotes;
  },
  get selectedArchivedNote() {
    return selectedArchivedNote;
  },
  get selectedArchivedNoteId() {
    return selectedArchivedNoteId;
  },
  get pinnedNotes() {
    return pinnedNotes;
  },
  get unpinnedNotes() {
    return unpinnedNotes;
  },
  get recentNotes() {
    return recentNotes;
  },
  get searchQuery() {
    return searchQuery;
  },
  get filterByTagId() {
    return filterByTagId;
  },
  get sortBy() {
    return sortBy;
  },
  get sortOrder() {
    return sortOrder;
  },
  get viewMode() {
    return viewMode;
  },
  get isLoading() {
    return isLoading;
  },
  get isInitialized() {
    return isInitialized;
  },
  initialize,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  togglePin,
  selectNote,
  selectTrashedNote,
  setSearchQuery,
  setTagFilter,
  // Recent searches
  get recentSearches() {
    return recentSearches;
  },
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  clearTagFilter,
  // Search filters
  get searchFilters() {
    return searchFilters;
  },
  setSearchFilter,
  resetSearchFilters,
  toggleFuzzySearch,
  setDateFilter,
  clearDateFilter,
  setSort,
  setViewMode,
  toggleViewMode,
  setNotebook,
  setViewingTrash,
  setViewingArchive,
  selectArchivedNote,
  archiveNote,
  unarchiveNote,
  addTag,
  removeTag,
  updateNoteTags,
  moveNote,
  duplicateNote,
  navigateToNoteByTitle,
  getBacklinks,
  getForwardLinks,
  getLinkedTitles,
  getGraphData,
  openDailyNote,
  openRandomNote,
  getTemplates,
  createNoteFromTemplate,
  exportNote,
  exportNoteAsHtml,
  copyNoteToClipboard,
  emptyTrash,
  getNoteStats,
  printNote,
  clearRecentNotes,
  reorderNotes,
  getNoteVersions,
  restoreNoteVersion,
  getAllTemplates,
  saveNoteAsTemplate,
  deleteCustomTemplate,
  createFromAnyTemplate,
  importNotesFromMarkdown,
  exportAllAsJson,
  exportAllAsMarkdown,
  exportAllAsZip,
  importFromJson,
  importFromZip,
  importMarkdownNote,
  // Multi-select
  get isSelectMode() {
    return isSelectMode;
  },
  get selectedNoteIds() {
    return selectedNoteIds;
  },
  get selectedCount() {
    return selectedNoteIds.size;
  },
  toggleSelectMode,
  exitSelectMode,
  toggleNoteSelection,
  selectAllNotes,
  deselectAllNotes,
  isNoteSelected,
  bulkDeleteNotes,
  bulkArchiveNotes,
  bulkMoveNotes,
  bulkTogglePin,
  bulkAddTag,
  // Writing stats
  getWritingStats,
};
