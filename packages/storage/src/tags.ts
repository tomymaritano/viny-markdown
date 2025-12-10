// =============================================================================
// Tags Repository
// =============================================================================

import type { Tag, TagCreatedPayload, TagUpdatedPayload } from '@viny/domain';
import { dbExecute, dbSelect, saveDatabase } from './database.js';
import { createOperation } from './operations.js';
import { generateId, now } from './utils.js';

const LOCAL_DEVICE_ID = 'local-device';
const LOCAL_OWNER_ID = 'local-user';

export interface CreateTagInput {
  name: string;
  color?: string | null;
}

// DB row type (snake_case from SQLite)
interface TagRow {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  owner_id: string;
}

// Convert DB row to Tag domain object
function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ownerId: row.owner_id,
  };
}

/**
 * Create a new tag
 */
export async function createTag(input: CreateTagInput): Promise<Tag> {
  const id = generateId();
  const timestamp = now();

  const tag: Tag = {
    id,
    name: input.name,
    color: input.color ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ownerId: LOCAL_OWNER_ID,
  };

  await dbExecute(
    `INSERT INTO tags (id, name, color, created_at, updated_at, deleted_at, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tag.id, tag.name, tag.color, tag.createdAt, tag.updatedAt, tag.deletedAt, tag.ownerId]
  );

  const payload: TagCreatedPayload = {
    name: tag.name,
    color: tag.color,
  };

  await createOperation({
    type: 'TAG_CREATED',
    entityType: 'tag',
    entityId: tag.id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return tag;
}

/**
 * Get a tag by ID
 */
export async function getTag(id: string): Promise<Tag | null> {
  const rows = await dbSelect<TagRow>(`SELECT * FROM tags WHERE id = ?`, [id]);
  if (!rows.length) return null;
  return rowToTag(rows[0]);
}

/**
 * Get all tags (excluding deleted)
 */
export async function getAllTags(): Promise<Tag[]> {
  const rows = await dbSelect<TagRow>(
    `SELECT * FROM tags WHERE deleted_at IS NULL ORDER BY name ASC`
  );
  return rows.map(rowToTag);
}

/**
 * Find or create a tag by name
 */
export async function findOrCreateTag(name: string): Promise<Tag> {
  const normalizedName = name.trim().toLowerCase();

  const rows = await dbSelect<TagRow>(
    `SELECT * FROM tags WHERE LOWER(name) = ? AND deleted_at IS NULL`,
    [normalizedName]
  );

  if (rows.length) {
    return rowToTag(rows[0]);
  }

  return createTag({ name: name.trim() });
}

/**
 * Update a tag
 */
export async function updateTag(
  id: string,
  updates: { name?: string; color?: string | null }
): Promise<Tag | null> {
  const timestamp = now();

  const affectedFields: Array<'name' | 'color'> = [];
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

  if (affectedFields.length === 0) {
    return getTag(id);
  }

  values.push(id);
  await dbExecute(`UPDATE tags SET ${setClauses.join(', ')} WHERE id = ?`, values);

  const payload: TagUpdatedPayload = {
    ...updates,
    affectedFields,
  };

  await createOperation({
    type: 'TAG_UPDATED',
    entityType: 'tag',
    entityId: id,
    payload,
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return getTag(id);
}

/**
 * Delete a tag (soft delete)
 */
export async function deleteTag(id: string): Promise<boolean> {
  const timestamp = now();

  // Remove tag from all notes first
  interface NoteTagRow { id: string; tags: string }
  const notesRows = await dbSelect<NoteTagRow>(
    `SELECT id, tags FROM notes WHERE deleted_at IS NULL`
  );

  for (const row of notesRows) {
    const tags = JSON.parse(row.tags) as string[];
    if (tags.includes(id)) {
      const newTags = tags.filter((t) => t !== id);
      await dbExecute(`UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?`, [
        JSON.stringify(newTags),
        timestamp,
        row.id,
      ]);
    }
  }

  // Soft delete the tag
  await dbExecute(`UPDATE tags SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    timestamp,
    timestamp,
    id,
  ]);

  await createOperation({
    type: 'TAG_DELETED',
    entityType: 'tag',
    entityId: id,
    payload: {},
    deviceId: LOCAL_DEVICE_ID,
    ownerId: LOCAL_OWNER_ID,
  });

  saveDatabase();
  return true;
}
