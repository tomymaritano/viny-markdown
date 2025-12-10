// =============================================================================
// Operations Store - Event Sourcing for Sync
// =============================================================================

import type {
  Operation,
  OperationType,
  EntityType,
  UUID,
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
} from '@viny/domain';

// -----------------------------------------------------------------------------
// IndexedDB Setup
// -----------------------------------------------------------------------------

const DB_NAME = 'viny_operations';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create operations store with indexes
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('entityId', 'entityId', { unique: false });
        store.createIndex('entityType', 'entityType', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('syncedAt', 'syncedAt', { unique: false });
        store.createIndex('serverSeq', 'serverSeq', { unique: false });
      }
    };
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generateUUID(): UUID {
  return crypto.randomUUID();
}

function getDeviceId(): UUID {
  let deviceId = localStorage.getItem('viny_device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('viny_device_id', deviceId);
  }
  return deviceId;
}

function getOwnerId(): UUID {
  // For now, use a local owner ID. Will be replaced with actual user ID when auth is implemented
  let ownerId = localStorage.getItem('viny_owner_id');
  if (!ownerId) {
    ownerId = generateUUID();
    localStorage.setItem('viny_owner_id', ownerId);
  }
  return ownerId;
}

function computeChecksum(payload: unknown): string {
  // Simple checksum using JSON string. In production, use SHA-256
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let operations = $state<Operation[]>([]);
let isInitialized = $state(false);
let pendingCount = $state(0);

// Derived: pending operations (not yet synced)
const pendingOperations = $derived(() => {
  return operations.filter(op => op.syncedAt === null);
});

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    const database = await getDB();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        operations = request.result || [];
        pendingCount = operations.filter(op => op.syncedAt === null).length;
        isInitialized = true;
        resolve();
      };
    });
  } catch (error) {
    console.error('Failed to initialize operations store:', error);
    isInitialized = true;
  }
}

async function logOperation<T>(
  type: OperationType,
  entityType: EntityType,
  entityId: UUID,
  payload: T
): Promise<Operation<T>> {
  const operation: Operation<T> = {
    id: generateUUID(),
    type,
    entityType,
    entityId,
    payload,
    timestamp: new Date().toISOString(),
    serverSeq: null,
    deviceId: getDeviceId(),
    ownerId: getOwnerId(),
    syncedAt: null,
    checksum: computeChecksum(payload),
  };

  try {
    const database = await getDB();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.add(operation);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        operations = [...operations, operation as Operation];
        pendingCount = operations.filter(op => op.syncedAt === null).length;
        resolve(operation);
      };
    });
  } catch (error) {
    console.error('Failed to log operation:', error);
    throw error;
  }
}

async function markAsSynced(operationIds: UUID[], serverSeqs: Map<UUID, number>): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const now = new Date().toISOString();

  const updatePromises = operationIds.map(id => {
    return new Promise<void>((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const op = getRequest.result;
        if (op) {
          op.syncedAt = now;
          op.serverSeq = serverSeqs.get(id) ?? null;
          const putRequest = store.put(op);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
    });
  });

  await Promise.all(updatePromises);

  // Update local state
  operations = operations.map(op => {
    if (operationIds.includes(op.id)) {
      return {
        ...op,
        syncedAt: now,
        serverSeq: serverSeqs.get(op.id) ?? null,
      };
    }
    return op;
  });
  pendingCount = operations.filter(op => op.syncedAt === null).length;
}

async function getOperationsByEntity(entityId: UUID): Promise<Operation[]> {
  const database = await getDB();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('entityId');

  return new Promise((resolve, reject) => {
    const request = index.getAll(entityId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function getPendingOperations(): Promise<Operation[]> {
  const database = await getDB();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('syncedAt');

  return new Promise((resolve, reject) => {
    const request = index.getAll(null); // null = not synced
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function clearAllOperations(): Promise<void> {
  const database = await getDB();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      operations = [];
      pendingCount = 0;
      resolve();
    };
  });
}

// -----------------------------------------------------------------------------
// Convenience Functions for Note Operations
// -----------------------------------------------------------------------------

async function logNoteCreated(noteId: UUID, payload: NoteCreatedPayload) {
  return logOperation('NOTE_CREATED', 'note', noteId, payload);
}

async function logNoteUpdated(noteId: UUID, payload: NoteUpdatedPayload) {
  return logOperation('NOTE_UPDATED', 'note', noteId, payload);
}

async function logNoteDeleted(noteId: UUID) {
  return logOperation('NOTE_DELETED', 'note', noteId, {});
}

async function logNoteRestored(noteId: UUID) {
  return logOperation('NOTE_RESTORED', 'note', noteId, {});
}

async function logNoteMoved(noteId: UUID, payload: NoteMovedPayload) {
  return logOperation('NOTE_MOVED', 'note', noteId, payload);
}

async function logNoteTagAdded(noteId: UUID, payload: NoteTagAddedPayload) {
  return logOperation('NOTE_TAG_ADDED', 'note', noteId, payload);
}

async function logNoteTagRemoved(noteId: UUID, payload: NoteTagRemovedPayload) {
  return logOperation('NOTE_TAG_REMOVED', 'note', noteId, payload);
}

async function logNotePinned(noteId: UUID) {
  return logOperation('NOTE_PINNED', 'note', noteId, {});
}

async function logNoteUnpinned(noteId: UUID) {
  return logOperation('NOTE_UNPINNED', 'note', noteId, {});
}

async function logNoteStatusChanged(noteId: UUID, payload: NoteStatusChangedPayload) {
  return logOperation('NOTE_STATUS_CHANGED', 'note', noteId, payload);
}

// -----------------------------------------------------------------------------
// Convenience Functions for Notebook Operations
// -----------------------------------------------------------------------------

async function logNotebookCreated(notebookId: UUID, payload: NotebookCreatedPayload) {
  return logOperation('NOTEBOOK_CREATED', 'notebook', notebookId, payload);
}

async function logNotebookUpdated(notebookId: UUID, payload: NotebookUpdatedPayload) {
  return logOperation('NOTEBOOK_UPDATED', 'notebook', notebookId, payload);
}

async function logNotebookDeleted(notebookId: UUID) {
  return logOperation('NOTEBOOK_DELETED', 'notebook', notebookId, {});
}

async function logNotebookRestored(notebookId: UUID) {
  return logOperation('NOTEBOOK_RESTORED', 'notebook', notebookId, {});
}

async function logNotebookMoved(notebookId: UUID, payload: NotebookMovedPayload) {
  return logOperation('NOTEBOOK_MOVED', 'notebook', notebookId, payload);
}

// -----------------------------------------------------------------------------
// Convenience Functions for Tag Operations
// -----------------------------------------------------------------------------

async function logTagCreated(tagId: UUID, payload: TagCreatedPayload) {
  return logOperation('TAG_CREATED', 'tag', tagId, payload);
}

async function logTagUpdated(tagId: UUID, payload: TagUpdatedPayload) {
  return logOperation('TAG_UPDATED', 'tag', tagId, payload);
}

async function logTagDeleted(tagId: UUID) {
  return logOperation('TAG_DELETED', 'tag', tagId, {});
}

async function logTagRestored(tagId: UUID) {
  return logOperation('TAG_RESTORED', 'tag', tagId, {});
}

// -----------------------------------------------------------------------------
// Export Store
// -----------------------------------------------------------------------------

export const operationsStore = {
  // State getters
  get operations() {
    return operations;
  },
  get pendingOperations() {
    return pendingOperations();
  },
  get pendingCount() {
    return pendingCount;
  },
  get isInitialized() {
    return isInitialized;
  },

  // Core functions
  initialize,
  logOperation,
  markAsSynced,
  getOperationsByEntity,
  getPendingOperations,
  clearAllOperations,

  // Note operations
  logNoteCreated,
  logNoteUpdated,
  logNoteDeleted,
  logNoteRestored,
  logNoteMoved,
  logNoteTagAdded,
  logNoteTagRemoved,
  logNotePinned,
  logNoteUnpinned,
  logNoteStatusChanged,

  // Notebook operations
  logNotebookCreated,
  logNotebookUpdated,
  logNotebookDeleted,
  logNotebookRestored,
  logNotebookMoved,

  // Tag operations
  logTagCreated,
  logTagUpdated,
  logTagDeleted,
  logTagRestored,
};
