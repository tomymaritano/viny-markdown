use serde::{Deserialize, Serialize};

// Sync models - same structure as desktop app
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub notebook_id: Option<String>,
    pub tags: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub revision: i64,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub parent_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub revision: i64,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub revision: i64,
    pub is_deleted: bool,
}

// Sync request/response
#[derive(Debug, Serialize, Deserialize)]
pub struct PullRequest {
    pub device_id: String,
    pub last_sync_revision: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullResponse {
    pub notes: Vec<Note>,
    pub notebooks: Vec<Notebook>,
    pub tags: Vec<Tag>,
    pub server_revision: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushRequest {
    pub device_id: String,
    pub notes: Vec<Note>,
    pub notebooks: Vec<Notebook>,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushResponse {
    pub accepted: usize,
    pub conflicts: Vec<Conflict>,
    pub server_revision: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Conflict {
    pub entity_type: String,
    pub entity_id: String,
    pub local_revision: i64,
    pub server_revision: i64,
    pub resolution: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}
