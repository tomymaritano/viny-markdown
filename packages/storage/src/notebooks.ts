// =============================================================================
// Notebooks Repository
// =============================================================================

import type { Notebook, NotebookCreatedPayload, NotebookUpdatedPayload } from '@viny/domain';
import { dbExecute, dbSelect, saveDatabase } from './database.js';
import { createOperation } from './operations.js';
import { generateId, now } from './utils.js';

const LOCAL_DEVICE_ID = 'local-device';
const LOCAL_OWNER_ID = 'local-user';

export interface CreateNotebookInput {
  name: string;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
}

// DB row type (snake_case from SQLite)
interface NotebookRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string;
}

// Convert DB row to Notebook domain object
function rowToNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ownerId: row.owner_id,
  };
}

/**
 * Create a new notebook
 */
export async function createNotebook(input: CreateNotebookInput): Promise<Notebook> {
  const id = generateId();
  const timestamp = now();

  const notebook: Notebook = {
    id,
    name: input.name,
    color: input.color ?? null,
    icon: input.icon ?? null,
    parentId: input.parentId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ownerId: LOCAL_OWNER_ID,
  };

  await dbExecute(
    `INSERT INTO notebooks (id, name, color, icon, parent_id, created_at, updated_at, deleted_at, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notebook.id,
      notebook.name,
      notebook.color,
      notebook.icon,
      notebook.parentId,
      notebook.createdAt,
      notebook.updatedAt,
      notebook.deletedAt,
      notebook.ownerId,
    ]
  );

  const payload: NotebookCreatedPayload = {
    name: notebook.name,
    color: notebook.color,
    icon: notebook.icon,
    parentId: notebook.parentId,
  };

  await createOperation({
    type: 'NOTEBOOK_CREATED',
    entityType: 'notebook',
    entityId: notebook.id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return notebook;
}

/**
 * Get a notebook by ID
 */
export async function getNotebook(id: string): Promise<Notebook | null> {
  const rows = await dbSelect<NotebookRow>(`SELECT * FROM notebooks WHERE id = ?`, [id]);
  if (!rows.length) return null;
  return rowToNotebook(rows[0]);
}

/**
 * Get all notebooks (excluding deleted)
 */
export async function getAllNotebooks(): Promise<Notebook[]> {
  const rows = await dbSelect<NotebookRow>(
    `SELECT * FROM notebooks WHERE deleted_at IS NULL ORDER BY name ASC`
  );
  return rows.map(rowToNotebook);
}

/**
 * Get root notebooks (no parent)
 */
export async function getRootNotebooks(): Promise<Notebook[]> {
  const rows = await dbSelect<NotebookRow>(
    `SELECT * FROM notebooks WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY name ASC`
  );
  return rows.map(rowToNotebook);
}

/**
 * Get child notebooks
 */
export async function getChildNotebooks(parentId: string): Promise<Notebook[]> {
  const rows = await dbSelect<NotebookRow>(
    `SELECT * FROM notebooks WHERE parent_id = ? AND deleted_at IS NULL ORDER BY name ASC`,
    [parentId]
  );
  return rows.map(rowToNotebook);
}

/**
 * Update a notebook
 */
export async function updateNotebook(
  id: string,
  updates: { name?: string; color?: string | null; icon?: string | null }
): Promise<Notebook | null> {
  const timestamp = now();

  const affectedFields: Array<'name' | 'color' | 'icon'> = [];
  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [timestamp];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
    affectedFields.push('name');
  }

  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
    affectedFields.push('color');
  }

  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
    affectedFields.push('icon');
  }

  if (affectedFields.length === 0) {
    return getNotebook(id);
  }

  values.push(id);
  await dbExecute(`UPDATE notebooks SET ${setClauses.join(', ')} WHERE id = ?`, values);

  const payload: NotebookUpdatedPayload = {
    ...updates,
    affectedFields,
  };

  await createOperation({
    type: 'NOTEBOOK_UPDATED',
    entityType: 'notebook',
    entityId: id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getNotebook(id);
}

/**
 * Delete a notebook (soft delete)
 */
export async function deleteNotebook(id: string): Promise<boolean> {
  const timestamp = now();

  // Move notes in this notebook to no notebook
  await dbExecute(`UPDATE notes SET notebook_id = NULL, updated_at = ? WHERE notebook_id = ?`, [
    timestamp,
    id,
  ]);

  // Soft delete the notebook
  await dbExecute(`UPDATE notebooks SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    timestamp,
    timestamp,
    id,
  ]);

  await createOperation({
    type: 'NOTEBOOK_DELETED',
    entityType: 'notebook',
    entityId: id,
    payload: {},
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return true;
}

/**
 * Get note count for a notebook
 */
export async function getNotebookNoteCount(notebookId: string): Promise<number> {
  interface CountRow { 'COUNT(*)': number }
  const rows = await dbSelect<CountRow>(
    `SELECT COUNT(*) FROM notes WHERE notebook_id = ? AND deleted_at IS NULL`,
    [notebookId]
  );

  if (!rows.length) return 0;
  return rows[0]['COUNT(*)'];
}
