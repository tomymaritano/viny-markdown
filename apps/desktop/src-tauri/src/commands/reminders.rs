use rusqlite::params;
use tauri::State;

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{CreateReminderInput, Reminder, UpdateReminderInput};

fn row_to_reminder(row: &rusqlite::Row) -> rusqlite::Result<Reminder> {
    Ok(Reminder {
        id: row.get(0)?,
        note_id: row.get(1)?,
        message: row.get(2)?,
        due_date: row.get(3)?,
        completed: row.get::<_, i32>(4)? != 0,
        notified: row.get::<_, i32>(5)? != 0,
        revision: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        deleted_at: row.get(9)?,
    })
}

/// List all reminders
#[tauri::command]
pub fn list_reminders(db: State<'_, Database>) -> Result<Vec<Reminder>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders WHERE deleted_at IS NULL
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map([], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get reminders for a specific note
#[tauri::command]
pub fn get_reminders_by_note(db: State<'_, Database>, note_id: String) -> Result<Vec<Reminder>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders WHERE note_id = ? AND deleted_at IS NULL
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map(params![note_id], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get upcoming reminders (not completed, due in the next N days)
#[tauri::command]
pub fn get_upcoming_reminders(db: State<'_, Database>, days: Option<i32>) -> Result<Vec<Reminder>> {
    let conn = db.conn();
    let days = days.unwrap_or(30);

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND due_date >= datetime('now')
           AND due_date <= datetime('now', ? || ' days')
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map(params![days.to_string()], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get overdue reminders (not completed, past due date)
#[tauri::command]
pub fn get_overdue_reminders(db: State<'_, Database>) -> Result<Vec<Reminder>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND due_date < datetime('now')
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map([], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get today's reminders
#[tauri::command]
pub fn get_today_reminders(db: State<'_, Database>) -> Result<Vec<Reminder>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND date(due_date) = date('now')
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map([], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get reminders that need notification (due and not yet notified)
#[tauri::command]
pub fn get_due_reminders(db: State<'_, Database>) -> Result<Vec<Reminder>> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND notified = 0
           AND due_date <= datetime('now')
         ORDER BY due_date ASC",
    )?;

    let reminders = stmt
        .query_map([], row_to_reminder)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(reminders)
}

/// Get a single reminder by ID
#[tauri::command]
pub fn get_reminder(db: State<'_, Database>, id: String) -> Result<Reminder> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
         FROM reminders WHERE id = ?",
    )?;

    stmt.query_row(params![id], row_to_reminder)
        .map_err(|_| AppError::NotFound(format!("Reminder {} not found", id)))
}

/// Create a new reminder
#[tauri::command]
pub fn create_reminder(db: State<'_, Database>, input: CreateReminderInput) -> Result<Reminder> {
    let conn = db.conn();

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let message = input.message.unwrap_or_default();

    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, 1, ?, ?)",
        params![id, input.note_id, message, input.due_date, now, now],
    )?;

    drop(conn);
    get_reminder(db, id)
}

/// Update a reminder
#[tauri::command]
pub fn update_reminder(
    db: State<'_, Database>,
    id: String,
    input: UpdateReminderInput,
) -> Result<Reminder> {
    // First check if reminder exists
    let existing = {
        let conn = db.conn();
        let mut stmt = conn.prepare(
            "SELECT id, note_id, message, due_date, completed, notified, revision, created_at, updated_at, deleted_at
             FROM reminders WHERE id = ?",
        )?;
        stmt.query_row(params![&id], row_to_reminder)
            .map_err(|_| AppError::NotFound(format!("Reminder {} not found", id)))?
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_revision = existing.revision + 1;

    let message = input.message.unwrap_or(existing.message);
    let due_date = input.due_date.unwrap_or(existing.due_date);
    let completed = input.completed.unwrap_or(existing.completed);
    let notified = input.notified.unwrap_or(existing.notified);

    {
        let conn = db.conn();
        conn.execute(
            "UPDATE reminders SET message = ?, due_date = ?, completed = ?, notified = ?, revision = ?, updated_at = ?
             WHERE id = ?",
            params![
                message,
                due_date,
                completed as i32,
                notified as i32,
                new_revision,
                now,
                id
            ],
        )?;
    }

    get_reminder(db, id)
}

/// Mark a reminder as completed
#[tauri::command]
pub fn complete_reminder(db: State<'_, Database>, id: String) -> Result<Reminder> {
    update_reminder(
        db,
        id,
        UpdateReminderInput {
            message: None,
            due_date: None,
            completed: Some(true),
            notified: None,
        },
    )
}

/// Mark a reminder as notified
#[tauri::command]
pub fn mark_reminder_notified(db: State<'_, Database>, id: String) -> Result<Reminder> {
    update_reminder(
        db,
        id,
        UpdateReminderInput {
            message: None,
            due_date: None,
            completed: None,
            notified: Some(true),
        },
    )
}

/// Delete a reminder (soft delete)
#[tauri::command]
pub fn delete_reminder(db: State<'_, Database>, id: String, hard: Option<bool>) -> Result<()> {
    let conn = db.conn();

    if hard.unwrap_or(false) {
        conn.execute("DELETE FROM reminders WHERE id = ?", params![id])?;
    } else {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE reminders SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
            params![now, now, id],
        )?;
    }

    Ok(())
}

/// Delete all reminders for a note
#[tauri::command]
pub fn delete_note_reminders(db: State<'_, Database>, note_id: String) -> Result<()> {
    let conn = db.conn();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE reminders SET deleted_at = ?, revision = revision + 1, updated_at = ? WHERE note_id = ? AND deleted_at IS NULL",
        params![now, now, note_id],
    )?;

    Ok(())
}
