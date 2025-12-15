//! Full-text search using FTS5
//!
//! Provides fast search across note titles, content, and tags
//! using SQLite's FTS5 extension with porter stemmer.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::db::Database;
use crate::error::Result;
use crate::models::{Note, NoteStatus};

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SearchResult {
    pub note: Note,
    pub rank: f64,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SearchOptions {
    pub query: String,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub notebook_id: Option<String>,
    pub include_archived: Option<bool>,
    pub include_trashed: Option<bool>,
}

// =============================================================================
// Search Functions
// =============================================================================

/// Search notes using FTS5
pub fn search_notes(db: &Database, options: SearchOptions) -> Result<Vec<SearchResult>> {
    let conn = db.conn();

    // Build the query with FTS5 MATCH
    // Using bm25() for ranking (lower is better match)
    let mut sql = String::from(
        "SELECT
            n.id, n.title, n.content, n.notebook_id, n.tags, n.status,
            n.is_pinned, n.revision, n.created_at, n.updated_at, n.deleted_at,
            bm25(notes_fts) as rank,
            snippet(notes_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
         FROM notes_fts fts
         JOIN notes n ON fts.id = n.id
         WHERE notes_fts MATCH ?"
    );

    let mut conditions = Vec::new();

    // Filter by status
    if options.include_trashed != Some(true) {
        conditions.push("n.status != 'trashed'");
    }
    if options.include_archived != Some(true) {
        conditions.push("n.status != 'archived'");
    }

    // Filter by notebook
    if options.notebook_id.is_some() {
        conditions.push("n.notebook_id = ?");
    }

    // Exclude soft-deleted
    conditions.push("n.deleted_at IS NULL");

    for condition in &conditions {
        sql.push_str(" AND ");
        sql.push_str(condition);
    }

    sql.push_str(" ORDER BY rank LIMIT ? OFFSET ?");

    let limit = options.limit.unwrap_or(50);
    let offset = options.offset.unwrap_or(0);

    // Prepare FTS5 query - escape special characters and add prefix matching
    let fts_query = prepare_fts_query(&options.query);

    let mut stmt = conn.prepare(&sql)?;

    // Bind parameters based on what filters are active
    let results: Vec<SearchResult> = if let Some(ref notebook_id) = options.notebook_id {
        stmt.query_map(params![fts_query, notebook_id, limit, offset], map_search_result)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    } else {
        stmt.query_map(params![fts_query, limit, offset], map_search_result)?
            .collect::<std::result::Result<Vec<_>, _>>()?
    };

    Ok(results)
}

/// Prepare a user query for FTS5
/// Handles special characters and adds prefix matching for better UX
fn prepare_fts_query(query: &str) -> String {
    // Split into terms and handle each
    let terms: Vec<String> = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|term| {
            // Escape quotes
            let escaped = term.replace('"', "\"\"");
            // Add prefix matching with * for partial word matching
            if escaped.contains(|c: char| !c.is_alphanumeric()) {
                // If term has special chars, wrap in quotes
                format!("\"{}\"*", escaped)
            } else {
                format!("{}*", escaped)
            }
        })
        .collect();

    // Join with AND for multi-term queries
    terms.join(" ")
}

fn map_search_result(row: &rusqlite::Row) -> rusqlite::Result<SearchResult> {
    let tags_json: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    let status_str: String = row.get(5)?;

    Ok(SearchResult {
        note: Note {
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
        },
        rank: row.get(11)?,
        snippet: row.get(12)?,
    })
}

/// Rebuild the FTS index from existing notes
/// Useful for migration or if index gets corrupted
pub fn rebuild_fts_index(db: &Database) -> Result<()> {
    let conn = db.conn();

    // Clear existing FTS data
    conn.execute("DELETE FROM notes_fts", [])?;

    // Repopulate from notes table
    conn.execute(
        "INSERT INTO notes_fts(id, title, content, tags)
         SELECT id, title, content, tags FROM notes",
        [],
    )?;

    Ok(())
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Search notes with full-text search
#[tauri::command]
pub fn search(db: State<'_, Database>, options: SearchOptions) -> Result<Vec<SearchResult>> {
    search_notes(&db, options)
}

/// Rebuild FTS index
#[tauri::command]
pub fn rebuild_search_index(db: State<'_, Database>) -> Result<()> {
    rebuild_fts_index(&db)
}
