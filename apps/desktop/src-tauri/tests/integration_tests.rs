//! Integration tests for Viny
//!
//! Tests core database functionality: CRUD operations, FTS5, sync state

use rusqlite::{Connection, params};
use tempfile::TempDir;

/// Schema SQL - copied from src/schema.sql
const SCHEMA: &str = r#"
-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'trashed')),
    is_pinned INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    parent_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- Sync state
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_pull_revision INTEGER NOT NULL DEFAULT 0,
    last_push_revision INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT
);

INSERT OR IGNORE INTO sync_state (id, last_pull_revision, last_push_revision) VALUES (1, 0, 0);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tags,
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync with notes table
CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(id, title, content, tags)
    VALUES (NEW.id, NEW.title, NEW.content, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
    INSERT INTO notes_fts(id, title, content, tags)
    VALUES (NEW.id, NEW.title, NEW.content, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
END;
"#;

/// Helper to create a test database
fn create_test_db() -> (TempDir, Connection) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    (temp_dir, conn)
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

// =============================================================================
// Notes Tests
// =============================================================================

#[test]
fn test_create_note() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Test Note", "Hello world", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .unwrap();

    assert_eq!(count, 1);
}

#[test]
fn test_update_note_increments_revision() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Original", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "UPDATE notes SET title = ?, revision = revision + 1 WHERE id = ?",
        params!["Updated", id],
    ).unwrap();

    let revision: i64 = conn
        .query_row("SELECT revision FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(revision, 2);
}

#[test]
fn test_soft_delete_note() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "To Delete", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "UPDATE notes SET status = 'trashed', deleted_at = datetime('now') WHERE id = ?",
        params![id],
    ).unwrap();

    let status: String = conn
        .query_row("SELECT status FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(status, "trashed");
}

// =============================================================================
// FTS5 Tests
// =============================================================================

#[test]
fn test_fts_trigger_on_insert() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Searchable Title", "Some unique content xyz", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let fts_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes_fts WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(fts_count, 1);
}

#[test]
fn test_fts_search() {
    let (_dir, conn) = create_test_db();
    let id1 = new_id();
    let id2 = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id1, "Meeting Notes", "Discussion about project alpha", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id2, "Shopping List", "Buy groceries", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let mut stmt = conn.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH 'project*'").unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0)).unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0], id1);
}

#[test]
fn test_fts_trigger_on_update() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Original", "Old content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "UPDATE notes SET content = 'new unique searchterm' WHERE id = ?",
        params![id],
    ).unwrap();

    let mut stmt = conn.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH 'searchterm*'").unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0)).unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

#[test]
fn test_fts_porter_stemming() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Running Notes", "I was running yesterday", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Search for "run" should match "running" due to porter stemmer
    let mut stmt = conn.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH 'run'").unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0)).unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

// =============================================================================
// Notebooks Tests
// =============================================================================

#[test]
fn test_create_notebook() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notebooks (id, name, color, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![id, "Work", "#FF5733", 1, ts, ts],
    ).unwrap();

    let name: String = conn
        .query_row("SELECT name FROM notebooks WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(name, "Work");
}

#[test]
fn test_nested_notebooks() {
    let (_dir, conn) = create_test_db();
    let parent_id = new_id();
    let child_id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![parent_id, "Parent", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notebooks (id, name, parent_id, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![child_id, "Child", parent_id, 1, ts, ts],
    ).unwrap();

    let mut stmt = conn.prepare("SELECT id FROM notebooks WHERE parent_id = ?").unwrap();
    let children: Vec<String> = stmt
        .query_map(params![parent_id], |row| row.get(0)).unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(children.len(), 1);
    assert_eq!(children[0], child_id);
}

// =============================================================================
// Tags Tests
// =============================================================================

#[test]
fn test_create_tag() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO tags (id, name, color, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![id, "important", "#FF0000", 1, ts, ts],
    ).unwrap();

    let name: String = conn
        .query_row("SELECT name FROM tags WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(name, "important");
}

#[test]
fn test_tag_uniqueness() {
    let (_dir, conn) = create_test_db();
    let id1 = new_id();
    let id2 = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id1, "unique-tag", 1, ts, ts],
    ).unwrap();

    let result = conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id2, "unique-tag", 1, ts, ts],
    );

    assert!(result.is_err());
}

// =============================================================================
// Sync State Tests
// =============================================================================

#[test]
fn test_sync_state_initialized() {
    let (_dir, conn) = create_test_db();

    let (pull_rev, push_rev): (i64, i64) = conn
        .query_row(
            "SELECT last_pull_revision, last_push_revision FROM sync_state WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(pull_rev, 0);
    assert_eq!(push_rev, 0);
}

#[test]
fn test_get_changes_since_revision() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    for i in 1..=5 {
        let id = new_id();
        conn.execute(
            "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![id, format!("Note {}", i), "Content", "[]", "active", 0, i, ts, ts],
        ).unwrap();
    }

    let mut stmt = conn.prepare("SELECT revision FROM notes WHERE revision > 3").unwrap();
    let changes: Vec<i64> = stmt
        .query_map([], |row| row.get(0)).unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(changes.len(), 2);
}

#[test]
fn test_lww_higher_revision_wins() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    // Insert with revision 1
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Original", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Simulate remote with higher revision (LWW merge)
    let remote_revision = 5;
    let local_revision: i64 = conn
        .query_row("SELECT revision FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert!(remote_revision > local_revision);

    // Remote wins - apply update
    conn.execute(
        "UPDATE notes SET title = ?, revision = ? WHERE id = ?",
        params!["Remote Title", remote_revision, id],
    ).unwrap();

    let title: String = conn
        .query_row("SELECT title FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(title, "Remote Title");
}
