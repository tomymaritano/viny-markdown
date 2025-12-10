# VINY vNext — Specification v2

> Technology-Agnostic Architecture Document

---

## 1. Product Purpose

VINY is a **personal note-taking application** that enables users to capture, organize, and retrieve thoughts with minimal friction across devices.

### Core Principles

1. **Offline-First**: Full functionality without network connectivity
2. **Cross-Platform**: Consistent experience across web, desktop, and mobile
3. **Data Sovereignty**: User owns their data with full export capabilities
4. **Simplicity**: Minimal UI that stays out of the user's way

---

## 2. Domain Model

### 2.1 Core Entities

#### Note
The atomic unit of user content.

```
Note {
  id: UUID v7
  title: string (max 500 chars)
  content: string (max 1MB)
  notebookId: UUID | null
  tags: UUID[]
  status: 'draft' | 'active' | 'archived'
  isPinned: boolean
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt: timestamp | null
  ownerId: UUID
}
```

#### Notebook
Hierarchical container for notes.

```
Notebook {
  id: UUID v7
  name: string (max 100 chars)
  color: string | null
  icon: string | null
  parentId: UUID | null  // For nested notebooks
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt: timestamp | null
  ownerId: UUID
}
```

#### Tag
Cross-cutting classification.

```
Tag {
  id: UUID v7
  name: string (max 50 chars)
  color: string | null
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt: timestamp | null
  ownerId: UUID
}
```

#### User
Identity and preferences.

```
User {
  id: UUID v7
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### Device
Explicit entity for multi-device sync.

```
Device {
  id: UUID v7
  userId: UUID
  name: string
  platform: 'web' | 'macos' | 'windows' | 'linux' | 'ios' | 'android'
  lastSeenAt: timestamp
  createdAt: timestamp
}
```

### 2.2 Entity Relationships

```
User 1——* Note
User 1——* Notebook
User 1——* Tag
User 1——* Device

Notebook 1——* Note
Notebook 1——* Notebook (self-referential for nesting)

Note *——* Tag (via tags array)
```

### 2.3 Domain Invariants

| Rule | Constraint |
|------|------------|
| Note title length | max 500 characters |
| Note content size | max 1MB |
| Tag name uniqueness | per user (case-insensitive) |
| Notebook name uniqueness | per parent + user |
| Tags per note | max 50 |
| Notebook nesting depth | max 5 levels |
| Circular notebook reference | prohibited |

---

## 3. Operation Log (Event Sourcing)

### 3.1 Operation as Source of Truth

State is derived from applying operations in sequence. The operation log is the canonical record.

```
Operation {
  id: UUID v7
  type: OperationType
  entityType: 'note' | 'notebook' | 'tag' | 'user'
  entityId: UUID
  payload: JSON
  timestamp: timestamp        // Client time (when user did action)
  serverSeq: number | null    // Server-assigned sequence (canonical order)
  deviceId: UUID
  ownerId: UUID
  syncedAt: timestamp | null
  checksum: string
}
```

### 3.2 Dual Timestamp Design

| Field | Purpose |
|-------|---------|
| `timestamp` | Client time - for display, local sorting |
| `serverSeq` | Server-assigned monotonic sequence - canonical global order |

### 3.3 Operation Types

```
NOTE_CREATED
NOTE_UPDATED
NOTE_DELETED
NOTE_RESTORED
NOTE_MOVED           // Notebook change
NOTE_TAG_ADDED       // Granular: add single tag
NOTE_TAG_REMOVED     // Granular: remove single tag
NOTE_PINNED
NOTE_UNPINNED
NOTE_STATUS_CHANGED

NOTEBOOK_CREATED
NOTEBOOK_UPDATED
NOTEBOOK_DELETED
NOTEBOOK_RESTORED
NOTEBOOK_MOVED       // Parent change

TAG_CREATED
TAG_UPDATED
TAG_DELETED
TAG_RESTORED
```

### 3.4 Payload Examples

```json
// NOTE_UPDATED - with affected fields
{
  "title": "New Title",
  "content": "Updated content",
  "affectedFields": ["title", "content"]
}

// NOTE_TAG_ADDED - granular
{
  "tagId": "uuid-of-tag"
}

// NOTE_TAG_REMOVED - granular
{
  "tagId": "uuid-of-tag"
}

// NOTE_MOVED
{
  "fromNotebookId": "uuid-or-null",
  "toNotebookId": "uuid-or-null"
}

// NOTE_STATUS_CHANGED
{
  "fromStatus": "draft",
  "toStatus": "active"
}
```

---

## 4. Sync Protocol

### 4.1 Sync Flow

```
1. Client sends pending operations (where syncedAt IS NULL)
2. Server assigns serverSeq to each operation
3. Server returns:
   - Assigned serverSeq for client's operations
   - New operations from other devices (since client's last serverSeq)
4. Client applies remote operations and updates local state
```

### 4.2 Conflict Detection

Conflicts occur when:
- Same `entityId`
- Overlapping `affectedFields`
- Different `deviceId`
- serverSeq difference <= threshold (e.g., within 100 operations)

### 4.3 Conflict Resolution

**Default: Last-Write-Wins by Server Sequence**

```
Winner = operation with higher serverSeq
```

**Field-Level Merge** (optional enhancement):
- If operations affect different fields, both can apply
- Example: Device A changes title, Device B changes content → both apply

---

## 5. Snapshots & Compaction

### 5.1 Snapshot

Cached projection of entity state for fast reads.

```
Snapshot {
  id: UUID
  entityType: string
  entityId: UUID
  data: JSON           // Full entity state
  lastOperationId: UUID
  checksum: string     // Verify integrity
  createdAt: timestamp
}
```

### 5.2 Compaction Rules

| Trigger | Action |
|---------|--------|
| 100+ operations per entity | Create snapshot, archive old ops |
| Entity deleted > 30 days | Purge operations entirely |
| Manual request | Force snapshot + compact |

### 5.3 Checksum Verification

```
checksum = SHA256(canonical_json(data))
```

On read: verify `checksum` matches computed value. If mismatch, rebuild from operation log.

---

## 6. Feature Flags

### 6.1 Flag Structure

```
FeatureFlag {
  key: string
  enabled: boolean
  rolloutPercentage: number (0-100)
  enabledForUsers: UUID[]
  metadata: JSON
}
```

### 6.2 Flag Lifecycle

```
DISABLED → CANARY (1%) → BETA (10%) → GA (100%) → DEPRECATED → REMOVED
```

### 6.3 Planned Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `sync.enabled` | Enable cross-device sync | false |
| `sync.conflict.ui` | Show conflict resolution UI | false |
| `editor.markdown` | Enable markdown mode | true |
| `editor.wysiwyg` | Enable WYSIWYG mode | false |
| `export.pdf` | Enable PDF export | false |

---

## 7. Error Handling

### 7.1 Error Hierarchy

```
DomainError
├── ValidationError
│   ├── InvalidTitleError
│   ├── InvalidContentError
│   └── InvalidTagNameError
├── NotFoundError
│   ├── NoteNotFoundError
│   ├── NotebookNotFoundError
│   └── TagNotFoundError
├── ConflictError
│   ├── DuplicateTagError
│   └── SyncConflictError
├── AuthorizationError
│   └── NotOwnerError
└── StorageError
    ├── DatabaseError
    └── QuotaExceededError
```

### 7.2 Error Structure

```
{
  code: string,        // Machine-readable: "NOTE_NOT_FOUND"
  message: string,     // Human-readable
  context: object,     // Debug info: { noteId, userId }
  recoverable: boolean
}
```

---

## 8. Storage Architecture

### 8.1 Local Storage (SQLite)

```sql
-- Operations table (append-only log)
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  timestamp TEXT NOT NULL,
  server_seq INTEGER,
  device_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  synced_at TEXT,
  checksum TEXT NOT NULL
);

-- Snapshots table (read cache)
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,  -- JSON
  last_operation_id TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_ops_entity ON operations(entity_id);
CREATE INDEX idx_ops_owner ON operations(owner_id);
CREATE INDEX idx_ops_unsynced ON operations(synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_snapshots_entity ON snapshots(entity_id);
```

### 8.2 Server Storage (for sync)

Same schema, plus:
- Global sequence counter
- User authentication
- Rate limiting metadata

---

## 9. API Contracts

### 9.1 Sync API

```
POST /sync
Authorization: Bearer <token>

Request:
{
  deviceId: string,
  lastServerSeq: number,
  operations: Operation[]
}

Response:
{
  assignedSeqs: { operationId: serverSeq }[],
  remoteOperations: Operation[],
  conflicts: Conflict[]  // If any detected
}
```

### 9.2 Export API

```
GET /export?format=json|markdown|html
Authorization: Bearer <token>

Response: Streamed archive
```

---

## 10. DevOps & Deployment

### 10.1 CI/CD Pipeline

```yaml
# GitHub Actions
on: [push, pull_request]

jobs:
  lint:
    - pnpm lint

  test:
    - pnpm test

  build:
    - pnpm build

  deploy:
    - if: branch == main
    - Deploy to Cloudflare (web)
    - Notarize and publish (desktop)
```

### 10.2 Environment Strategy

| Environment | Purpose | Data |
|-------------|---------|------|
| local | Development | SQLite file |
| preview | PR previews | Isolated D1 |
| production | Live users | Production D1 |

---

## 11. Implementation Phases

### Phase 0 (F0): Foundation
- [x] Monorepo structure
- [x] Domain types
- [ ] SvelteKit app running
- [ ] Tauri app running
- [ ] SQLite basic CRUD

### Phase 1 (F1): Core Features
- [ ] Note CRUD with UI
- [ ] Notebook management
- [ ] Tag management
- [ ] Local persistence
- [ ] Operation log implementation

### Phase 2 (F2): Polish
- [ ] Search (full-text)
- [ ] Keyboard shortcuts
- [ ] Export (JSON, Markdown)
- [ ] Settings UI

### Phase 3 (F3): Sync (Optional)
- [ ] User authentication
- [ ] Sync protocol
- [ ] Conflict UI
- [ ] Multi-device testing

---

## Appendix A: Technology Choices (Reference)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Web Framework | SvelteKit | Simplicity, performance, SSR |
| Desktop | Tauri | Rust security, small binary |
| Local DB | SQLite | Universal, reliable, WASM |
| Sync Server | Hono + D1 | Edge-native, Cloudflare |
| Auth | Cloudflare Access | Zero-config SSO |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Operation | Immutable record of a user action |
| Snapshot | Cached projection of entity state |
| serverSeq | Monotonic sequence assigned by server |
| Compaction | Archiving old operations after snapshot |
| LWW | Last-Write-Wins conflict resolution |
