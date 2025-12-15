use axum::{extract::State, Json};

use crate::error::Result;
use crate::models::*;
use crate::AppState;

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub async fn pull(
    State(state): State<AppState>,
    Json(req): Json<PullRequest>,
) -> Result<Json<PullResponse>> {
    tracing::info!(
        "Pull request from device {} since revision {}",
        req.device_id,
        req.last_sync_revision
    );

    let notes = state.db.get_notes_since(req.last_sync_revision)?;
    let notebooks = state.db.get_notebooks_since(req.last_sync_revision)?;
    let tags = state.db.get_tags_since(req.last_sync_revision)?;
    let server_revision = state.db.get_global_revision()?;

    tracing::info!(
        "Returning {} notes, {} notebooks, {} tags (server rev: {})",
        notes.len(),
        notebooks.len(),
        tags.len(),
        server_revision
    );

    Ok(Json(PullResponse {
        notes,
        notebooks,
        tags,
        server_revision,
    }))
}

pub async fn push(
    State(state): State<AppState>,
    Json(req): Json<PushRequest>,
) -> Result<Json<PushResponse>> {
    tracing::info!(
        "Push request from device {}: {} notes, {} notebooks, {} tags",
        req.device_id,
        req.notes.len(),
        req.notebooks.len(),
        req.tags.len()
    );

    let mut conflicts = Vec::new();
    let mut accepted = 0;

    // Process notes
    for note in &req.notes {
        let (had_conflict, server_rev) = state.db.upsert_note(note)?;
        if had_conflict {
            conflicts.push(Conflict {
                entity_type: "note".to_string(),
                entity_id: note.id.clone(),
                local_revision: note.revision,
                server_revision: server_rev,
                resolution: "server_wins".to_string(),
            });
        } else {
            accepted += 1;
        }
    }

    // Process notebooks
    for notebook in &req.notebooks {
        let (had_conflict, server_rev) = state.db.upsert_notebook(notebook)?;
        if had_conflict {
            conflicts.push(Conflict {
                entity_type: "notebook".to_string(),
                entity_id: notebook.id.clone(),
                local_revision: notebook.revision,
                server_revision: server_rev,
                resolution: "server_wins".to_string(),
            });
        } else {
            accepted += 1;
        }
    }

    // Process tags
    for tag in &req.tags {
        let (had_conflict, server_rev) = state.db.upsert_tag(tag)?;
        if had_conflict {
            conflicts.push(Conflict {
                entity_type: "tag".to_string(),
                entity_id: tag.id.clone(),
                local_revision: tag.revision,
                server_revision: server_rev,
                resolution: "server_wins".to_string(),
            });
        } else {
            accepted += 1;
        }
    }

    let server_revision = state.db.get_global_revision()?;

    tracing::info!(
        "Push complete: {} accepted, {} conflicts, server rev: {}",
        accepted,
        conflicts.len(),
        server_revision
    );

    Ok(Json(PushResponse {
        accepted,
        conflicts,
        server_revision,
    }))
}

pub async fn list_notes(State(state): State<AppState>) -> Result<Json<Vec<Note>>> {
    let notes = state.db.get_all_notes()?;
    Ok(Json(notes))
}

pub async fn list_notebooks(State(state): State<AppState>) -> Result<Json<Vec<Notebook>>> {
    let notebooks = state.db.get_all_notebooks()?;
    Ok(Json(notebooks))
}

pub async fn list_tags(State(state): State<AppState>) -> Result<Json<Vec<Tag>>> {
    let tags = state.db.get_all_tags()?;
    Ok(Json(tags))
}
