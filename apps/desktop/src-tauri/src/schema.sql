-- Viny Schema v2 (LWW with revisions)
-- Single source of truth: SQLite via Rust

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

-- Sync state (for LWW sync)
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_pull_revision INTEGER NOT NULL DEFAULT 0,
    last_push_revision INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT
);

-- Initialize sync state
INSERT OR IGNORE INTO sync_state (id, last_pull_revision, last_push_revision) VALUES (1, 0, 0);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_revision ON notes(revision);
CREATE INDEX IF NOT EXISTS idx_notebooks_parent ON notebooks(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notebooks_revision ON notebooks(revision);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_revision ON tags(revision);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tags,
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync with notes table
-- Insert trigger
CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(id, title, content, tags)
    VALUES (NEW.id, NEW.title, NEW.content, NEW.tags);
END;

-- Update trigger
CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
    INSERT INTO notes_fts(id, title, content, tags)
    VALUES (NEW.id, NEW.title, NEW.content, NEW.tags);
END;

-- Delete trigger
CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE id = OLD.id;
END;

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

-- Indexes for reminders
CREATE INDEX IF NOT EXISTS idx_reminders_note ON reminders(note_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date) WHERE completed = 0 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_revision ON reminders(revision);
