use rusqlite::params;
use tauri::State;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{CreateNoteInput, ListNotesFilter, Note, NoteStatus, UpdateNoteInput};

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    let tags_json: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    let status_str: String = row.get(5)?;

    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        notebook_id: row.get(3)?,
        tags,
        status: NoteStatus::from_str(&status_str),
        is_pinned: row.get::<_, i32>(6)? != 0,
        revision: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        deleted_at: row.get(10)?,
    })
}

#[tauri::command]
pub fn list_notes(db: State<'_, Database>, filter: Option<ListNotesFilter>) -> Result<Vec<Note>> {
    let conn = db.conn();

    let filter = filter.unwrap_or(ListNotesFilter {
        notebook_id: None,
        status: None,
        tag: None,
        search: None,
        limit: None,
        offset: None,
    });

    let mut sql = String::from(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
         FROM notes WHERE deleted_at IS NULL",
    );

    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref notebook_id) = filter.notebook_id {
        conditions.push("notebook_id = ?");
        params_vec.push(Box::new(notebook_id.clone()));
    }

    if let Some(ref status) = filter.status {
        conditions.push("status = ?");
        params_vec.push(Box::new(status.as_str().to_string()));
    }

    if let Some(ref tag) = filter.tag {
        conditions.push("tags LIKE ?");
        params_vec.push(Box::new(format!("%\"{}\"", tag)));
    }

    if let Some(ref search) = filter.search {
        conditions.push("(title LIKE ? OR content LIKE ?)");
        let pattern = format!("%{}%", search);
        params_vec.push(Box::new(pattern.clone()));
        params_vec.push(Box::new(pattern));
    }

    for cond in conditions {
        sql.push_str(" AND ");
        sql.push_str(cond);
    }

    sql.push_str(" ORDER BY is_pinned DESC, updated_at DESC");

    if let Some(limit) = filter.limit {
        sql.push_str(&format!(" LIMIT {}", limit));
    }
    if let Some(offset) = filter.offset {
        sql.push_str(&format!(" OFFSET {}", offset));
    }

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let notes = stmt
        .query_map(params_refs.as_slice(), row_to_note)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(notes)
}

#[tauri::command]
pub fn get_note(db: State<'_, Database>, id: String) -> Result<Note> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
         FROM notes WHERE id = ?",
    )?;

    stmt.query_row(params![id], row_to_note)
        .map_err(|_| AppError::NotFound(format!("Note {} not found", id)))
}

#[tauri::command]
pub fn create_note(db: State<'_, Database>, input: CreateNoteInput) -> Result<Note> {
    let conn = db.conn();

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let title = input.title.unwrap_or_default();
    let content = input.content.unwrap_or_default();
    let tags_json = serde_json::to_string(&input.tags.unwrap_or_default()).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)",
        params![id, title, content, input.notebook_id, tags_json, now, now],
    )?;

    drop(conn);
    get_note(db, id)
}

#[tauri::command]
pub fn update_note(db: State<'_, Database>, id: String, input: UpdateNoteInput) -> Result<Note> {
    // First check if note exists
    let existing = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
             FROM notes WHERE id = ?",
        )?;
        stmt.query_row(params![&id], row_to_note)
            .map_err(|_| AppError::NotFound(format!("Note {} not found", id)))?
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_revision = existing.revision + 1;

    let title = input.title.unwrap_or(existing.title);
    let content = input.content.unwrap_or(existing.content);
    let notebook_id = input.notebook_id.or(existing.notebook_id);
    let tags = input.tags.unwrap_or(existing.tags);
    let status = input.status.unwrap_or(existing.status);
    let is_pinned = input.is_pinned.unwrap_or(existing.is_pinned);

    let tags_json = serde_json::to_string(&tags).unwrap();

    {
        let conn = db.conn();
        conn.execute(
            "UPDATE notes SET title = ?, content = ?, notebook_id = ?, tags = ?, status = ?, is_pinned = ?, revision = ?, updated_at = ?
             WHERE id = ?",
            params![
                title,
                content,
                notebook_id,
                tags_json,
                status.as_str(),
                is_pinned as i32,
                new_revision,
                now,
                id
            ],
        )?;
    }

    get_note(db, id)
}

#[tauri::command]
pub fn delete_note(db: State<'_, Database>, id: String, hard: Option<bool>) -> Result<()> {
    let conn = db.conn();

    if hard.unwrap_or(false) {
        conn.execute("DELETE FROM notes WHERE id = ?", params![id])?;
    } else {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?, status = 'trashed', revision = revision + 1, updated_at = ? WHERE id = ?",
            params![now, now, id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn restore_note(db: State<'_, Database>, id: String) -> Result<Note> {
    {
        let conn = db.conn();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = NULL, status = 'active', revision = revision + 1, updated_at = ? WHERE id = ?",
            params![now, id],
        )?;
    }

    get_note(db, id)
}

#[tauri::command]
pub fn get_trashed_notes(db: State<'_, Database>) -> Result<Vec<Note>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
         FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    )?;

    let notes = stmt
        .query_map([], row_to_note)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(notes)
}
