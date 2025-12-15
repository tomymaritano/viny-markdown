use rusqlite::{params, Connection};
use std::sync::Mutex;

use crate::error::Result;
use crate::models::{Note, Notebook, Tag};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                notebook_id TEXT,
                tags TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 1,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS notebooks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT,
                parent_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 1,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 1,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                global_revision INTEGER NOT NULL DEFAULT 0
            );

            INSERT OR IGNORE INTO sync_state (id, global_revision) VALUES (1, 0);

            CREATE INDEX IF NOT EXISTS idx_notes_revision ON notes(revision);
            CREATE INDEX IF NOT EXISTS idx_notebooks_revision ON notebooks(revision);
            CREATE INDEX IF NOT EXISTS idx_tags_revision ON tags(revision);
            "#,
        )?;
        Ok(())
    }

    pub fn get_global_revision(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let rev: i64 = conn.query_row(
            "SELECT global_revision FROM sync_state WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(rev)
    }

    fn increment_global_revision(&self, conn: &Connection) -> Result<i64> {
        conn.execute(
            "UPDATE sync_state SET global_revision = global_revision + 1 WHERE id = 1",
            [],
        )?;
        let rev: i64 = conn.query_row(
            "SELECT global_revision FROM sync_state WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(rev)
    }

    // Notes
    pub fn get_notes_since(&self, revision: i64) -> Result<Vec<Note>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, content, notebook_id, tags, status, created_at, updated_at, revision, is_deleted
             FROM notes WHERE revision > ?",
        )?;

        let notes = stmt
            .query_map([revision], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    notebook_id: row.get(3)?,
                    tags: row.get(4)?,
                    status: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    revision: row.get(8)?,
                    is_deleted: row.get(9)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(notes)
    }

    pub fn get_all_notes(&self) -> Result<Vec<Note>> {
        self.get_notes_since(0)
    }

    pub fn upsert_note(&self, note: &Note) -> Result<(bool, i64)> {
        let conn = self.conn.lock().unwrap();

        // Check for conflict
        let existing: Option<i64> = conn
            .query_row(
                "SELECT revision FROM notes WHERE id = ?",
                [&note.id],
                |row| row.get(0),
            )
            .ok();

        let has_conflict = existing.map(|r| r >= note.revision).unwrap_or(false);

        // LWW: accept if incoming revision is higher or equal
        if existing.is_none() || note.revision >= existing.unwrap() {
            let new_rev = self.increment_global_revision(&conn)?;

            conn.execute(
                r#"INSERT INTO notes (id, title, content, notebook_id, tags, status, created_at, updated_at, revision, is_deleted)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                   ON CONFLICT(id) DO UPDATE SET
                       title = excluded.title,
                       content = excluded.content,
                       notebook_id = excluded.notebook_id,
                       tags = excluded.tags,
                       status = excluded.status,
                       updated_at = excluded.updated_at,
                       revision = ?9,
                       is_deleted = excluded.is_deleted"#,
                params![
                    note.id,
                    note.title,
                    note.content,
                    note.notebook_id,
                    note.tags,
                    note.status,
                    note.created_at,
                    note.updated_at,
                    new_rev,
                    note.is_deleted
                ],
            )?;

            Ok((has_conflict, new_rev))
        } else {
            Ok((true, existing.unwrap()))
        }
    }

    // Notebooks
    pub fn get_notebooks_since(&self, revision: i64) -> Result<Vec<Notebook>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, parent_id, created_at, updated_at, revision, is_deleted
             FROM notebooks WHERE revision > ?",
        )?;

        let notebooks = stmt
            .query_map([revision], |row| {
                Ok(Notebook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    parent_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    revision: row.get(6)?,
                    is_deleted: row.get(7)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(notebooks)
    }

    pub fn get_all_notebooks(&self) -> Result<Vec<Notebook>> {
        self.get_notebooks_since(0)
    }

    pub fn upsert_notebook(&self, notebook: &Notebook) -> Result<(bool, i64)> {
        let conn = self.conn.lock().unwrap();

        let existing: Option<i64> = conn
            .query_row(
                "SELECT revision FROM notebooks WHERE id = ?",
                [&notebook.id],
                |row| row.get(0),
            )
            .ok();

        let has_conflict = existing.map(|r| r >= notebook.revision).unwrap_or(false);

        if existing.is_none() || notebook.revision >= existing.unwrap() {
            let new_rev = self.increment_global_revision(&conn)?;

            conn.execute(
                r#"INSERT INTO notebooks (id, name, color, parent_id, created_at, updated_at, revision, is_deleted)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                   ON CONFLICT(id) DO UPDATE SET
                       name = excluded.name,
                       color = excluded.color,
                       parent_id = excluded.parent_id,
                       updated_at = excluded.updated_at,
                       revision = ?7,
                       is_deleted = excluded.is_deleted"#,
                params![
                    notebook.id,
                    notebook.name,
                    notebook.color,
                    notebook.parent_id,
                    notebook.created_at,
                    notebook.updated_at,
                    new_rev,
                    notebook.is_deleted
                ],
            )?;

            Ok((has_conflict, new_rev))
        } else {
            Ok((true, existing.unwrap()))
        }
    }

    // Tags
    pub fn get_tags_since(&self, revision: i64) -> Result<Vec<Tag>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, created_at, updated_at, revision, is_deleted
             FROM tags WHERE revision > ?",
        )?;

        let tags = stmt
            .query_map([revision], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    revision: row.get(5)?,
                    is_deleted: row.get(6)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(tags)
    }

    pub fn get_all_tags(&self) -> Result<Vec<Tag>> {
        self.get_tags_since(0)
    }

    pub fn upsert_tag(&self, tag: &Tag) -> Result<(bool, i64)> {
        let conn = self.conn.lock().unwrap();

        let existing: Option<i64> = conn
            .query_row(
                "SELECT revision FROM tags WHERE id = ?",
                [&tag.id],
                |row| row.get(0),
            )
            .ok();

        let has_conflict = existing.map(|r| r >= tag.revision).unwrap_or(false);

        if existing.is_none() || tag.revision >= existing.unwrap() {
            let new_rev = self.increment_global_revision(&conn)?;

            conn.execute(
                r#"INSERT INTO tags (id, name, color, created_at, updated_at, revision, is_deleted)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                   ON CONFLICT(id) DO UPDATE SET
                       name = excluded.name,
                       color = excluded.color,
                       updated_at = excluded.updated_at,
                       revision = ?6,
                       is_deleted = excluded.is_deleted"#,
                params![
                    tag.id,
                    tag.name,
                    tag.color,
                    tag.created_at,
                    tag.updated_at,
                    new_rev,
                    tag.is_deleted
                ],
            )?;

            Ok((has_conflict, new_rev))
        } else {
            Ok((true, existing.unwrap()))
        }
    }
}
