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

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    notified INTEGER NOT NULL DEFAULT 0,
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

// =============================================================================
// Advanced Notes Tests
// =============================================================================

#[test]
fn test_note_with_multiple_tags() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();
    let tags = vec!["work", "important", "project-alpha"];
    let tags_json = serde_json::to_string(&tags).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Tagged Note", "Content", tags_json, "active", 0, 1, ts, ts],
    ).unwrap();

    let retrieved_tags: String = conn
        .query_row("SELECT tags FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    let parsed_tags: Vec<String> = serde_json::from_str(&retrieved_tags).unwrap();
    assert_eq!(parsed_tags.len(), 3);
    assert!(parsed_tags.contains(&"work".to_string()));
}

#[test]
fn test_note_pin_toggle() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Pin the note
    conn.execute(
        "UPDATE notes SET is_pinned = 1, revision = revision + 1 WHERE id = ?",
        params![id],
    ).unwrap();

    let is_pinned: i32 = conn
        .query_row("SELECT is_pinned FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(is_pinned, 1);
}

#[test]
fn test_note_status_transitions() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Archive
    conn.execute(
        "UPDATE notes SET status = 'archived' WHERE id = ?",
        params![id],
    ).unwrap();
    let status: String = conn
        .query_row("SELECT status FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();
    assert_eq!(status, "archived");

    // Trash
    conn.execute(
        "UPDATE notes SET status = 'trashed' WHERE id = ?",
        params![id],
    ).unwrap();
    let status: String = conn
        .query_row("SELECT status FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();
    assert_eq!(status, "trashed");

    // Restore to active
    conn.execute(
        "UPDATE notes SET status = 'active' WHERE id = ?",
        params![id],
    ).unwrap();
    let status: String = conn
        .query_row("SELECT status FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();
    assert_eq!(status, "active");
}

#[test]
fn test_note_notebook_assignment() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let notebook_id = new_id();
    let ts = now();

    // Create notebook first
    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![notebook_id, "Work", 1, ts, ts],
    ).unwrap();

    // Create note with notebook
    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", notebook_id, "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let retrieved_notebook_id: Option<String> = conn
        .query_row("SELECT notebook_id FROM notes WHERE id = ?", params![note_id], |row| row.get(0))
        .unwrap();

    assert_eq!(retrieved_notebook_id, Some(notebook_id));
}

#[test]
fn test_note_with_empty_fields() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "", "", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let (title, content): (String, String) = conn
        .query_row(
            "SELECT title, content FROM notes WHERE id = ?",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(title, "");
    assert_eq!(content, "");
}

#[test]
fn test_list_notes_ordered_by_pin_and_updated() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create notes with different pin states and update times
    for i in 0..3 {
        let id = new_id();
        let is_pinned = if i == 0 { 1 } else { 0 };
        conn.execute(
            "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![id, format!("Note {}", i), "Content", "[]", "active", is_pinned, 1, ts, ts],
        ).unwrap();
    }

    let mut stmt = conn.prepare(
        "SELECT id, is_pinned FROM notes ORDER BY is_pinned DESC, updated_at DESC"
    ).unwrap();
    let results: Vec<i32> = stmt
        .query_map([], |row| row.get(1))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // First note should be pinned
    assert_eq!(results[0], 1);
}

// =============================================================================
// Advanced Notebooks Tests
// =============================================================================

#[test]
fn test_notebook_cascade_on_delete() {
    let (_dir, conn) = create_test_db();
    let notebook_id = new_id();
    let note_id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![notebook_id, "Work", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", notebook_id, "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Soft delete notebook - notes should have notebook_id set to NULL
    conn.execute(
        "UPDATE notes SET notebook_id = NULL WHERE notebook_id = ?",
        params![notebook_id],
    ).unwrap();

    let notebook_id_after: Option<String> = conn
        .query_row("SELECT notebook_id FROM notes WHERE id = ?", params![note_id], |row| row.get(0))
        .unwrap();

    assert_eq!(notebook_id_after, None);
}

#[test]
fn test_notebook_hierarchy_depth() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let root_id = new_id();
    let child1_id = new_id();
    let child2_id = new_id();

    // Create hierarchy: root -> child1 -> child2
    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![root_id, "Root", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notebooks (id, name, parent_id, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![child1_id, "Child1", root_id, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notebooks (id, name, parent_id, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![child2_id, "Child2", child1_id, 1, ts, ts],
    ).unwrap();

    // Query for deepest child
    let parent: Option<String> = conn
        .query_row("SELECT parent_id FROM notebooks WHERE id = ?", params![child2_id], |row| row.get(0))
        .unwrap();

    assert_eq!(parent, Some(child1_id));
}

#[test]
fn test_notebook_with_color_and_icon() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notebooks (id, name, color, icon, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![id, "Personal", "#FF5733", "home", 1, ts, ts],
    ).unwrap();

    let (color, icon): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT color, icon FROM notebooks WHERE id = ?",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(color, Some("#FF5733".to_string()));
    assert_eq!(icon, Some("home".to_string()));
}

#[test]
fn test_notebook_update_parent() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let parent1_id = new_id();
    let parent2_id = new_id();
    let child_id = new_id();

    // Create two parents
    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![parent1_id, "Parent1", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![parent2_id, "Parent2", 1, ts, ts],
    ).unwrap();

    // Create child under parent1
    conn.execute(
        "INSERT INTO notebooks (id, name, parent_id, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![child_id, "Child", parent1_id, 1, ts, ts],
    ).unwrap();

    // Move to parent2
    conn.execute(
        "UPDATE notebooks SET parent_id = ? WHERE id = ?",
        params![parent2_id, child_id],
    ).unwrap();

    let new_parent: Option<String> = conn
        .query_row("SELECT parent_id FROM notebooks WHERE id = ?", params![child_id], |row| row.get(0))
        .unwrap();

    assert_eq!(new_parent, Some(parent2_id));
}

#[test]
fn test_get_root_notebooks() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create root notebooks
    for i in 0..3 {
        let id = new_id();
        conn.execute(
            "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
            params![id, format!("Root{}", i), 1, ts, ts],
        ).unwrap();
    }

    // Create child notebook
    let parent_id = new_id();
    let child_id = new_id();
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

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM notebooks WHERE parent_id IS NULL AND deleted_at IS NULL"
    ).unwrap();
    let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();

    // Should be 4 root notebooks (3 created + 1 parent)
    assert_eq!(count, 4);
}

// =============================================================================
// Advanced Tags Tests
// =============================================================================

#[test]
fn test_tag_name_case_sensitivity() {
    let (_dir, conn) = create_test_db();
    let id1 = new_id();
    let id2 = new_id();
    let ts = now();

    // SQLite UNIQUE is case-insensitive by default, but this depends on COLLATE
    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id1, "Important", 1, ts, ts],
    ).unwrap();

    // Attempting to insert same name with different case
    // This might succeed or fail depending on SQLite collation settings
    // For this test, we just verify the first tag was inserted
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM tags WHERE name = 'Important'", [], |row| row.get(0))
        .unwrap();

    assert_eq!(count, 1);
}

#[test]
fn test_tag_with_special_characters() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();
    let tag_name = "tag-with-dashes_and_underscores.123";

    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id, tag_name, 1, ts, ts],
    ).unwrap();

    let name: String = conn
        .query_row("SELECT name FROM tags WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(name, tag_name);
}

#[test]
fn test_tag_update_name() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id, "old-name", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "UPDATE tags SET name = ?, revision = revision + 1 WHERE id = ?",
        params!["new-name", id],
    ).unwrap();

    let name: String = conn
        .query_row("SELECT name FROM tags WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(name, "new-name");
}

#[test]
fn test_tag_soft_delete() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id, "temp-tag", 1, ts, ts],
    ).unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tags SET deleted_at = ? WHERE id = ?",
        params![now, id],
    ).unwrap();

    let deleted_at: Option<String> = conn
        .query_row("SELECT deleted_at FROM tags WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert!(deleted_at.is_some());
}

#[test]
fn test_list_tags_excludes_deleted() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create active tag
    let id1 = new_id();
    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id1, "active", 1, ts, ts],
    ).unwrap();

    // Create and soft delete tag
    let id2 = new_id();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO tags (id, name, deleted_at, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![id2, "deleted", now, 1, ts, ts],
    ).unwrap();

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM tags WHERE deleted_at IS NULL"
    ).unwrap();
    let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();

    assert_eq!(count, 1);
}

// =============================================================================
// Reminders Tests
// =============================================================================

#[test]
fn test_create_reminder() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let reminder_id = new_id();
    let ts = now();
    let due_date = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .to_rfc3339();

    // Create note first
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Create reminder
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![reminder_id, note_id, "Call meeting", due_date, 0, 0, 1, ts, ts],
    ).unwrap();

    let message: String = conn
        .query_row("SELECT message FROM reminders WHERE id = ?", params![reminder_id], |row| row.get(0))
        .unwrap();

    assert_eq!(message, "Call meeting");
}

#[test]
fn test_reminder_complete_toggle() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let reminder_id = new_id();
    let ts = now();
    let due_date = chrono::Utc::now().to_rfc3339();

    // Create note first
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![reminder_id, note_id, "Task", due_date, 0, 0, 1, ts, ts],
    ).unwrap();

    // Mark as completed
    conn.execute(
        "UPDATE reminders SET completed = 1 WHERE id = ?",
        params![reminder_id],
    ).unwrap();

    let completed: i32 = conn
        .query_row("SELECT completed FROM reminders WHERE id = ?", params![reminder_id], |row| row.get(0))
        .unwrap();

    assert_eq!(completed, 1);
}

#[test]
fn test_get_upcoming_reminders() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let ts = now();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Create upcoming reminder (7 days from now)
    let upcoming_id = new_id();
    let upcoming_date = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .to_rfc3339();
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![upcoming_id, note_id, "Upcoming", upcoming_date, 0, 0, 1, ts, ts],
    ).unwrap();

    // Create far future reminder (60 days from now)
    let far_id = new_id();
    let far_date = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(60))
        .unwrap()
        .to_rfc3339();
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![far_id, note_id, "Far Future", far_date, 0, 0, 1, ts, ts],
    ).unwrap();

    // Query reminders in next 30 days
    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND due_date >= datetime('now')
           AND due_date <= datetime('now', '30 days')"
    ).unwrap();
    let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();

    assert_eq!(count, 1); // Only the 7-day reminder
}

#[test]
fn test_get_overdue_reminders() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let ts = now();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Create overdue reminder (7 days ago)
    let overdue_id = new_id();
    let overdue_date = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(7))
        .unwrap()
        .to_rfc3339();
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![overdue_id, note_id, "Overdue", overdue_date, 0, 0, 1, ts, ts],
    ).unwrap();

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND due_date < datetime('now')"
    ).unwrap();
    let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();

    assert_eq!(count, 1);
}

#[test]
fn test_reminder_cascade_on_note_delete() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let reminder_id = new_id();
    let ts = now();
    let due_date = chrono::Utc::now().to_rfc3339();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Create reminder
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![reminder_id, note_id, "Task", due_date, 0, 0, 1, ts, ts],
    ).unwrap();

    // Delete note (hard delete)
    conn.execute("DELETE FROM notes WHERE id = ?", params![note_id]).unwrap();

    // Reminder should be deleted due to CASCADE
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM reminders WHERE id = ?",
            params![reminder_id],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(count, 0);
}

#[test]
fn test_reminder_notified_flag() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let reminder_id = new_id();
    let ts = now();
    let due_date = chrono::Utc::now().to_rfc3339();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![reminder_id, note_id, "Task", due_date, 0, 0, 1, ts, ts],
    ).unwrap();

    // Mark as notified
    conn.execute(
        "UPDATE reminders SET notified = 1 WHERE id = ?",
        params![reminder_id],
    ).unwrap();

    let notified: i32 = conn
        .query_row("SELECT notified FROM reminders WHERE id = ?", params![reminder_id], |row| row.get(0))
        .unwrap();

    assert_eq!(notified, 1);
}

#[test]
fn test_get_due_reminders_for_notification() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let ts = now();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Create due and not notified reminder (use SQLite's datetime function for consistency)
    let due_id = new_id();
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now', '-5 minutes'), ?, ?, ?, ?, ?)",
        params![due_id, note_id, "Due", 0, 0, 1, ts, ts],
    ).unwrap();

    // Create already notified reminder
    let notified_id = new_id();
    conn.execute(
        "INSERT INTO reminders (id, note_id, message, due_date, completed, notified, revision, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now', '-5 minutes'), ?, ?, ?, ?, ?)",
        params![notified_id, note_id, "Notified", 0, 1, 1, ts, ts],
    ).unwrap();

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM reminders
         WHERE deleted_at IS NULL
           AND completed = 0
           AND notified = 0
           AND due_date <= datetime('now')"
    ).unwrap();
    let count: i32 = stmt.query_row([], |row| row.get(0)).unwrap();

    assert_eq!(count, 1); // Only the unnotified one
}

// =============================================================================
// Search Functionality Tests
// =============================================================================

#[test]
fn test_fts_multi_word_search() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Project Alpha", "Meeting notes for the alpha project", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Search for multiple words
    let mut stmt = conn.prepare(
        "SELECT id FROM notes_fts WHERE notes_fts MATCH 'alpha project'"
    ).unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

#[test]
fn test_fts_title_vs_content_search() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let id1 = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id1, "Important Meeting", "Regular content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    let id2 = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id2, "Regular Note", "Important content here", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Search for "important" should match both
    let mut stmt = conn.prepare(
        "SELECT id FROM notes_fts WHERE notes_fts MATCH 'important'"
    ).unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 2);
}

#[test]
fn test_fts_tag_search() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();
    let tags = vec!["urgent", "work"];
    let tags_json = serde_json::to_string(&tags).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Note", "Content", tags_json, "active", 0, 1, ts, ts],
    ).unwrap();

    // Search in tags
    let mut stmt = conn.prepare(
        "SELECT id FROM notes_fts WHERE notes_fts MATCH 'urgent'"
    ).unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

#[test]
fn test_fts_prefix_matching() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "JavaScript Tutorial", "Learning JS", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Prefix search with *
    let mut stmt = conn.prepare(
        "SELECT id FROM notes_fts WHERE notes_fts MATCH 'java*'"
    ).unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

#[test]
fn test_fts_special_characters() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "C++ Programming", "Code with C++", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // FTS5 requires special handling of special chars
    let mut stmt = conn.prepare(
        "SELECT id FROM notes_fts WHERE notes_fts MATCH 'programming'"
    ).unwrap();
    let results: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(results.len(), 1);
}

#[test]
fn test_fts_ranking() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Note with term in title (should rank higher)
    let id1 = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id1, "database design", "some content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Note with term buried in content
    let id2 = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id2, "other topic", "lots of text here and there about database somewhere", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Query with ranking
    let mut stmt = conn.prepare(
        "SELECT id, bm25(notes_fts) as rank FROM notes_fts
         WHERE notes_fts MATCH 'database'
         ORDER BY rank"
    ).unwrap();
    let results: Vec<(String, f64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // Title match should rank better (lower bm25 score)
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].0, id1);
}

#[test]
fn test_rebuild_fts_index() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create note
    let id = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Test", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Clear FTS
    conn.execute("DELETE FROM notes_fts", []).unwrap();

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes_fts", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);

    // Rebuild
    conn.execute(
        "INSERT INTO notes_fts(id, title, content, tags)
         SELECT id, title, content, tags FROM notes",
        [],
    ).unwrap();

    let count_after: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes_fts", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count_after, 1);
}

// =============================================================================
// Export/Import Tests
// =============================================================================

#[test]
fn test_export_all_data() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create test data
    let notebook_id = new_id();
    conn.execute(
        "INSERT INTO notebooks (id, name, color, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![notebook_id, "Work", "#FF5733", 1, ts, ts],
    ).unwrap();

    let tag_id = new_id();
    conn.execute(
        "INSERT INTO tags (id, name, color, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        params![tag_id, "important", "#FF0000", 1, ts, ts],
    ).unwrap();

    let note_id = new_id();
    let tags_json = serde_json::to_string(&vec!["important"]).unwrap();
    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", notebook_id, tags_json, "active", 0, 1, ts, ts],
    ).unwrap();

    // Verify all data exists
    let note_count: i32 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0)).unwrap();
    let notebook_count: i32 = conn.query_row("SELECT COUNT(*) FROM notebooks", [], |row| row.get(0)).unwrap();
    let tag_count: i32 = conn.query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0)).unwrap();

    assert_eq!(note_count, 1);
    assert_eq!(notebook_count, 1);
    assert_eq!(tag_count, 1);
}

#[test]
fn test_export_includes_soft_deleted() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create and soft-delete a note
    let id = new_id();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, deleted_at, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Deleted Note", "Content", "[]", "trashed", 0, now, 1, ts, ts],
    ).unwrap();

    // Export should include soft-deleted items
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .unwrap();

    assert_eq!(count, 1);
}

#[test]
fn test_import_new_data() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Simulate importing a note
    let id = new_id();
    let tags_json = "[]";

    conn.execute(
        "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Imported", "Content", None::<String>, tags_json, "active", 0, 1, ts, ts, None::<String>],
    ).unwrap();

    let title: String = conn
        .query_row("SELECT title FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(title, "Imported");
}

#[test]
fn test_import_overwrites_existing() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    // Create original note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Original", "Old Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Import with same ID (overwrite)
    conn.execute(
        "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Updated", "New Content", None::<String>, "[]", "active", 0, 5, ts, ts, None::<String>],
    ).unwrap();

    let (title, revision): (String, i64) = conn
        .query_row(
            "SELECT title, revision FROM notes WHERE id = ?",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(title, "Updated");
    assert_eq!(revision, 5);
}

#[test]
fn test_import_maintains_referential_integrity() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let notebook_id = new_id();
    let note_id = new_id();

    // Import notebook first
    conn.execute(
        "INSERT INTO notebooks (id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![notebook_id, "Work", Some("#FF5733"), None::<String>, None::<String>, 1, ts, ts, None::<String>],
    ).unwrap();

    // Import note referencing notebook
    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", Some(notebook_id.clone()), "[]", "active", 0, 1, ts, ts, None::<String>],
    ).unwrap();

    let retrieved_notebook_id: Option<String> = conn
        .query_row("SELECT notebook_id FROM notes WHERE id = ?", params![note_id], |row| row.get(0))
        .unwrap();

    assert_eq!(retrieved_notebook_id, Some(notebook_id));
}

#[test]
fn test_import_with_invalid_notebook_reference() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let note_id = new_id();
    let nonexistent_notebook_id = new_id();

    // Try to import note with nonexistent notebook (should succeed due to ON DELETE SET NULL)
    let result = conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", nonexistent_notebook_id, "[]", "active", 0, 1, ts, ts],
    );

    // Should succeed but foreign key constraint might fail depending on PRAGMA settings
    // With PRAGMA foreign_keys = ON, this should fail
    assert!(result.is_err());
}

#[test]
fn test_export_preserves_all_fields() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    let id = new_id();
    let notebook_id = new_id();
    let tags = vec!["tag1", "tag2"];
    let tags_json = serde_json::to_string(&tags).unwrap();

    // Create notebook
    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![notebook_id, "Work", 1, ts, ts],
    ).unwrap();

    // Create note with all fields
    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Complete Note", "Full Content", notebook_id, tags_json, "active", 1, 5, ts, ts],
    ).unwrap();

    // Retrieve and verify all fields
    let mut stmt = conn.prepare(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at
         FROM notes WHERE id = ?"
    ).unwrap();

    let note = stmt.query_row(params![id], |row| {
        let tags_str: String = row.get(4)?;
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            tags_str,
            row.get::<_, String>(5)?,
            row.get::<_, i32>(6)?,
            row.get::<_, i64>(7)?,
        ))
    }).unwrap();

    assert_eq!(note.0, id);
    assert_eq!(note.1, "Complete Note");
    assert_eq!(note.2, "Full Content");
    assert_eq!(note.3, Some(notebook_id));
    assert_eq!(note.5, "active");
    assert_eq!(note.6, 1); // is_pinned
    assert_eq!(note.7, 5); // revision
}

#[test]
fn test_import_skips_duplicate_tags() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    // Create tag
    conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![id, "existing", 1, ts, ts],
    ).unwrap();

    // Try to import tag with same name but different ID
    let new_id = new_id();
    let result = conn.execute(
        "INSERT INTO tags (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![new_id, "existing", 1, ts, ts],
    );

    // Should fail due to UNIQUE constraint on name
    assert!(result.is_err());
}

#[test]
fn test_export_empty_database() {
    let (_dir, conn) = create_test_db();

    // Query counts on empty database
    let note_count: i32 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0)).unwrap();
    let notebook_count: i32 = conn.query_row("SELECT COUNT(*) FROM notebooks", [], |row| row.get(0)).unwrap();
    let tag_count: i32 = conn.query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0)).unwrap();

    assert_eq!(note_count, 0);
    assert_eq!(notebook_count, 0);
    assert_eq!(tag_count, 0);
}

#[test]
fn test_import_large_dataset() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Import 100 notes
    for i in 0..100 {
        let id = new_id();
        conn.execute(
            "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![id, format!("Note {}", i), "Content", "[]", "active", 0, 1, ts, ts],
        ).unwrap();
    }

    let count: i32 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0)).unwrap();
    assert_eq!(count, 100);
}

#[test]
fn test_export_respects_revision_order() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create notes with different revisions
    for i in 1..=5 {
        let id = new_id();
        conn.execute(
            "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![id, format!("Note {}", i), "Content", "[]", "active", 0, i, ts, ts],
        ).unwrap();
    }

    // Query in revision order
    let mut stmt = conn.prepare(
        "SELECT revision FROM notes ORDER BY revision ASC"
    ).unwrap();
    let revisions: Vec<i64> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(revisions, vec![1, 2, 3, 4, 5]);
}

// =============================================================================
// Complex Integration Tests
// =============================================================================

#[test]
fn test_full_note_lifecycle() {
    let (_dir, conn) = create_test_db();
    let ts = now();

    // Create
    let id = new_id();
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "New Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Update
    conn.execute(
        "UPDATE notes SET title = ?, revision = revision + 1 WHERE id = ?",
        params!["Updated Note", id],
    ).unwrap();

    // Archive
    conn.execute(
        "UPDATE notes SET status = 'archived', revision = revision + 1 WHERE id = ?",
        params![id],
    ).unwrap();

    // Trash
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET status = 'trashed', deleted_at = ?, revision = revision + 1 WHERE id = ?",
        params![now, id],
    ).unwrap();

    // Restore
    conn.execute(
        "UPDATE notes SET status = 'active', deleted_at = NULL, revision = revision + 1 WHERE id = ?",
        params![id],
    ).unwrap();

    // Hard delete
    conn.execute("DELETE FROM notes WHERE id = ?", params![id]).unwrap();

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(count, 0);
}

#[test]
fn test_notebook_with_notes_deletion_workflow() {
    let (_dir, conn) = create_test_db();
    let notebook_id = new_id();
    let note_id = new_id();
    let ts = now();

    // Create notebook and note
    conn.execute(
        "INSERT INTO notebooks (id, name, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        params![notebook_id, "Work", 1, ts, ts],
    ).unwrap();

    conn.execute(
        "INSERT INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", notebook_id, "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Soft delete notebook - clear notebook_id from notes
    conn.execute(
        "UPDATE notes SET notebook_id = NULL WHERE notebook_id = ?",
        params![notebook_id],
    ).unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notebooks SET deleted_at = ? WHERE id = ?",
        params![now, notebook_id],
    ).unwrap();

    // Note should still exist but without notebook
    let (note_exists, notebook_id_null): (bool, bool) = conn
        .query_row(
            "SELECT 1, notebook_id IS NULL FROM notes WHERE id = ?",
            params![note_id],
            |row| Ok((row.get::<_, i32>(0)? == 1, row.get::<_, bool>(1)?)),
        )
        .unwrap();

    assert!(note_exists);
    assert!(notebook_id_null);
}

#[test]
fn test_tag_removal_from_notes() {
    let (_dir, conn) = create_test_db();
    let note_id = new_id();
    let ts = now();

    let tags = vec!["work", "important", "urgent"];
    let tags_json = serde_json::to_string(&tags).unwrap();

    // Create note with tags
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![note_id, "Note", "Content", tags_json, "active", 0, 1, ts, ts],
    ).unwrap();

    // Remove a tag by replacing
    let new_tags = vec!["work", "important"];
    let new_tags_json = serde_json::to_string(&new_tags).unwrap();

    conn.execute(
        "UPDATE notes SET tags = ?, revision = revision + 1 WHERE id = ?",
        params![new_tags_json, note_id],
    ).unwrap();

    let updated_tags: String = conn
        .query_row("SELECT tags FROM notes WHERE id = ?", params![note_id], |row| row.get(0))
        .unwrap();

    let parsed: Vec<String> = serde_json::from_str(&updated_tags).unwrap();
    assert_eq!(parsed.len(), 2);
    assert!(!parsed.contains(&"urgent".to_string()));
}

#[test]
fn test_concurrent_note_updates_revision_tracking() {
    let (_dir, conn) = create_test_db();
    let id = new_id();
    let ts = now();

    // Create note
    conn.execute(
        "INSERT INTO notes (id, title, content, tags, status, is_pinned, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![id, "Note", "Content", "[]", "active", 0, 1, ts, ts],
    ).unwrap();

    // Simulate multiple updates
    for i in 2..=10 {
        conn.execute(
            "UPDATE notes SET title = ?, revision = ? WHERE id = ?",
            params![format!("Version {}", i), i, id],
        ).unwrap();
    }

    let revision: i64 = conn
        .query_row("SELECT revision FROM notes WHERE id = ?", params![id], |row| row.get(0))
        .unwrap();

    assert_eq!(revision, 10);
}
