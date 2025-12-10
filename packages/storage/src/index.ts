// =============================================================================
// @viny/storage - Public API
// =============================================================================

// Database
export {
  initDatabase,
  getDatabase,
  saveDatabase,
  closeDatabase,
  isTauri,
  // Unified async API (works on both web and Tauri)
  dbExecute,
  dbSelect,
  // Tauri-specific (legacy)
  initTauriDatabase,
  getTauriDatabase,
  tauriExecute,
  tauriSelect,
} from './database.js';

// Notes Repository
export {
  createNote,
  getNote,
  getAllNotes,
  getNotesByStatus,
  getNotesByNotebook,
  getDeletedNotes,
  updateNote,
  moveNote,
  duplicateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  toggleNotePin,
  addNoteTag,
  removeNoteTag,
  type CreateNoteInput,
} from './notes.js';

// Tags Repository
export {
  createTag,
  getTag,
  getAllTags,
  findOrCreateTag,
  updateTag,
  deleteTag,
  type CreateTagInput,
} from './tags.js';

// Notebooks Repository
export {
  createNotebook,
  getNotebook,
  getAllNotebooks,
  getRootNotebooks,
  getChildNotebooks,
  updateNotebook,
  deleteNotebook,
  getNotebookNoteCount,
  type CreateNotebookInput,
} from './notebooks.js';

// Operations Repository
export {
  createOperation,
  getOperationsForEntity,
  getUnsyncedOperations,
  getOperationsSince,
  markOperationsSynced,
  type CreateOperationInput,
} from './operations.js';

// Utilities
export { generateId, now, computeChecksum, computeChecksumSync } from './utils.js';
