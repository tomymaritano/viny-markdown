<script lang="ts">
  import { syncStore, notesStore, appStore } from '$lib/stores';
  import * as api from '$lib/api';
  import { toast } from '$lib/toast';
  import type { ExportStats, ImportStats, SyncResult } from '$lib/bindings';
  import * as encryption from '$lib/encryption';

  let { open = $bindable(false) } = $props();

  let activeTab = $state<'general' | 'sync' | 'backup' | 'security'>('general');
  let isExporting = $state(false);
  let isImporting = $state(false);
  let exportResult = $state<ExportStats | null>(null);
  let importResult = $state<ImportStats | null>(null);
  let errorMessage = $state<string | null>(null);

  // Import options
  let overwriteExisting = $state(false);

  // Server sync
  let serverUrl = $state(syncStore.serverUrl || 'http://localhost:3000');
  let isCheckingConnection = $state(false);
  let isServerConnected = $state<boolean | null>(null);
  let isSyncing = $state(false);
  let syncResult = $state<SyncResult | null>(null);
  let autoSyncEnabled = $state(syncStore.autoSyncEnabled);
  let autoSyncInterval = $state(syncStore.autoSyncInterval / 1000); // in seconds for UI

  // Encryption state
  let encryptionConfigured = $state(false);
  let encryptionEnabled = $state(false);
  let encryptionPassword = $state('');
  let encryptionConfirmPassword = $state('');
  let encryptionOldPassword = $state('');
  let encryptionNewPassword = $state('');
  let isSettingUpEncryption = $state(false);
  let isUnlocking = $state(false);
  let isChangingPassword = $state(false);

  // Check encryption status on open
  $effect(() => {
    if (open) {
      checkEncryptionStatus();
    }
  });

  async function checkEncryptionStatus() {
    try {
      encryptionConfigured = await encryption.hasEncryptionConfigured();
      encryptionEnabled = await encryption.isEncryptionEnabled();
    } catch (err) {
      console.error('Failed to check encryption status:', err);
    }
  }

  async function handleSetupEncryption() {
    if (encryptionPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (encryptionPassword !== encryptionConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    isSettingUpEncryption = true;
    try {
      await encryption.setupEncryption(encryptionPassword);
      encryptionConfigured = true;
      encryptionEnabled = true;
      encryptionPassword = '';
      encryptionConfirmPassword = '';
      toast.success('Encryption enabled');
    } catch (err) {
      toast.error('Failed to setup encryption');
      console.error(err);
    } finally {
      isSettingUpEncryption = false;
    }
  }

  async function handleUnlock() {
    isUnlocking = true;
    try {
      await encryption.unlockEncryption(encryptionPassword);
      encryptionEnabled = true;
      encryptionPassword = '';
      toast.success('Encryption unlocked');
    } catch (err) {
      toast.error('Incorrect password');
      console.error(err);
    } finally {
      isUnlocking = false;
    }
  }

  async function handleLock() {
    try {
      await encryption.lockEncryption();
      encryptionEnabled = false;
      toast.success('Encryption locked');
    } catch (err) {
      toast.error('Failed to lock encryption');
    }
  }

  async function handleChangePassword() {
    if (encryptionNewPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    isChangingPassword = true;
    try {
      await encryption.changeEncryptionPassword(encryptionOldPassword, encryptionNewPassword);
      encryptionOldPassword = '';
      encryptionNewPassword = '';
      toast.success('Password changed');
    } catch (err) {
      toast.error('Failed to change password. Check your current password.');
      console.error(err);
    } finally {
      isChangingPassword = false;
    }
  }

  async function handleDisableEncryption() {
    if (!confirm('Are you sure you want to disable encryption? Your notes will no longer be encrypted.')) {
      return;
    }

    try {
      await encryption.disableEncryption(encryptionPassword);
      encryptionConfigured = false;
      encryptionEnabled = false;
      encryptionPassword = '';
      toast.success('Encryption disabled');
    } catch (err) {
      toast.error('Incorrect password');
      console.error(err);
    }
  }

  async function checkConnection() {
    isCheckingConnection = true;
    isServerConnected = null;
    errorMessage = null;

    try {
      isServerConnected = await api.checkServerConnection(serverUrl);
    } catch (err) {
      isServerConnected = false;
      errorMessage = err instanceof Error ? err.message : 'Connection failed';
    } finally {
      isCheckingConnection = false;
    }
  }

  async function handleSync() {
    isSyncing = true;
    errorMessage = null;
    syncResult = null;

    try {
      syncResult = await api.syncWithServer(serverUrl);
      await syncStore.refreshState();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Sync failed';
    } finally {
      isSyncing = false;
    }
  }

  function handleAutoSyncToggle() {
    autoSyncEnabled = !autoSyncEnabled;
    if (autoSyncEnabled) {
      syncStore.saveServerUrl(serverUrl);
      syncStore.enableAutoSync(autoSyncInterval * 1000);
    } else {
      syncStore.disableAutoSync();
    }
  }

  function handleIntervalChange(e: Event) {
    const value = parseInt((e.target as HTMLSelectElement).value, 10);
    autoSyncInterval = value;
    if (autoSyncEnabled) {
      syncStore.enableAutoSync(value * 1000);
    }
  }

  async function handleExport() {
    isExporting = true;
    errorMessage = null;
    exportResult = null;

    try {
      // Get save path from user
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        filters: [{ name: 'Viny Backup', extensions: ['zip'] }],
        defaultPath: `viny-backup-${new Date().toISOString().split('T')[0]}.zip`,
      });

      if (path) {
        exportResult = await api.exportData(path);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Export failed';
    } finally {
      isExporting = false;
    }
  }

  async function handleExportJSON() {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      const path = await save({
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        defaultPath: `viny-notes-${new Date().toISOString().split('T')[0]}.json`,
      });

      if (!path) return;

      const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        notes: notesStore.allNotes,
        notebooks: appStore.notebooks,
        tags: appStore.tags,
      };

      await writeTextFile(path, JSON.stringify(backup, null, 2));
      toast.success(`Exported ${backup.notes.length} notes to JSON`);
    } catch (err) {
      toast.error('Failed to export as JSON');
      console.error(err);
    }
  }

  async function handleImportMarkdown() {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');

      const paths = await openDialog({
        filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] }],
        multiple: true,
      });

      if (!paths || paths.length === 0) return;

      const filePaths = Array.isArray(paths) ? paths : [paths];
      let imported = 0;

      for (const filePath of filePaths) {
        if (typeof filePath !== 'string') continue;

        const content = await readTextFile(filePath);
        const fileName = filePath.split('/').pop() || 'Untitled';
        const title = fileName.replace(/\.(md|markdown|txt)$/, '');

        await notesStore.createNote({
          title,
          content,
        });
        imported++;
      }

      toast.success(`Imported ${imported} note${imported !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Failed to import markdown files');
      console.error(err);
    }
  }

  async function handleImportJSON() {
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');

      const path = await openDialog({
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
        multiple: false,
      });

      if (!path || typeof path !== 'string') return;

      const content = await readTextFile(path);
      const backup = JSON.parse(content);

      if (!backup.notes || !Array.isArray(backup.notes)) {
        toast.error('Invalid backup file format');
        return;
      }

      let imported = 0;
      for (const note of backup.notes) {
        await notesStore.createNote({
          title: note.title || 'Untitled',
          content: note.content || '',
        });
        imported++;
      }

      toast.success(`Imported ${imported} note${imported !== 1 ? 's' : ''} from JSON`);
    } catch (err) {
      toast.error('Failed to import JSON backup');
      console.error(err);
    }
  }

  async function handleImport() {
    isImporting = true;
    errorMessage = null;
    importResult = null;

    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const path = await openDialog({
        filters: [{ name: 'Viny Backup', extensions: ['zip'] }],
        multiple: false,
      });

      if (path && typeof path === 'string') {
        importResult = await api.importData({
          file_path: path,
          overwrite_existing: overwriteExisting,
        });

        // Refresh data after import
        // This would need to trigger store refreshes
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Import failed';
    } finally {
      isImporting = false;
    }
  }

  async function getPreview() {
    try {
      const preview = await api.getExportPreview();
      return preview;
    } catch {
      return null;
    }
  }

  function close() {
    open = false;
    exportResult = null;
    importResult = null;
    errorMessage = null;
  }
</script>

{#if open}
  <div class="modal-backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="0">
    <div class="modal" role="dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <h2>Settings</h2>
        <button class="close-btn" onclick={close}>✕</button>
      </header>

      <nav class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'general'}
          onclick={() => activeTab = 'general'}
        >
          General
        </button>
        <button
          class="tab"
          class:active={activeTab === 'sync'}
          onclick={() => activeTab = 'sync'}
        >
          Sync
        </button>
        <button
          class="tab"
          class:active={activeTab === 'backup'}
          onclick={() => activeTab = 'backup'}
        >
          Backup
        </button>
        <button
          class="tab"
          class:active={activeTab === 'security'}
          onclick={() => activeTab = 'security'}
        >
          Security
        </button>
      </nav>

      <div class="modal-content">
        {#if activeTab === 'general'}
          <section class="settings-section">
            <h3>Appearance</h3>
            <p class="hint">Theme follows your system preferences.</p>
          </section>

          <section class="settings-section">
            <h3>Editor</h3>
            <label class="setting-row">
              <span>Auto-save delay</span>
              <select>
                <option value="300">300ms</option>
                <option value="500" selected>500ms</option>
                <option value="1000">1s</option>
              </select>
            </label>
          </section>

        {:else if activeTab === 'sync'}
          <section class="settings-section">
            <h3>Sync Status</h3>
            <div class="sync-info">
              <div class="info-row">
                <span>Status</span>
                <span class="status-badge" class:synced={!syncStore.hasError}>
                  {syncStore.isSyncing ? 'Syncing...' : syncStore.hasError ? 'Error' : 'Ready'}
                </span>
              </div>
              <div class="info-row">
                <span>Pending changes</span>
                <span>{syncStore.pendingChanges}</span>
              </div>
              <div class="info-row">
                <span>Last synced</span>
                <span>{syncStore.lastSyncedAt || 'Never'}</span>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>Server</h3>
            <p class="hint">Connect to a Viny server to sync your notes across devices.</p>

            <div class="server-config">
              <label class="setting-row">
                <span>Server URL</span>
                <input
                  type="text"
                  bind:value={serverUrl}
                  placeholder="http://localhost:3000"
                  class="server-input"
                />
              </label>

              <div class="server-actions">
                <button
                  class="action-btn"
                  onclick={checkConnection}
                  disabled={isCheckingConnection || !serverUrl}
                >
                  {isCheckingConnection ? 'Checking...' : 'Test Connection'}
                </button>

                {#if isServerConnected !== null}
                  <span class="connection-status" class:connected={isServerConnected}>
                    {isServerConnected ? 'Connected' : 'Not connected'}
                  </span>
                {/if}
              </div>

              {#if isServerConnected}
                <button
                  class="action-btn primary"
                  onclick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>

                {#if syncResult}
                  <div class="result success">
                    Pulled: {syncResult.pulled.notes} notes, {syncResult.pulled.notebooks} notebooks, {syncResult.pulled.tags} tags<br>
                    Pushed: {syncResult.pushed.notes} items
                    {#if syncResult.conflicts.length > 0}
                      <br>Conflicts: {syncResult.conflicts.length}
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
          </section>

          <section class="settings-section">
            <h3>Auto-Sync</h3>
            <p class="hint">Automatically sync your notes in the background.</p>

            <label class="checkbox-row">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onchange={handleAutoSyncToggle}
                disabled={!isServerConnected && !autoSyncEnabled}
              />
              <span>Enable auto-sync</span>
            </label>

            {#if autoSyncEnabled}
              <label class="setting-row">
                <span>Sync interval</span>
                <select value={autoSyncInterval} onchange={handleIntervalChange}>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                </select>
              </label>

              <div class="auto-sync-status">
                <span class="status-indicator active"></span>
                <span>Auto-sync active</span>
              </div>
            {/if}
          </section>

        {:else if activeTab === 'backup'}
          <section class="settings-section">
            <h3>Export Data</h3>
            <p class="hint">Export all your notes, notebooks, and tags.</p>

            {#await getPreview()}
              <p class="preview">Loading preview...</p>
            {:then preview}
              {#if preview}
                <div class="preview">
                  <span>{preview.notes} notes</span>
                  <span>{preview.notebooks} notebooks</span>
                  <span>{preview.tags} tags</span>
                </div>
              {/if}
            {/await}

            <div class="button-group">
              <button
                class="action-btn primary"
                onclick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export ZIP'}
              </button>
              <button
                class="action-btn"
                onclick={handleExportJSON}
              >
                Export JSON
              </button>
            </div>

            {#if exportResult}
              <div class="result success">
                Exported {exportResult.notes} notes, {exportResult.notebooks} notebooks, {exportResult.tags} tags
              </div>
            {/if}
          </section>

          <section class="settings-section">
            <h3>Import Data</h3>
            <p class="hint">Import notes from various formats.</p>

            <div class="button-group">
              <button
                class="action-btn"
                onclick={handleImportMarkdown}
              >
                Import Markdown
              </button>
              <button
                class="action-btn"
                onclick={handleImportJSON}
              >
                Import JSON
              </button>
            </div>

            <div class="import-divider">
              <span>Or restore from backup</span>
            </div>

            <label class="checkbox-row">
              <input type="checkbox" bind:checked={overwriteExisting} />
              <span>Overwrite existing items</span>
            </label>

            <button
              class="action-btn"
              onclick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import ZIP Backup'}
            </button>

            {#if importResult}
              <div class="result success">
                Imported: {importResult.notes_imported} notes, {importResult.notebooks_imported} notebooks, {importResult.tags_imported} tags
                {#if importResult.notes_skipped > 0 || importResult.notebooks_skipped > 0 || importResult.tags_skipped > 0}
                  <br>Skipped: {importResult.notes_skipped} notes, {importResult.notebooks_skipped} notebooks, {importResult.tags_skipped} tags
                {/if}
              </div>
            {/if}
          </section>

          {#if errorMessage}
            <div class="result error">{errorMessage}</div>
          {/if}

        {:else if activeTab === 'security'}
          <section class="settings-section">
            <h3>End-to-End Encryption</h3>
            <p class="hint">
              Encrypt your notes with AES-256-GCM. Only you can read them.
            </p>

            {#if !encryptionConfigured}
              <!-- Setup encryption for the first time -->
              <div class="encryption-form">
                <label class="form-label">
                  Password (min 8 characters)
                  <input
                    type="password"
                    bind:value={encryptionPassword}
                    placeholder="Enter password"
                    class="form-input"
                  />
                </label>
                <label class="form-label">
                  Confirm Password
                  <input
                    type="password"
                    bind:value={encryptionConfirmPassword}
                    placeholder="Confirm password"
                    class="form-input"
                  />
                </label>
                <button
                  class="action-btn primary"
                  onclick={handleSetupEncryption}
                  disabled={isSettingUpEncryption || encryptionPassword.length < 8}
                >
                  {isSettingUpEncryption ? 'Setting up...' : 'Enable Encryption'}
                </button>
              </div>

            {:else if !encryptionEnabled}
              <!-- Encryption configured but locked -->
              <div class="encryption-status locked">
                <span class="status-icon">L</span>
                <span>Encryption is locked</span>
              </div>
              <div class="encryption-form">
                <label class="form-label">
                  Password
                  <input
                    type="password"
                    bind:value={encryptionPassword}
                    placeholder="Enter password to unlock"
                    class="form-input"
                  />
                </label>
                <button
                  class="action-btn primary"
                  onclick={handleUnlock}
                  disabled={isUnlocking || !encryptionPassword}
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock'}
                </button>
              </div>

            {:else}
              <!-- Encryption enabled and unlocked -->
              <div class="encryption-status unlocked">
                <span class="status-icon">U</span>
                <span>Encryption is active</span>
              </div>

              <div class="button-group">
                <button class="action-btn" onclick={handleLock}>
                  Lock Now
                </button>
              </div>

              <div class="settings-divider"></div>

              <h4>Change Password</h4>
              <div class="encryption-form">
                <label class="form-label">
                  Current Password
                  <input
                    type="password"
                    bind:value={encryptionOldPassword}
                    placeholder="Current password"
                    class="form-input"
                  />
                </label>
                <label class="form-label">
                  New Password
                  <input
                    type="password"
                    bind:value={encryptionNewPassword}
                    placeholder="New password"
                    class="form-input"
                  />
                </label>
                <button
                  class="action-btn"
                  onclick={handleChangePassword}
                  disabled={isChangingPassword || !encryptionOldPassword || encryptionNewPassword.length < 8}
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>

              <div class="settings-divider"></div>

              <h4>Disable Encryption</h4>
              <p class="hint warning">This will remove encryption from your notes.</p>
              <div class="encryption-form">
                <label class="form-label">
                  Confirm with Password
                  <input
                    type="password"
                    bind:value={encryptionPassword}
                    placeholder="Enter password to confirm"
                    class="form-input"
                  />
                </label>
                <button
                  class="action-btn danger"
                  onclick={handleDisableEncryption}
                  disabled={!encryptionPassword}
                >
                  Disable Encryption
                </button>
              </div>
            {/if}
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 540px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
  }

  .tab {
    padding: 12px 16px;
    background: none;
    border: none;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    position: relative;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .settings-section {
    margin-bottom: 24px;
  }

  .settings-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .hint {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .setting-row select {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .sync-info {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 12px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    background: var(--warning-light);
    color: var(--warning);
  }

  .status-badge.synced {
    background: var(--success-light);
    color: var(--success);
  }

  .preview {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin-bottom: 12px;
    cursor: pointer;
  }

  .action-btn {
    padding: 10px 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .action-btn.primary:hover:not(:disabled) {
    background: var(--accent-dark);
  }

  .button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .import-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 16px 0;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .import-divider::before,
  .import-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .result {
    margin-top: 12px;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
  }

  .result.success {
    background: var(--success-light);
    color: var(--success);
  }

  .result.error {
    background: var(--error-light);
    color: var(--error);
  }

  .server-config {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .server-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    min-width: 200px;
  }

  .server-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .connection-status {
    font-size: 13px;
    padding: 4px 10px;
    border-radius: 4px;
    background: var(--error-light);
    color: var(--error);
  }

  .connection-status.connected {
    background: var(--success-light);
    color: var(--success);
  }

  .auto-sync-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--success-light);
    border-radius: 6px;
    font-size: 13px;
    color: var(--success);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-tertiary);
  }

  .status-indicator.active {
    background: var(--success);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Encryption styles */
  .encryption-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }

  .form-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .form-input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .encryption-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    margin: 12px 0;
  }

  .encryption-status.locked {
    background: var(--error-light);
    color: var(--error);
  }

  .encryption-status.unlocked {
    background: var(--success-light);
    color: var(--success);
  }

  .encryption-status .status-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 12px;
  }

  .encryption-status.locked .status-icon {
    background: var(--error);
    color: white;
  }

  .encryption-status.unlocked .status-icon {
    background: var(--success);
    color: white;
  }

  .settings-divider {
    height: 1px;
    background: var(--border);
    margin: 20px 0;
  }

  .settings-section h4 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }

  .hint.warning {
    color: var(--error);
  }

  .action-btn.danger {
    background: var(--error);
    color: white;
    border-color: var(--error);
  }

  .action-btn.danger:hover {
    background: var(--error-dark);
  }
</style>
