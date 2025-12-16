<script lang="ts">
  import { isMac } from '$lib/shortcuts';
  import {
    getShortcutsByCategory,
    getEffectiveKeys,
    setCustomKeys,
    resetShortcut,
    resetAllShortcuts,
    isCustomized,
    formatKeys,
    parseKeyEvent,
    findConflict,
    type ShortcutBinding,
    type ShortcutKeys,
  } from '$lib/customShortcuts';
  import { X } from '@lucide/svelte';

  let { open = $bindable(false) } = $props();

  let shortcutsByCategory = $state(getShortcutsByCategory());
  let editingShortcut = $state<ShortcutBinding | null>(null);
  let recordedKeys = $state<ShortcutKeys | null>(null);
  let conflictWarning = $state<string | null>(null);
  let searchQuery = $state('');

  const categories = $derived(Object.keys(shortcutsByCategory));

  const filteredCategories = $derived(() => {
    if (!searchQuery.trim()) return shortcutsByCategory;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, ShortcutBinding[]> = {};

    for (const [category, shortcuts] of Object.entries(shortcutsByCategory)) {
      const matchingShortcuts = shortcuts.filter(
        s => s.name.toLowerCase().includes(query) ||
             s.description.toLowerCase().includes(query)
      );
      if (matchingShortcuts.length > 0) {
        filtered[category] = matchingShortcuts;
      }
    }

    return filtered;
  });

  function close() {
    open = false;
    editingShortcut = null;
    recordedKeys = null;
    conflictWarning = null;
    searchQuery = '';
  }

  function startEditing(shortcut: ShortcutBinding) {
    editingShortcut = shortcut;
    recordedKeys = null;
    conflictWarning = null;
  }

  function cancelEditing() {
    editingShortcut = null;
    recordedKeys = null;
    conflictWarning = null;
  }

  function handleKeyCapture(e: KeyboardEvent) {
    if (!editingShortcut) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only keypresses
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;

    const keys = parseKeyEvent(e);
    recordedKeys = keys;

    // Check for conflicts
    const conflict = findConflict(keys, editingShortcut.id);
    if (conflict) {
      conflictWarning = `Conflicts with "${conflict.name}"`;
    } else {
      conflictWarning = null;
    }
  }

  function saveShortcut() {
    if (!editingShortcut || !recordedKeys) return;

    setCustomKeys(editingShortcut.id, recordedKeys);
    shortcutsByCategory = getShortcutsByCategory();
    cancelEditing();
  }

  function resetToDefault(shortcut: ShortcutBinding) {
    resetShortcut(shortcut.id);
    shortcutsByCategory = getShortcutsByCategory();
  }

  function resetAll() {
    if (confirm('Reset all shortcuts to defaults?')) {
      resetAllShortcuts();
      shortcutsByCategory = getShortcutsByCategory();
    }
  }

  function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Notes': 'N',
      'Navigation': '🧭',
      'View': '👁',
      'Editor': 'E',
      'App': 'S',
    };
    return icons[category] || 'P';
  }
</script>

<svelte:window onkeydown={editingShortcut ? handleKeyCapture : undefined} />

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && !editingShortcut && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="customize-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="customize-title">Customize Shortcuts</h2>
        <div class="header-actions">
          <button class="reset-all-btn" onclick={resetAll} title="Reset all to defaults">
            Reset All
          </button>
          <button class="close-btn" onclick={close} aria-label="Close"><X size={18} /></button>
        </div>
      </header>

      <div class="search-container">
        <input
          type="text"
          class="search-input"
          placeholder="Search shortcuts..."
          bind:value={searchQuery}
          disabled={!!editingShortcut}
        />
      </div>

      <div class="modal-content">
        {#if editingShortcut}
          <div class="editing-overlay">
            <div class="editing-card">
              <h3>Recording shortcut for: <strong>{editingShortcut.name}</strong></h3>
              <p class="editing-hint">Press your desired key combination</p>

              <div class="recorded-keys">
                {#if recordedKeys}
                  <span class="key-display">{formatKeys(recordedKeys, isMac)}</span>
                {:else}
                  <span class="key-placeholder">Waiting for input...</span>
                {/if}
              </div>

              {#if conflictWarning}
                <p class="conflict-warning">{conflictWarning}</p>
              {/if}

              <div class="editing-actions">
                <button class="btn-secondary" onclick={cancelEditing}>Cancel</button>
                <button
                  class="btn-primary"
                  onclick={saveShortcut}
                  disabled={!recordedKeys || !!conflictWarning}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        {/if}

        {#each Object.entries(filteredCategories()) as [category, shortcuts] (category)}
          <section class="shortcut-group">
            <h3>
              <span class="group-icon">{getCategoryIcon(category)}</span>
              {category}
            </h3>
            <div class="shortcut-list">
              {#each shortcuts as shortcut (shortcut.id)}
                {@const effectiveKeys = getEffectiveKeys(shortcut)}
                {@const customized = isCustomized(shortcut.id)}
                <div class="shortcut-item" class:customized>
                  <div class="shortcut-info">
                    <span class="shortcut-name">{shortcut.name}</span>
                    <span class="shortcut-description">{shortcut.description}</span>
                  </div>
                  <div class="shortcut-actions">
                    <button
                      class="key-btn"
                      onclick={() => startEditing(shortcut)}
                      title="Click to customize"
                    >
                      {formatKeys(effectiveKeys, isMac)}
                      {#if customized}
                        <span class="custom-badge">custom</span>
                      {/if}
                    </button>
                    {#if customized}
                      <button
                        class="reset-btn"
                        onclick={() => resetToDefault(shortcut)}
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {:else}
          <div class="no-results">
            <p>No shortcuts found for "{searchQuery}"</p>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <span class="tip">
          Click on a shortcut to customize it. Changes are saved automatically.
        </span>
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
    padding: 24px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    position: relative;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .reset-all-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .reset-all-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 16px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 6px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .search-container {
    padding: 16px 24px 0;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    font-size: 14px;
    color: var(--text-primary);
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .search-input:disabled {
    opacity: 0.5;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    position: relative;
  }

  .editing-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 0 0 16px 16px;
  }

  .editing-card {
    background: var(--bg-primary);
    padding: 32px;
    border-radius: 16px;
    text-align: center;
    max-width: 360px;
    width: 90%;
  }

  .editing-card h3 {
    font-size: 16px;
    font-weight: 500;
    margin: 0 0 8px;
    color: var(--text-primary);
  }

  .editing-card h3 strong {
    color: var(--accent);
  }

  .editing-hint {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 24px;
  }

  .recorded-keys {
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 12px;
    margin-bottom: 16px;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .key-display {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 600;
    color: var(--accent);
  }

  .key-placeholder {
    font-size: 14px;
    color: var(--text-tertiary);
  }

  .conflict-warning {
    font-size: 13px;
    color: var(--warning);
    margin: 0 0 16px;
  }

  .editing-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shortcut-group {
    margin-bottom: 24px;
  }

  .shortcut-group:last-child {
    margin-bottom: 0;
  }

  .shortcut-group h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-bottom: 12px;
    letter-spacing: 0.5px;
  }

  .group-icon {
    font-size: 14px;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--bg-secondary);
    border-radius: 8px;
    transition: background 0.15s;
  }

  .shortcut-item:hover {
    background: var(--bg-hover);
  }

  .shortcut-item.customized {
    border-left: 3px solid var(--accent);
  }

  .shortcut-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .shortcut-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .shortcut-description {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .shortcut-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .key-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .key-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .custom-badge {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 5px;
    background: var(--accent);
    color: white;
    border-radius: 3px;
  }

  .reset-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .reset-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .no-results {
    text-align: center;
    padding: 32px;
    color: var(--text-tertiary);
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
  }

  .tip {
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
