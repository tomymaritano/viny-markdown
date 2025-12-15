//! Export/Import module
//!
//! Provides ZIP-based backup and restore functionality:
//! - Export: Creates a ZIP with all notes, notebooks, tags as JSON
//! - Import: Restores data from a ZIP backup

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::State;
use ts_rs::TS;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::db::Database;
use crate::error::Result;
use crate::models::{Note, NoteStatus, Notebook, Tag};

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct ExportData {
    pub version: String,
    pub exported_at: String,
    pub notes: Vec<Note>,
    pub notebooks: Vec<Notebook>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct ExportStats {
    pub notes: i32,
    pub notebooks: i32,
    pub tags: i32,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct ImportStats {
    pub notes_imported: i32,
    pub notebooks_imported: i32,
    pub tags_imported: i32,
    pub notes_skipped: i32,
    pub notebooks_skipped: i32,
    pub tags_skipped: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct ImportOptions {
    pub overwrite_existing: bool,
    pub file_path: String,
}

// =============================================================================
// Export Functions
// =============================================================================

/// Get all data for export
fn get_export_data(db: &Database) -> Result<ExportData> {
    let conn = db.conn();

    // Get all notes (including soft-deleted for full backup)
    let mut notes_stmt = conn.prepare(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
         FROM notes"
    )?;

    let notes: Vec<Note> = notes_stmt
        .query_map([], |row| {
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
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    // Get all notebooks
    let mut notebooks_stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks"
    )?;

    let notebooks: Vec<Notebook> = notebooks_stmt
        .query_map([], |row| {
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
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    // Get all tags
    let mut tags_stmt = conn.prepare(
        "SELECT id, name, color, revision, created_at, updated_at, deleted_at
         FROM tags"
    )?;

    let tags: Vec<Tag> = tags_stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                revision: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(ExportData {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        notes,
        notebooks,
        tags,
    })
}

/// Export all data to a ZIP file
pub fn export_to_zip(db: &Database, path: PathBuf) -> Result<ExportStats> {
    let data = get_export_data(db)?;

    let file = File::create(&path).map_err(|e| crate::error::AppError::Io(e.to_string()))?;
    let mut zip = ZipWriter::new(file);

    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Write data.json
    zip.start_file("data.json", options)
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    zip.write_all(json.as_bytes())
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    zip.finish()
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    Ok(ExportStats {
        notes: data.notes.len() as i32,
        notebooks: data.notebooks.len() as i32,
        tags: data.tags.len() as i32,
        file_path: path.to_string_lossy().to_string(),
    })
}

// =============================================================================
// Import Functions
// =============================================================================

/// Import data from a ZIP file
pub fn import_from_zip(db: &Database, path: PathBuf, overwrite: bool) -> Result<ImportStats> {
    let file = File::open(&path).map_err(|e| crate::error::AppError::Io(e.to_string()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    // Read data.json
    let mut data_file = archive
        .by_name("data.json")
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    let mut contents = String::new();
    data_file
        .read_to_string(&mut contents)
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    let data: ExportData = serde_json::from_str(&contents)
        .map_err(|e| crate::error::AppError::Io(e.to_string()))?;

    let conn = db.conn();
    let mut stats = ImportStats {
        notes_imported: 0,
        notebooks_imported: 0,
        tags_imported: 0,
        notes_skipped: 0,
        notebooks_skipped: 0,
        tags_skipped: 0,
    };

    // Import notebooks first (notes reference them)
    for notebook in &data.notebooks {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM notebooks WHERE id = ?",
                params![&notebook.id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if exists && !overwrite {
            stats.notebooks_skipped += 1;
            continue;
        }

        conn.execute(
            "INSERT OR REPLACE INTO notebooks (id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                notebook.id,
                notebook.name,
                notebook.color,
                notebook.icon,
                notebook.parent_id,
                notebook.revision,
                notebook.created_at,
                notebook.updated_at,
                notebook.deleted_at,
            ],
        )?;
        stats.notebooks_imported += 1;
    }

    // Import tags
    for tag in &data.tags {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM tags WHERE id = ?",
                params![&tag.id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if exists && !overwrite {
            stats.tags_skipped += 1;
            continue;
        }

        conn.execute(
            "INSERT OR REPLACE INTO tags (id, name, color, revision, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                tag.id,
                tag.name,
                tag.color,
                tag.revision,
                tag.created_at,
                tag.updated_at,
                tag.deleted_at,
            ],
        )?;
        stats.tags_imported += 1;
    }

    // Import notes
    for note in &data.notes {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM notes WHERE id = ?",
                params![&note.id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if exists && !overwrite {
            stats.notes_skipped += 1;
            continue;
        }

        let tags_json = serde_json::to_string(&note.tags).unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                note.id,
                note.title,
                note.content,
                note.notebook_id,
                tags_json,
                note.status.as_str(),
                note.is_pinned as i32,
                note.revision,
                note.created_at,
                note.updated_at,
                note.deleted_at,
            ],
        )?;
        stats.notes_imported += 1;
    }

    Ok(stats)
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Export all data to a ZIP file
#[tauri::command]
pub fn export_data(db: State<'_, Database>, path: String) -> Result<ExportStats> {
    export_to_zip(&db, PathBuf::from(path))
}

/// Import data from a ZIP file
#[tauri::command]
pub fn import_data(db: State<'_, Database>, options: ImportOptions) -> Result<ImportStats> {
    import_from_zip(&db, PathBuf::from(&options.file_path), options.overwrite_existing)
}

/// Get export data preview (without writing to file)
#[tauri::command]
pub fn get_export_preview(db: State<'_, Database>) -> Result<ExportStats> {
    let data = get_export_data(&db)?;
    Ok(ExportStats {
        notes: data.notes.len() as i32,
        notebooks: data.notebooks.len() as i32,
        tags: data.tags.len() as i32,
        file_path: String::new(),
    })
}
