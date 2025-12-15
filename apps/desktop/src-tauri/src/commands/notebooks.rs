use rusqlite::params;
use tauri::State;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{CreateNotebookInput, Notebook, UpdateNotebookInput};

fn row_to_notebook(row: &rusqlite::Row) -> rusqlite::Result<Notebook> {
    Ok(Notebook {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        icon: row.get(3)?,
        parent_id: row.get(4)?,
        revision: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        deleted_at: row.get(8)?,
    })
}

#[tauri::command]
pub fn list_notebooks(db: State<'_, Database>) -> Result<Vec<Notebook>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks WHERE deleted_at IS NULL ORDER BY name",
    )?;

    let notebooks = stmt
        .query_map([], row_to_notebook)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(notebooks)
}

#[tauri::command]
pub fn get_notebook(db: State<'_, Database>, id: String) -> Result<Notebook> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks WHERE id = ?",
    )?;

    stmt.query_row(params![id], row_to_notebook)
        .map_err(|_| AppError::NotFound(format!("Notebook {} not found", id)))
}

#[tauri::command]
pub fn create_notebook(db: State<'_, Database>, input: CreateNotebookInput) -> Result<Notebook> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    {
        let conn = db.conn();
        conn.execute(
            "INSERT INTO notebooks (id, name, color, icon, parent_id, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
            params![id, input.name, input.color, input.icon, input.parent_id, now, now],
        )?;
    }

    get_notebook(db, id)
}

#[tauri::command]
pub fn update_notebook(db: State<'_, Database>, id: String, input: UpdateNotebookInput) -> Result<Notebook> {
    let existing = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
             FROM notebooks WHERE id = ?",
        )?;
        stmt.query_row(params![&id], row_to_notebook)
            .map_err(|_| AppError::NotFound(format!("Notebook {} not found", id)))?
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_revision = existing.revision + 1;

    let name = input.name.unwrap_or(existing.name);
    let color = input.color.or(existing.color);
    let icon = input.icon.or(existing.icon);
    let parent_id = input.parent_id.or(existing.parent_id);

    {
        let conn = db.conn();
        conn.execute(
            "UPDATE notebooks SET name = ?, color = ?, icon = ?, parent_id = ?, revision = ?, updated_at = ?
             WHERE id = ?",
            params![name, color, icon, parent_id, new_revision, now, id],
        )?;
    }

    get_notebook(db, id)
}

#[tauri::command]
pub fn delete_notebook(db: State<'_, Database>, id: String, hard: Option<bool>) -> Result<()> {
    let conn = db.conn();

    if hard.unwrap_or(false) {
        conn.execute(
            "UPDATE notes SET notebook_id = NULL, revision = revision + 1, updated_at = datetime('now') WHERE notebook_id = ?",
            params![id],
        )?;
        conn.execute("DELETE FROM notebooks WHERE id = ?", params![id])?;
    } else {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET notebook_id = NULL, revision = revision + 1, updated_at = ? WHERE notebook_id = ?",
            params![now, id],
        )?;
        conn.execute(
            "UPDATE notebooks SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
            params![now, now, id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_root_notebooks(db: State<'_, Database>) -> Result<Vec<Notebook>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY name",
    )?;

    let notebooks = stmt
        .query_map([], row_to_notebook)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(notebooks)
}

#[tauri::command]
pub fn get_child_notebooks(db: State<'_, Database>, parent_id: String) -> Result<Vec<Notebook>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks WHERE parent_id = ? AND deleted_at IS NULL ORDER BY name",
    )?;

    let notebooks = stmt
        .query_map(params![parent_id], row_to_notebook)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(notebooks)
}
