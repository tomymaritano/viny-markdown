//! Sync module - LWW (Last Write Wins) synchronization
//!
//! Simple sync model:
//! - Each entity has `revision` (increments on every change) and `updated_at`
//! - Pull: fetch remote changes, merge using LWW
//! - Push: send local changes to server
//! - Conflict resolution: higher revision wins; if equal, newer updated_at wins

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::db::Database;
use crate::error::Result;
use crate::models::{Note, NoteStatus, Notebook, Tag};

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
#[allow(dead_code)]
pub struct SyncRequest {
    pub server_url: String,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SyncResult {
    pub pulled: SyncStats,
    pub pushed: SyncStats,
    pub conflicts: Vec<SyncConflict>,
    pub last_synced_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SyncStats {
    pub notes: i32,
    pub notebooks: i32,
    pub tags: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SyncConflict {
    pub entity_type: String,
    pub entity_id: String,
    pub local_revision: i64,
    pub remote_revision: i64,
    pub resolution: String, // "local_wins" | "remote_wins"
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct SyncPayload {
    pub notes: Vec<Note>,
    pub notebooks: Vec<Notebook>,
    pub tags: Vec<Tag>,
    pub since_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/lib/bindings/")]
pub struct LocalSyncState {
    pub last_pull_revision: i64,
    pub last_push_revision: i64,
    pub last_synced_at: Option<String>,
    pub pending_changes: i32,
}

// =============================================================================
// Sync State Management
// =============================================================================

pub fn get_sync_state(db: &Database) -> Result<LocalSyncState> {
    let conn = db.conn();

    let mut stmt = conn.prepare(
        "SELECT last_pull_revision, last_push_revision, last_synced_at FROM sync_state WHERE id = 1",
    )?;

    let state = stmt
        .query_row([], |row| {
            Ok(LocalSyncState {
                last_pull_revision: row.get(0)?,
                last_push_revision: row.get(1)?,
                last_synced_at: row.get(2)?,
                pending_changes: 0, // Will be calculated below
            })
        })
        .unwrap_or(LocalSyncState {
            last_pull_revision: 0,
            last_push_revision: 0,
            last_synced_at: None,
            pending_changes: 0,
        });

    // Count pending changes (entities with revision > last_push_revision)
    let pending: i32 = conn
        .query_row(
            "SELECT
                (SELECT COUNT(*) FROM notes WHERE revision > ? AND deleted_at IS NULL) +
                (SELECT COUNT(*) FROM notebooks WHERE revision > ? AND deleted_at IS NULL) +
                (SELECT COUNT(*) FROM tags WHERE revision > ? AND deleted_at IS NULL)",
            params![
                state.last_push_revision,
                state.last_push_revision,
                state.last_push_revision
            ],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(LocalSyncState {
        pending_changes: pending,
        ..state
    })
}

fn update_sync_state(
    db: &Database,
    pull_revision: Option<i64>,
    push_revision: Option<i64>,
) -> Result<()> {
    let conn = db.conn();
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(rev) = pull_revision {
        conn.execute(
            "UPDATE sync_state SET last_pull_revision = ?, last_synced_at = ? WHERE id = 1",
            params![rev, now],
        )?;
    }

    if let Some(rev) = push_revision {
        conn.execute(
            "UPDATE sync_state SET last_push_revision = ?, last_synced_at = ? WHERE id = 1",
            params![rev, now],
        )?;
    }

    Ok(())
}

// =============================================================================
// Get Changes for Push
// =============================================================================

pub fn get_changes_since(db: &Database, since_revision: i64) -> Result<SyncPayload> {
    let conn = db.conn();

    // Get notes changed since revision
    let mut notes_stmt = conn.prepare(
        "SELECT id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at
         FROM notes WHERE revision > ?",
    )?;

    let notes: Vec<Note> = notes_stmt
        .query_map(params![since_revision], |row| {
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

    // Get notebooks changed since revision
    let mut notebooks_stmt = conn.prepare(
        "SELECT id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at
         FROM notebooks WHERE revision > ?",
    )?;

    let notebooks: Vec<Notebook> = notebooks_stmt
        .query_map(params![since_revision], |row| {
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

    // Get tags changed since revision
    let mut tags_stmt = conn.prepare(
        "SELECT id, name, color, revision, created_at, updated_at, deleted_at
         FROM tags WHERE revision > ?",
    )?;

    let tags: Vec<Tag> = tags_stmt
        .query_map(params![since_revision], |row| {
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

    Ok(SyncPayload {
        notes,
        notebooks,
        tags,
        since_revision,
    })
}

// =============================================================================
// Merge Remote Changes (LWW)
// =============================================================================

pub fn merge_remote_changes(
    db: &Database,
    remote: SyncPayload,
) -> Result<(SyncStats, Vec<SyncConflict>)> {
    let conn = db.conn();
    let mut stats = SyncStats::default();
    let mut conflicts = Vec::new();

    // Merge notes
    for remote_note in remote.notes {
        let local_revision: Option<i64> = conn
            .query_row(
                "SELECT revision FROM notes WHERE id = ?",
                params![&remote_note.id],
                |row| row.get(0),
            )
            .ok();

        let should_apply = match local_revision {
            None => true, // New note, always apply
            Some(local_rev) => {
                if remote_note.revision > local_rev {
                    true // Remote is newer
                } else if remote_note.revision == local_rev {
                    // Same revision, compare updated_at
                    let local_updated: String = conn
                        .query_row(
                            "SELECT updated_at FROM notes WHERE id = ?",
                            params![&remote_note.id],
                            |row| row.get(0),
                        )
                        .unwrap_or_default();

                    remote_note.updated_at > local_updated
                } else {
                    // Local is newer, record conflict
                    conflicts.push(SyncConflict {
                        entity_type: "note".to_string(),
                        entity_id: remote_note.id.clone(),
                        local_revision: local_rev,
                        remote_revision: remote_note.revision,
                        resolution: "local_wins".to_string(),
                    });
                    false
                }
            }
        };

        if should_apply {
            let tags_json = serde_json::to_string(&remote_note.tags).unwrap();
            conn.execute(
                "INSERT OR REPLACE INTO notes (id, title, content, notebook_id, tags, status, is_pinned, revision, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    remote_note.id,
                    remote_note.title,
                    remote_note.content,
                    remote_note.notebook_id,
                    tags_json,
                    remote_note.status.as_str(),
                    remote_note.is_pinned as i32,
                    remote_note.revision,
                    remote_note.created_at,
                    remote_note.updated_at,
                    remote_note.deleted_at,
                ],
            )?;
            stats.notes += 1;
        }
    }

    // Merge notebooks
    for remote_notebook in remote.notebooks {
        let local_revision: Option<i64> = conn
            .query_row(
                "SELECT revision FROM notebooks WHERE id = ?",
                params![&remote_notebook.id],
                |row| row.get(0),
            )
            .ok();

        let should_apply = match local_revision {
            None => true,
            Some(local_rev) => {
                if remote_notebook.revision > local_rev {
                    true
                } else if remote_notebook.revision == local_rev {
                    let local_updated: String = conn
                        .query_row(
                            "SELECT updated_at FROM notebooks WHERE id = ?",
                            params![&remote_notebook.id],
                            |row| row.get(0),
                        )
                        .unwrap_or_default();

                    remote_notebook.updated_at > local_updated
                } else {
                    conflicts.push(SyncConflict {
                        entity_type: "notebook".to_string(),
                        entity_id: remote_notebook.id.clone(),
                        local_revision: local_rev,
                        remote_revision: remote_notebook.revision,
                        resolution: "local_wins".to_string(),
                    });
                    false
                }
            }
        };

        if should_apply {
            conn.execute(
                "INSERT OR REPLACE INTO notebooks (id, name, color, icon, parent_id, revision, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    remote_notebook.id,
                    remote_notebook.name,
                    remote_notebook.color,
                    remote_notebook.icon,
                    remote_notebook.parent_id,
                    remote_notebook.revision,
                    remote_notebook.created_at,
                    remote_notebook.updated_at,
                    remote_notebook.deleted_at,
                ],
            )?;
            stats.notebooks += 1;
        }
    }

    // Merge tags
    for remote_tag in remote.tags {
        let local_revision: Option<i64> = conn
            .query_row(
                "SELECT revision FROM tags WHERE id = ?",
                params![&remote_tag.id],
                |row| row.get(0),
            )
            .ok();

        let should_apply = match local_revision {
            None => true,
            Some(local_rev) => {
                if remote_tag.revision > local_rev {
                    true
                } else if remote_tag.revision == local_rev {
                    let local_updated: String = conn
                        .query_row(
                            "SELECT updated_at FROM tags WHERE id = ?",
                            params![&remote_tag.id],
                            |row| row.get(0),
                        )
                        .unwrap_or_default();

                    remote_tag.updated_at > local_updated
                } else {
                    conflicts.push(SyncConflict {
                        entity_type: "tag".to_string(),
                        entity_id: remote_tag.id.clone(),
                        local_revision: local_rev,
                        remote_revision: remote_tag.revision,
                        resolution: "local_wins".to_string(),
                    });
                    false
                }
            }
        };

        if should_apply {
            conn.execute(
                "INSERT OR REPLACE INTO tags (id, name, color, revision, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    remote_tag.id,
                    remote_tag.name,
                    remote_tag.color,
                    remote_tag.revision,
                    remote_tag.created_at,
                    remote_tag.updated_at,
                    remote_tag.deleted_at,
                ],
            )?;
            stats.tags += 1;
        }
    }

    Ok((stats, conflicts))
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Get current sync state
#[tauri::command]
pub fn get_local_sync_state(db: State<'_, Database>) -> Result<LocalSyncState> {
    get_sync_state(&db)
}

/// Get changes that need to be pushed
#[tauri::command]
pub fn get_pending_changes(db: State<'_, Database>) -> Result<SyncPayload> {
    let state = get_sync_state(&db)?;
    get_changes_since(&db, state.last_push_revision)
}

/// Apply remote changes (pull)
#[tauri::command]
pub fn apply_remote_changes(
    db: State<'_, Database>,
    payload: SyncPayload,
) -> Result<(SyncStats, Vec<SyncConflict>)> {
    let result = merge_remote_changes(&db, payload)?;

    // Update last pull revision to the max revision we received
    let max_revision = result
        .0
        .notes
        .max(result.0.notebooks)
        .max(result.0.tags) as i64;

    if max_revision > 0 {
        let state = get_sync_state(&db)?;
        update_sync_state(&db, Some(state.last_pull_revision.max(max_revision)), None)?;
    }

    Ok(result)
}

/// Mark changes as pushed
#[tauri::command]
pub fn mark_changes_pushed(db: State<'_, Database>, up_to_revision: i64) -> Result<()> {
    update_sync_state(&db, None, Some(up_to_revision))
}

/// Full sync operation (for when server is available)
/// This is a placeholder - actual HTTP calls would be done from JS/TS side
#[tauri::command]
pub fn prepare_sync(db: State<'_, Database>) -> Result<(LocalSyncState, SyncPayload)> {
    let state = get_sync_state(&db)?;
    let changes = get_changes_since(&db, state.last_push_revision)?;
    Ok((state, changes))
}

// =============================================================================
// HTTP Sync Client
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PullRequest {
    device_id: String,
    last_sync_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PullResponse {
    notes: Vec<ServerNote>,
    notebooks: Vec<ServerNotebook>,
    tags: Vec<ServerTag>,
    server_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PushRequest {
    device_id: String,
    notes: Vec<ServerNote>,
    notebooks: Vec<ServerNotebook>,
    tags: Vec<ServerTag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PushResponse {
    accepted: usize,
    conflicts: Vec<ServerConflict>,
    server_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerConflict {
    entity_type: String,
    entity_id: String,
    local_revision: i64,
    server_revision: i64,
    resolution: String,
}

// Server-side models (slightly different format)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerNote {
    id: String,
    title: String,
    content: String,
    notebook_id: Option<String>,
    tags: String, // JSON string on server
    status: String,
    created_at: String,
    updated_at: String,
    revision: i64,
    is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerNotebook {
    id: String,
    name: String,
    color: Option<String>,
    parent_id: Option<String>,
    created_at: String,
    updated_at: String,
    revision: i64,
    is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerTag {
    id: String,
    name: String,
    color: Option<String>,
    created_at: String,
    updated_at: String,
    revision: i64,
    is_deleted: bool,
}

fn get_device_id() -> String {
    // Simple device ID - in production you'd persist this
    uuid::Uuid::new_v4().to_string()
}

fn note_to_server(note: &Note) -> ServerNote {
    ServerNote {
        id: note.id.clone(),
        title: note.title.clone(),
        content: note.content.clone(),
        notebook_id: note.notebook_id.clone(),
        tags: serde_json::to_string(&note.tags).unwrap_or_default(),
        status: note.status.as_str().to_string(),
        created_at: note.created_at.clone(),
        updated_at: note.updated_at.clone(),
        revision: note.revision,
        is_deleted: note.deleted_at.is_some(),
    }
}

fn server_to_note(s: ServerNote) -> Note {
    let tags: Vec<String> = serde_json::from_str(&s.tags).unwrap_or_default();
    Note {
        id: s.id,
        title: s.title,
        content: s.content,
        notebook_id: s.notebook_id,
        tags,
        status: NoteStatus::from_str(&s.status),
        is_pinned: false,
        revision: s.revision,
        created_at: s.created_at,
        updated_at: s.updated_at.clone(),
        deleted_at: if s.is_deleted { Some(s.updated_at) } else { None },
    }
}

fn notebook_to_server(nb: &Notebook) -> ServerNotebook {
    ServerNotebook {
        id: nb.id.clone(),
        name: nb.name.clone(),
        color: nb.color.clone(),
        parent_id: nb.parent_id.clone(),
        created_at: nb.created_at.clone(),
        updated_at: nb.updated_at.clone(),
        revision: nb.revision,
        is_deleted: nb.deleted_at.is_some(),
    }
}

fn server_to_notebook(s: ServerNotebook) -> Notebook {
    Notebook {
        id: s.id,
        name: s.name,
        color: s.color,
        icon: None,
        parent_id: s.parent_id,
        revision: s.revision,
        created_at: s.created_at,
        updated_at: s.updated_at.clone(),
        deleted_at: if s.is_deleted { Some(s.updated_at) } else { None },
    }
}

fn tag_to_server(tag: &Tag) -> ServerTag {
    ServerTag {
        id: tag.id.clone(),
        name: tag.name.clone(),
        color: tag.color.clone(),
        created_at: tag.created_at.clone(),
        updated_at: tag.updated_at.clone(),
        revision: tag.revision,
        is_deleted: tag.deleted_at.is_some(),
    }
}

fn server_to_tag(s: ServerTag) -> Tag {
    Tag {
        id: s.id,
        name: s.name,
        color: s.color,
        revision: s.revision,
        created_at: s.created_at,
        updated_at: s.updated_at.clone(),
        deleted_at: if s.is_deleted { Some(s.updated_at) } else { None },
    }
}

/// Sync with remote server
#[tauri::command]
pub async fn sync_with_server(
    db: State<'_, Database>,
    server_url: String,
) -> Result<SyncResult> {
    let client = reqwest::Client::new();
    let device_id = get_device_id();

    // Get current state
    let local_state = get_sync_state(&db)?;

    // 1. Pull remote changes
    let pull_req = PullRequest {
        device_id: device_id.clone(),
        last_sync_revision: local_state.last_pull_revision,
    };

    let pull_response: PullResponse = client
        .post(format!("{}/api/sync/pull", server_url))
        .json(&pull_req)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Sync(e.to_string()))?
        .json()
        .await
        .map_err(|e| crate::error::AppError::Sync(e.to_string()))?;

    // Convert and merge remote changes
    let remote_payload = SyncPayload {
        notes: pull_response.notes.into_iter().map(server_to_note).collect(),
        notebooks: pull_response.notebooks.into_iter().map(server_to_notebook).collect(),
        tags: pull_response.tags.into_iter().map(server_to_tag).collect(),
        since_revision: local_state.last_pull_revision,
    };

    let (pulled_stats, pull_conflicts) = merge_remote_changes(&db, remote_payload)?;

    // Update pull revision
    update_sync_state(&db, Some(pull_response.server_revision), None)?;

    // 2. Push local changes
    let changes = get_changes_since(&db, local_state.last_push_revision)?;

    let push_req = PushRequest {
        device_id,
        notes: changes.notes.iter().map(note_to_server).collect(),
        notebooks: changes.notebooks.iter().map(notebook_to_server).collect(),
        tags: changes.tags.iter().map(tag_to_server).collect(),
    };

    let push_response: PushResponse = client
        .post(format!("{}/api/sync/push", server_url))
        .json(&push_req)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Sync(e.to_string()))?
        .json()
        .await
        .map_err(|e| crate::error::AppError::Sync(e.to_string()))?;

    // Update push revision
    update_sync_state(&db, None, Some(push_response.server_revision))?;

    // Combine conflicts
    let mut all_conflicts: Vec<SyncConflict> = pull_conflicts;
    for c in push_response.conflicts {
        all_conflicts.push(SyncConflict {
            entity_type: c.entity_type,
            entity_id: c.entity_id,
            local_revision: c.local_revision,
            remote_revision: c.server_revision,
            resolution: c.resolution,
        });
    }

    let pushed_stats = SyncStats {
        notes: push_response.accepted as i32,
        notebooks: 0,
        tags: 0,
    };

    Ok(SyncResult {
        pulled: pulled_stats,
        pushed: pushed_stats,
        conflicts: all_conflicts,
        last_synced_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Check if server is reachable
#[tauri::command]
pub async fn check_server_connection(server_url: String) -> Result<bool> {
    let client = reqwest::Client::new();

    match client
        .get(format!("{}/health", server_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}
