/**
 * Sync Store - LWW synchronization with remote server
 *
 * Provides:
 * - Sync state tracking (last sync, pending changes)
 * - Pull: fetch remote changes and merge with LWW
 * - Push: send local changes to server
 * - Conflict tracking and resolution info
 */

import * as api from '$lib/api';
import type {
  LocalSyncState,
  SyncPayload,
  SyncStats,
  SyncConflict,
} from '$lib/bindings';

// =============================================================================
// State
// =============================================================================

type SyncStatus = 'idle' | 'syncing' | 'error';

let syncState = $state<LocalSyncState | null>(null);
let status = $state<SyncStatus>('idle');
let lastError = $state<string | null>(null);
let conflicts = $state<SyncConflict[]>([]);
let lastSyncResult = $state<{ pulled: SyncStats; pushed: SyncStats } | null>(null);

// Server configuration (will be configurable later)
let serverUrl = $state<string | null>(null);
let authToken = $state<string | null>(null);

// Auto-sync configuration
let autoSyncEnabled = $state(false);
let autoSyncInterval = $state(60000); // 60 seconds default
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

// =============================================================================
// Derived State
// =============================================================================

const pendingChanges = $derived(syncState?.pending_changes ?? 0);
const isSyncing = $derived(status === 'syncing');
const hasError = $derived(status === 'error');
const isConfigured = $derived(serverUrl !== null);
const lastSyncedAt = $derived(syncState?.last_synced_at ?? null);

// =============================================================================
// Actions
// =============================================================================

/**
 * Initialize sync state from database
 */
async function initialize(): Promise<void> {
  try {
    syncState = await api.getLocalSyncState();
    lastError = null;
  } catch (error) {
    console.error('Failed to initialize sync state:', error);
    lastError = error instanceof Error ? error.message : 'Unknown error';
  }
}

/**
 * Configure server connection
 */
function configure(url: string, token?: string): void {
  serverUrl = url;
  authToken = token ?? null;
}

/**
 * Clear server configuration
 */
function disconnect(): void {
  serverUrl = null;
  authToken = null;
}

/**
 * Refresh sync state (check for pending changes)
 */
async function refreshState(): Promise<void> {
  try {
    syncState = await api.getLocalSyncState();
  } catch (error) {
    console.error('Failed to refresh sync state:', error);
  }
}

/**
 * Pull changes from server
 * This is a placeholder - actual HTTP fetch would be implemented here
 */
async function pull(remotePayload: SyncPayload): Promise<SyncStats> {
  status = 'syncing';
  lastError = null;

  try {
    const [stats, newConflicts] = await api.applyRemoteChanges(remotePayload);

    // Update conflicts
    conflicts = [...conflicts, ...newConflicts];

    // Refresh state
    await refreshState();

    status = 'idle';
    return stats;
  } catch (error) {
    status = 'error';
    lastError = error instanceof Error ? error.message : 'Pull failed';
    throw error;
  }
}

/**
 * Get local changes for push
 */
async function getChangesForPush(): Promise<SyncPayload> {
  return api.getPendingChanges();
}

/**
 * Mark changes as successfully pushed
 */
async function markPushed(upToRevision: number): Promise<void> {
  await api.markChangesPushed(upToRevision);
  await refreshState();
}

/**
 * Full sync operation
 * This coordinates pull and push with a server
 *
 * The actual HTTP calls should be implemented by the caller
 * This function provides the local operations
 */
async function sync(options: {
  fetchRemote: () => Promise<SyncPayload>;
  pushLocal: (payload: SyncPayload) => Promise<{ maxRevision: number }>;
}): Promise<{ pulled: SyncStats; pushed: SyncStats }> {
  if (!isConfigured) {
    throw new Error('Sync not configured. Call configure() first.');
  }

  status = 'syncing';
  lastError = null;

  try {
    // 1. Get local state and pending changes
    const [state, localChanges] = await api.prepareSync();

    // 2. Fetch and apply remote changes (pull)
    const remotePayload = await options.fetchRemote();
    const [pullStats, newConflicts] = await api.applyRemoteChanges(remotePayload);
    conflicts = [...conflicts, ...newConflicts];

    // 3. Push local changes
    const pushResult = await options.pushLocal(localChanges);
    await api.markChangesPushed(pushResult.maxRevision);

    // 4. Calculate push stats
    const pushStats: SyncStats = {
      notes: localChanges.notes.length,
      notebooks: localChanges.notebooks.length,
      tags: localChanges.tags.length,
    };

    // 5. Update state
    await refreshState();

    lastSyncResult = { pulled: pullStats, pushed: pushStats };
    status = 'idle';

    return lastSyncResult;
  } catch (error) {
    status = 'error';
    lastError = error instanceof Error ? error.message : 'Sync failed';
    throw error;
  }
}

/**
 * Clear all conflicts (after user has reviewed them)
 */
function clearConflicts(): void {
  conflicts = [];
}

/**
 * Clear error state
 */
function clearError(): void {
  lastError = null;
  if (status === 'error') {
    status = 'idle';
  }
}

/**
 * Sync with server using HTTP API
 */
async function syncWithServer(): Promise<{ pulled: SyncStats; pushed: SyncStats } | null> {
  if (!serverUrl || status === 'syncing') {
    return null;
  }

  status = 'syncing';
  lastError = null;

  try {
    const result = await api.syncWithServer(serverUrl);

    // Update conflicts if any
    if (result.conflicts && result.conflicts.length > 0) {
      conflicts = [...conflicts, ...result.conflicts];
    }

    // Refresh state
    await refreshState();

    lastSyncResult = {
      pulled: result.pulled,
      pushed: result.pushed,
    };
    status = 'idle';

    return lastSyncResult;
  } catch (error) {
    status = 'error';
    lastError = error instanceof Error ? error.message : 'Sync failed';
    return null;
  }
}

/**
 * Enable auto-sync with configurable interval
 */
function enableAutoSync(intervalMs: number = 60000): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }

  autoSyncInterval = intervalMs;
  autoSyncEnabled = true;

  // Save preference
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-auto-sync', 'true');
    localStorage.setItem('viny-auto-sync-interval', String(intervalMs));
  }

  // Start auto-sync timer
  autoSyncTimer = setInterval(async () => {
    if (serverUrl && !isSyncing) {
      await syncWithServer();
    }
  }, intervalMs);

  // Sync immediately
  if (serverUrl) {
    syncWithServer();
  }
}

/**
 * Disable auto-sync
 */
function disableAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  autoSyncEnabled = false;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viny-auto-sync', 'false');
  }
}

/**
 * Load auto-sync settings from localStorage
 */
function loadAutoSyncSettings(): void {
  if (typeof localStorage === 'undefined') return;

  const enabled = localStorage.getItem('viny-auto-sync') === 'true';
  const interval = parseInt(localStorage.getItem('viny-auto-sync-interval') || '60000', 10);
  const savedUrl = localStorage.getItem('viny-server-url');

  if (savedUrl) {
    serverUrl = savedUrl;
  }

  if (enabled && serverUrl) {
    enableAutoSync(interval);
  }
}

/**
 * Save server URL to localStorage
 */
function saveServerUrl(url: string | null): void {
  serverUrl = url;
  if (typeof localStorage !== 'undefined') {
    if (url) {
      localStorage.setItem('viny-server-url', url);
    } else {
      localStorage.removeItem('viny-server-url');
    }
  }
}

// =============================================================================
// Export Store
// =============================================================================

export const syncStore = {
  // State (getters)
  get state() { return syncState; },
  get status() { return status; },
  get error() { return lastError; },
  get conflicts() { return conflicts; },
  get lastResult() { return lastSyncResult; },

  // Derived
  get pendingChanges() { return pendingChanges; },
  get isSyncing() { return isSyncing; },
  get hasError() { return hasError; },
  get isConfigured() { return isConfigured; },
  get lastSyncedAt() { return lastSyncedAt; },
  get serverUrl() { return serverUrl; },
  get autoSyncEnabled() { return autoSyncEnabled; },
  get autoSyncInterval() { return autoSyncInterval; },

  // Actions
  initialize,
  configure,
  disconnect,
  refreshState,
  pull,
  getChangesForPush,
  markPushed,
  sync,
  clearConflicts,
  clearError,

  // Auto-sync
  syncWithServer,
  enableAutoSync,
  disableAutoSync,
  loadAutoSyncSettings,
  saveServerUrl,
};
