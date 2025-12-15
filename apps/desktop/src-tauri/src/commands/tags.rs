use rusqlite::params;
use tauri::State;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{CreateTagInput, Tag, UpdateTagInput};

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        revision: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        deleted_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn list_tags(db: State<'_, Database>) -> Result<Vec<Tag>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, revision, created_at, updated_at, deleted_at
         FROM tags WHERE deleted_at IS NULL ORDER BY name",
    )?;

    let tags = stmt
        .query_map([], row_to_tag)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(tags)
}

#[tauri::command]
pub fn get_tag(db: State<'_, Database>, id: String) -> Result<Tag> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, revision, created_at, updated_at, deleted_at
         FROM tags WHERE id = ?",
    )?;

    stmt.query_row(params![id], row_to_tag)
        .map_err(|_| AppError::NotFound(format!("Tag {} not found", id)))
}

#[tauri::command]
pub fn get_tag_by_name(db: State<'_, Database>, name: String) -> Result<Option<Tag>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, revision, created_at, updated_at, deleted_at
         FROM tags WHERE name = ? AND deleted_at IS NULL",
    )?;

    match stmt.query_row(params![name], row_to_tag) {
        Ok(tag) => Ok(Some(tag)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub fn create_tag(db: State<'_, Database>, input: CreateTagInput) -> Result<Tag> {
    // Check if tag with same name exists
    {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL",
        )?;
        if stmt.exists(params![&input.name])? {
            return Err(AppError::Conflict(format!(
                "Tag '{}' already exists",
                input.name
            )));
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    {
        let conn = db.conn();
        conn.execute(
            "INSERT INTO tags (id, name, color, revision, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, ?)",
            params![id, input.name, input.color, now, now],
        )?;
    }

    get_tag(db, id)
}

#[tauri::command]
pub fn find_or_create_tag(db: State<'_, Database>, name: String, color: Option<String>) -> Result<Tag> {
    // Check if exists
    {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, revision, created_at, updated_at, deleted_at
             FROM tags WHERE name = ? AND deleted_at IS NULL",
        )?;
        if let Ok(tag) = stmt.query_row(params![&name], row_to_tag) {
            return Ok(tag);
        }
    }

    create_tag(db, CreateTagInput { name, color })
}

#[tauri::command]
pub fn update_tag(db: State<'_, Database>, id: String, input: UpdateTagInput) -> Result<Tag> {
    let existing = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, revision, created_at, updated_at, deleted_at
             FROM tags WHERE id = ?",
        )?;
        stmt.query_row(params![&id], row_to_tag)
            .map_err(|_| AppError::NotFound(format!("Tag {} not found", id)))?
    };

    // Check name uniqueness if changing name
    if let Some(ref new_name) = input.name {
        if new_name != &existing.name {
            let conn = db.conn();
            let mut stmt = conn.prepare(
                "SELECT id FROM tags WHERE name = ? AND deleted_at IS NULL AND id != ?",
            )?;
            if stmt.exists(params![new_name, &id])? {
                return Err(AppError::Conflict(format!(
                    "Tag '{}' already exists",
                    new_name
                )));
            }
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    let new_revision = existing.revision + 1;

    let name = input.name.unwrap_or(existing.name);
    let color = input.color.or(existing.color);

    {
        let conn = db.conn();
        conn.execute(
            "UPDATE tags SET name = ?, color = ?, revision = ?, updated_at = ? WHERE id = ?",
            params![name, color, new_revision, now, id],
        )?;
    }

    get_tag(db, id)
}

#[tauri::command]
pub fn delete_tag(db: State<'_, Database>, id: String, hard: Option<bool>) -> Result<()> {
    let existing = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, revision, created_at, updated_at, deleted_at
             FROM tags WHERE id = ?",
        )?;
        stmt.query_row(params![&id], row_to_tag)
            .map_err(|_| AppError::NotFound(format!("Tag {} not found", id)))?
    };

    let conn = db.conn();

    // Remove tag from all notes
    let tag_pattern = format!("\"{}\"", existing.name);
    conn.execute(
        "UPDATE notes SET tags = REPLACE(tags, ?, ''), revision = revision + 1, updated_at = datetime('now')
         WHERE tags LIKE ?",
        params![tag_pattern, format!("%{}%", tag_pattern)],
    )?;

    if hard.unwrap_or(false) {
        conn.execute("DELETE FROM tags WHERE id = ?", params![id])?;
    } else {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tags SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
            params![now, now, id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn merge_tags(db: State<'_, Database>, source_id: String, target_id: String) -> Result<Tag> {
    let source = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, revision, created_at, updated_at, deleted_at
             FROM tags WHERE id = ?",
        )?;
        stmt.query_row(params![&source_id], row_to_tag)
            .map_err(|_| AppError::NotFound(format!("Tag {} not found", source_id)))?
    };

    let _target = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, revision, created_at, updated_at, deleted_at
             FROM tags WHERE id = ?",
        )?;
        stmt.query_row(params![&target_id], row_to_tag)
            .map_err(|_| AppError::NotFound(format!("Tag {} not found", target_id)))?
    };

    // Replace source tag with target tag in all notes
    let source_pattern = format!("\"{}\"", source.name);
    let target_pattern = format!("\"{}\"", _target.name);

    {
        let conn = db.conn();
        conn.execute(
            "UPDATE notes SET tags = REPLACE(tags, ?, ?), revision = revision + 1, updated_at = datetime('now')
             WHERE tags LIKE ?",
            params![source_pattern, target_pattern, format!("%{}%", source_pattern)],
        )?;

        // Delete source tag (hard delete since we're merging)
        conn.execute("DELETE FROM tags WHERE id = ?", params![source_id])?;
    }

    get_tag(db, target_id)
}
