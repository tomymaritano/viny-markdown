/**
 * Viny API - Typed wrapper for Tauri commands
 *
 * This is the single interface between UI and the Rust engine.
 * All data operations go through these functions.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesFilter,
  Notebook,
  CreateNotebookInput,
  UpdateNotebookInput,
  Tag,
  CreateTagInput,
  UpdateTagInput,
  LocalSyncState,
  SyncPayload,
  SyncStats,
  SyncConflict,
  SearchOptions,
  SearchResult,
  ExportStats,
  ImportOptions,
  ImportStats,
} from './bindings';

// ============================================================================
// Notes API
// ============================================================================

export async function listNotes(filter?: ListNotesFilter): Promise<Note[]> {
  return invoke('list_notes', { filter });
}

export async function getNote(id: string): Promise<Note> {
  return invoke('get_note', { id });
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  return invoke('create_note', { input });
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  return invoke('update_note', { id, input });
}

export async function deleteNote(id: string, hard?: boolean): Promise<void> {
  return invoke('delete_note', { id, hard });
}

export async function restoreNote(id: string): Promise<Note> {
  return invoke('restore_note', { id });
}

export async function getTrashedNotes(): Promise<Note[]> {
  return invoke('get_trashed_notes');
}

// ============================================================================
// Notebooks API
// ============================================================================

export async function listNotebooks(): Promise<Notebook[]> {
  return invoke('list_notebooks');
}

export async function getNotebook(id: string): Promise<Notebook> {
  return invoke('get_notebook', { id });
}

export async function createNotebook(input: CreateNotebookInput): Promise<Notebook> {
  return invoke('create_notebook', { input });
}

export async function updateNotebook(id: string, input: UpdateNotebookInput): Promise<Notebook> {
  return invoke('update_notebook', { id, input });
}

export async function deleteNotebook(id: string, hard?: boolean): Promise<void> {
  return invoke('delete_notebook', { id, hard });
}

export async function getRootNotebooks(): Promise<Notebook[]> {
  return invoke('get_root_notebooks');
}

export async function getChildNotebooks(parentId: string): Promise<Notebook[]> {
  return invoke('get_child_notebooks', { parentId });
}

// ============================================================================
// Tags API
// ============================================================================

export async function listTags(): Promise<Tag[]> {
  return invoke('list_tags');
}

export async function getTag(id: string): Promise<Tag> {
  return invoke('get_tag', { id });
}

export async function getTagByName(name: string): Promise<Tag | null> {
  return invoke('get_tag_by_name', { name });
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  return invoke('create_tag', { input });
}

export async function findOrCreateTag(name: string, color?: string): Promise<Tag> {
  return invoke('find_or_create_tag', { name, color });
}

export async function updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
  return invoke('update_tag', { id, input });
}

export async function deleteTag(id: string, hard?: boolean): Promise<void> {
  return invoke('delete_tag', { id, hard });
}

export async function mergeTags(sourceId: string, targetId: string): Promise<Tag> {
  return invoke('merge_tags', { sourceId, targetId });
}

// ============================================================================
// Sync API
// ============================================================================

/**
 * Get current local sync state (last revisions, pending changes count)
 */
export async function getLocalSyncState(): Promise<LocalSyncState> {
  return invoke('get_local_sync_state');
}

/**
 * Get changes that need to be pushed to server
 */
export async function getPendingChanges(): Promise<SyncPayload> {
  return invoke('get_pending_changes');
}

/**
 * Apply remote changes from server (pull)
 * Uses LWW conflict resolution: higher revision wins, then newer updated_at
 */
export async function applyRemoteChanges(
  payload: SyncPayload
): Promise<[SyncStats, SyncConflict[]]> {
  return invoke('apply_remote_changes', { payload });
}

/**
 * Mark changes as pushed (after successful push to server)
 */
export async function markChangesPushed(upToRevision: number): Promise<void> {
  return invoke('mark_changes_pushed', { upToRevision });
}

/**
 * Prepare for sync - returns current state and pending changes
 */
export async function prepareSync(): Promise<[LocalSyncState, SyncPayload]> {
  return invoke('prepare_sync');
}

/**
 * Sync with remote server
 * Performs pull (fetch remote changes) then push (send local changes)
 */
export async function syncWithServer(serverUrl: string): Promise<SyncResult> {
  return invoke('sync_with_server', { serverUrl });
}

/**
 * Check if server is reachable
 */
export async function checkServerConnection(serverUrl: string): Promise<boolean> {
  return invoke('check_server_connection', { serverUrl });
}

// ============================================================================
// Search API
// ============================================================================

/**
 * Full-text search across notes using FTS5
 * Searches title, content, and tags with prefix matching
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  return invoke('search', { options });
}

/**
 * Rebuild the FTS5 search index
 * Useful after data migration or if index gets corrupted
 */
export async function rebuildSearchIndex(): Promise<void> {
  return invoke('rebuild_search_index');
}

// ============================================================================
// Export/Import API
// ============================================================================

/**
 * Export all data to a ZIP file
 */
export async function exportData(path: string): Promise<ExportStats> {
  return invoke('export_data', { path });
}

/**
 * Import data from a ZIP file
 */
export async function importData(options: ImportOptions): Promise<ImportStats> {
  return invoke('import_data', { options });
}

/**
 * Get export preview (counts without creating file)
 */
export async function getExportPreview(): Promise<ExportStats> {
  return invoke('get_export_preview');
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesFilter,
  Notebook,
  CreateNotebookInput,
  UpdateNotebookInput,
  Tag,
  CreateTagInput,
  UpdateTagInput,
} from './bindings';

export type {
  NoteStatus,
  SyncState,
  LocalSyncState,
  SyncPayload,
  SyncStats,
  SyncConflict,
  SyncRequest,
  SyncResult,
  SearchOptions,
  SearchResult,
  ExportData,
  ExportStats,
  ImportOptions,
  ImportStats,
} from './bindings';
