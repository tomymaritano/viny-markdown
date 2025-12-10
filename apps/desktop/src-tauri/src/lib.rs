use tauri_plugin_sql::{Migration, MigrationKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                -- Operations table (append-only log - source of truth)
                CREATE TABLE IF NOT EXISTS operations (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    server_seq INTEGER,
                    device_id TEXT NOT NULL,
                    owner_id TEXT NOT NULL,
                    synced_at TEXT,
                    checksum TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                -- Snapshots table (cached projections for fast reads)
                CREATE TABLE IF NOT EXISTS snapshots (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL UNIQUE,
                    data TEXT NOT NULL,
                    last_operation_id TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                );

                -- Notes table
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL DEFAULT '',
                    notebook_id TEXT,
                    tags TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'active',
                    is_pinned INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT,
                    owner_id TEXT NOT NULL
                );

                -- Notebooks table
                CREATE TABLE IF NOT EXISTS notebooks (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT,
                    icon TEXT,
                    parent_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT,
                    owner_id TEXT NOT NULL
                );

                -- Tags table
                CREATE TABLE IF NOT EXISTS tags (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    color TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT,
                    owner_id TEXT NOT NULL
                );

                -- Sync state
                CREATE TABLE IF NOT EXISTS sync_state (
                    device_id TEXT PRIMARY KEY,
                    last_server_seq INTEGER NOT NULL DEFAULT 0,
                    last_synced_at TEXT
                );

                -- Indexes
                CREATE INDEX IF NOT EXISTS idx_ops_entity ON operations(entity_id);
                CREATE INDEX IF NOT EXISTS idx_ops_type ON operations(entity_type, type);
                CREATE INDEX IF NOT EXISTS idx_ops_unsynced ON operations(synced_at) WHERE synced_at IS NULL;
                CREATE INDEX IF NOT EXISTS idx_ops_timestamp ON operations(timestamp);
                CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_id);
                CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status) WHERE deleted_at IS NULL;
                CREATE INDEX IF NOT EXISTS idx_notebooks_owner ON notebooks(owner_id);
                CREATE INDEX IF NOT EXISTS idx_tags_owner ON tags(owner_id);
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:viny.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
