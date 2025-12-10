// =============================================================================
// VINY Domain Types - vNext Spec
// =============================================================================

/** UUID v7 for temporal ordering */
export type UUID = string;

/** ISO 8601 timestamp */
export type Timestamp = string;

// -----------------------------------------------------------------------------
// Core Entities
// -----------------------------------------------------------------------------

export type NoteStatus = 'draft' | 'active' | 'archived';

export interface Note {
  id: UUID;
  title: string;
  content: string;
  notebookId: UUID | null;
  tags: UUID[];
  status: NoteStatus;
  isPinned: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  ownerId: UUID;
}

export interface Notebook {
  id: UUID;
  name: string;
  color: string | null;
  icon: string | null;
  parentId: UUID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  ownerId: UUID;
}

export interface Tag {
  id: UUID;
  name: string;
  color: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
  ownerId: UUID;
}

export interface User {
  id: UUID;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Device {
  id: UUID;
  userId: UUID;
  name: string;
  platform: 'web' | 'macos' | 'windows' | 'linux' | 'ios' | 'android';
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
}

export interface NoteVersion {
  id: UUID;
  noteId: UUID;
  title: string;
  content: string;
  createdAt: Timestamp;
  wordCount: number;
}

// -----------------------------------------------------------------------------
// Operation Log (Event Sourcing)
// -----------------------------------------------------------------------------

export type EntityType = 'note' | 'notebook' | 'tag' | 'user';

export type OperationType =
  // Note operations
  | 'NOTE_CREATED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'NOTE_RESTORED'
  | 'NOTE_MOVED'
  | 'NOTE_TAG_ADDED'
  | 'NOTE_TAG_REMOVED'
  | 'NOTE_PINNED'
  | 'NOTE_UNPINNED'
  | 'NOTE_STATUS_CHANGED'
  // Notebook operations
  | 'NOTEBOOK_CREATED'
  | 'NOTEBOOK_UPDATED'
  | 'NOTEBOOK_DELETED'
  | 'NOTEBOOK_RESTORED'
  | 'NOTEBOOK_MOVED'
  // Tag operations
  | 'TAG_CREATED'
  | 'TAG_UPDATED'
  | 'TAG_DELETED'
  | 'TAG_RESTORED';

export interface Operation<T = unknown> {
  id: UUID;
  type: OperationType;
  entityType: EntityType;
  entityId: UUID;
  payload: T;
  timestamp: Timestamp;        // Client time (when user performed action)
  serverSeq: number | null;    // Server-assigned sequence (canonical order)
  deviceId: UUID;
  ownerId: UUID;
  syncedAt: Timestamp | null;
  checksum: string;
}

// -----------------------------------------------------------------------------
// Operation Payloads
// -----------------------------------------------------------------------------

export interface NoteCreatedPayload {
  title: string;
  content: string;
  notebookId: UUID | null;
  status: NoteStatus;
}

export interface NoteUpdatedPayload {
  title?: string;
  content?: string;
  /** Fields that were modified - for conflict detection */
  affectedFields: Array<'title' | 'content'>;
}

export interface NoteMovedPayload {
  fromNotebookId: UUID | null;
  toNotebookId: UUID | null;
}

export interface NoteTagAddedPayload {
  tagId: UUID;
}

export interface NoteTagRemovedPayload {
  tagId: UUID;
}

export interface NoteStatusChangedPayload {
  fromStatus: NoteStatus;
  toStatus: NoteStatus;
}

export interface NotebookCreatedPayload {
  name: string;
  color: string | null;
  icon: string | null;
  parentId: UUID | null;
}

export interface NotebookUpdatedPayload {
  name?: string;
  color?: string | null;
  icon?: string | null;
  affectedFields: Array<'name' | 'color' | 'icon'>;
}

export interface NotebookMovedPayload {
  fromParentId: UUID | null;
  toParentId: UUID | null;
}

export interface TagCreatedPayload {
  name: string;
  color: string | null;
}

export interface TagUpdatedPayload {
  name?: string;
  color?: string | null;
  affectedFields: Array<'name' | 'color'>;
}

// -----------------------------------------------------------------------------
// Sync & Snapshots
// -----------------------------------------------------------------------------

export interface Snapshot {
  id: UUID;
  entityType: EntityType;
  entityId: UUID;
  data: Note | Notebook | Tag;
  lastOperationId: UUID;
  checksum: string;
  createdAt: Timestamp;
}

export interface SyncState {
  deviceId: UUID;
  lastServerSeq: number;
  lastSyncedAt: Timestamp | null;
}

// -----------------------------------------------------------------------------
// Feature Flags
// -----------------------------------------------------------------------------

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  enabledForUsers: UUID[];
  metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'STORAGE_ERROR'
  | 'SYNC_ERROR'
  | 'NETWORK_ERROR';

export interface DomainError {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
  cause?: Error;
}
