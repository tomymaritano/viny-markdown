// =============================================================================
// Notes Repository
// =============================================================================

import type {
  Note,
  NoteStatus,
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NoteTagAddedPayload,
  NoteTagRemovedPayload,
} from '@viny/domain';
import { dbExecute, dbSelect, saveDatabase } from './database.js';
import { createOperation } from './operations.js';
import { generateId, now } from './utils.js';

// Default device/owner for local-only mode
const LOCAL_DEVICE_ID = 'local-device';
const LOCAL_OWNER_ID = 'local-user';

export interface CreateNoteInput {
  title?: string;
  content?: string;
  notebookId?: string | null;
  status?: NoteStatus;
}

// DB row type (snake_case from SQLite)
interface NoteRow {
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  tags: string;
  status: NoteStatus;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string;
}

// Convert DB row to Note domain object
function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    notebookId: row.notebook_id,
    tags: JSON.parse(row.tags),
    status: row.status,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ownerId: row.owner_id,
  };
}

/**
 * Create a new note
 */
export async function createNote(input: CreateNoteInput = {}): Promise<Note> {
  const id = generateId();
  const timestamp = now();

  const note: Note = {
    id,
    title: input.title ?? '',
    content: input.content ?? '',
    notebookId: input.notebookId ?? null,
    tags: [],
    status: input.status ?? 'active',
    isPinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ownerId: LOCAL_OWNER_ID,
  };

  // Insert into notes table
  await dbExecute(
    `INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, created_at, updated_at, deleted_at, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.title,
      note.content,
      note.notebookId,
      JSON.stringify(note.tags),
      note.status,
      note.isPinned ? 1 : 0,
      note.createdAt,
      note.updatedAt,
      note.deletedAt,
      note.ownerId,
    ]
  );

  // Create operation for event sourcing
  const payload: NoteCreatedPayload = {
    title: note.title,
    content: note.content,
    notebookId: note.notebookId,
    status: note.status,
  };

  await createOperation({
    type: 'NOTE_CREATED',
    entityType: 'note',
    entityId: note.id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return note;
}

/**
 * Get a note by ID
 */
export async function getNote(id: string): Promise<Note | null> {
  const rows = await dbSelect<NoteRow>(`SELECT * FROM notes WHERE id = ?`, [id]);
  if (!rows.length) return null;
  return rowToNote(rows[0]);
}

/**
 * Get all notes (excluding deleted)
 */
export async function getAllNotes(): Promise<Note[]> {
  const rows = await dbSelect<NoteRow>(
    `SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC`
  );
  return rows.map(rowToNote);
}

/**
 * Get notes by status
 */
export async function getNotesByStatus(status: NoteStatus): Promise<Note[]> {
  const rows = await dbSelect<NoteRow>(
    `SELECT * FROM notes WHERE status = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [status]
  );
  return rows.map(rowToNote);
}

/**
 * Get deleted notes (trash)
 */
export async function getDeletedNotes(): Promise<Note[]> {
  const rows = await dbSelect<NoteRow>(
    `SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  return rows.map(rowToNote);
}

/**
 * Permanently delete a note
 */
export async function permanentlyDeleteNote(id: string): Promise<boolean> {
  await dbExecute(`DELETE FROM notes WHERE id = ?`, [id]);
  saveDatabase();
  return true;
}

/**
 * Get notes by notebook (null for unorganized)
 */
export async function getNotesByNotebook(notebookId: string | null): Promise<Note[]> {
  const rows = notebookId
    ? await dbSelect<NoteRow>(
        `SELECT * FROM notes WHERE notebook_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
        [notebookId]
      )
    : await dbSelect<NoteRow>(
        `SELECT * FROM notes WHERE notebook_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC`
      );
  return rows.map(rowToNote);
}

/**
 * Move a note to a different notebook
 */
export async function moveNote(id: string, toNotebookId: string | null): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;

  const timestamp = now();
  const fromNotebookId = note.notebookId;

  await dbExecute(`UPDATE notes SET notebook_id = ?, updated_at = ? WHERE id = ?`, [
    toNotebookId,
    timestamp,
    id,
  ]);

  await createOperation({
    type: 'NOTE_MOVED',
    entityType: 'note',
    entityId: id,
    payload: { fromNotebookId, toNotebookId },
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(id);
}

/**
 * Duplicate a note
 */
export async function duplicateNote(id: string): Promise<Note | null> {
  const original = await getNote(id);
  if (!original) return null;

  const newId = generateId();
  const timestamp = now();

  const note: Note = {
    id: newId,
    title: original.title ? `Copy of ${original.title}` : 'Copy',
    content: original.content,
    notebookId: original.notebookId,
    tags: [...original.tags],
    status: 'active',
    isPinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ownerId: LOCAL_OWNER_ID,
  };

  await dbExecute(
    `INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, created_at, updated_at, deleted_at, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.title,
      note.content,
      note.notebookId,
      JSON.stringify(note.tags),
      note.status,
      note.isPinned ? 1 : 0,
      note.createdAt,
      note.updatedAt,
      note.deletedAt,
      note.ownerId,
    ]
  );

  const payload: NoteCreatedPayload = {
    title: note.title,
    content: note.content,
    notebookId: note.notebookId,
    status: note.status,
  };

  await createOperation({
    type: 'NOTE_CREATED',
    entityType: 'note',
    entityId: note.id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return note;
}

/**
 * Update a note
 */
export async function updateNote(
  id: string,
  updates: { title?: string; content?: string }
): Promise<Note | null> {
  const timestamp = now();

  const affectedFields: Array<'title' | 'content'> = [];
  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [timestamp];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
    affectedFields.push('title');
  }

  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    values.push(updates.content);
    affectedFields.push('content');
  }

  if (affectedFields.length === 0) {
    return getNote(id);
  }

  values.push(id);
  await dbExecute(`UPDATE notes SET ${setClauses.join(', ')} WHERE id = ?`, values);

  // Create operation
  const payload: NoteUpdatedPayload = {
    ...updates,
    affectedFields,
  };

  await createOperation({
    type: 'NOTE_UPDATED',
    entityType: 'note',
    entityId: id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(id);
}

/**
 * Soft delete a note
 */
export async function deleteNote(id: string): Promise<boolean> {
  const timestamp = now();

  await dbExecute(`UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    timestamp,
    timestamp,
    id,
  ]);

  await createOperation({
    type: 'NOTE_DELETED',
    entityType: 'note',
    entityId: id,
    payload: {},
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return true;
}

/**
 * Restore a deleted note
 */
export async function restoreNote(id: string): Promise<Note | null> {
  const timestamp = now();

  await dbExecute(`UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [
    timestamp,
    id,
  ]);

  await createOperation({
    type: 'NOTE_RESTORED',
    entityType: 'note',
    entityId: id,
    payload: {},
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(id);
}

/**
 * Pin/unpin a note
 */
export async function toggleNotePin(id: string): Promise<Note | null> {
  const note = await getNote(id);
  if (!note) return null;

  const timestamp = now();
  const newPinned = !note.isPinned;

  await dbExecute(`UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?`, [
    newPinned ? 1 : 0,
    timestamp,
    id,
  ]);

  await createOperation({
    type: newPinned ? 'NOTE_PINNED' : 'NOTE_UNPINNED',
    entityType: 'note',
    entityId: id,
    payload: {},
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(id);
}

/**
 * Add a tag to a note
 */
export async function addNoteTag(noteId: string, tagId: string): Promise<Note | null> {
  const note = await getNote(noteId);
  if (!note) return null;
  if (note.tags.includes(tagId)) return note; // Already has tag

  const timestamp = now();
  const newTags = [...note.tags, tagId];

  await dbExecute(`UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify(newTags),
    timestamp,
    noteId,
  ]);

  const payload: NoteTagAddedPayload = { tagId };

  await createOperation({
    type: 'NOTE_TAG_ADDED',
    entityType: 'note',
    entityId: noteId,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(noteId);
}

/**
 * Remove a tag from a note
 */
export async function removeNoteTag(noteId: string, tagId: string): Promise<Note | null> {
  const note = await getNote(noteId);
  if (!note) return null;
  if (!note.tags.includes(tagId)) return note; // Doesn't have tag

  const timestamp = now();
  const newTags = note.tags.filter((t) => t !== tagId);

  await dbExecute(`UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify(newTags),
    timestamp,
    noteId,
  ]);

  const payload: NoteTagRemovedPayload = { tagId };

  await createOperation({
    type: 'NOTE_TAG_REMOVED',
    entityType: 'note',
    entityId: noteId,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNote(noteId);
}
