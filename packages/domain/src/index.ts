// =============================================================================
// @viny/domain - Public API
// =============================================================================

// Types
export type {
  // Primitives
  UUID,
  Timestamp,
  // Entities
  Note,
  NoteStatus,
  Notebook,
  Tag,
  User,
  Device,
  // Operations
  EntityType,
  OperationType,
  Operation,
  // Payloads
  NoteCreatedPayload,
  NoteUpdatedPayload,
  NoteMovedPayload,
  NoteTagAddedPayload,
  NoteTagRemovedPayload,
  NoteStatusChangedPayload,
  NotebookCreatedPayload,
  NotebookUpdatedPayload,
  NotebookMovedPayload,
  TagCreatedPayload,
  TagUpdatedPayload,
  // Sync
  Snapshot,
  SyncState,
  // Feature Flags
  FeatureFlag,
  // Errors
  ErrorCode,
  DomainError,
} from './types.js';

// Invariants
export {
  validateNote,
  validateNotebook,
  validateTag,
  validateOperation,
  type ValidationResult,
} from './invariants.js';
