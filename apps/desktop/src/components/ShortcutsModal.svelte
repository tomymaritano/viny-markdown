<script lang="ts">
  import { isMac } from '$lib/shortcuts';

  let { open = $bindable(false), onCustomize = () => {} } = $props<{
    open?: boolean;
    onCustomize?: () => void;
  }>();

  interface ShortcutItem {
    keys: string;
    description: string;
  }

  interface ShortcutGroup {
    name: string;
    icon: string;
    items: ShortcutItem[];
  }

  const shortcutGroups: ShortcutGroup[] = [
    {
      name: 'Notes',
      icon: '📝',
      items: [
        { keys: isMac ? '⌘N' : 'Ctrl+N', description: 'New note' },
        { keys: isMac ? '⌘⇧N' : 'Ctrl+Shift+N', description: 'New from template' },
        { keys: isMac ? '⌘D' : 'Ctrl+D', description: 'Duplicate note' },
        { keys: isMac ? '⌘⌫' : 'Ctrl+Backspace', description: 'Delete note' },
        { keys: isMac ? '⌘⇧P' : 'Ctrl+Shift+P', description: 'Toggle pin' },
        { keys: isMac ? '⌘⇧C' : 'Ctrl+Shift+C', description: 'Copy to clipboard' },
      ],
    },
    {
      name: 'Navigation',
      icon: '🧭',
      items: [
        { keys: isMac ? '⌘K' : 'Ctrl+K', description: 'Command palette' },
        { keys: isMac ? '⌘P' : 'Ctrl+P', description: 'Quick search' },
        { keys: isMac ? '⌘⇧F' : 'Ctrl+Shift+F', description: 'Global search' },
        { keys: isMac ? '⌘⇧G' : 'Ctrl+Shift+G', description: 'Note graph' },
        { keys: isMac ? '⌘⇧C' : 'Ctrl+Shift+C', description: 'Quick capture' },
        { keys: isMac ? '⌘[' : 'Ctrl+[', description: 'Go back' },
        { keys: isMac ? '⌘]' : 'Ctrl+]', description: 'Go forward' },
        { keys: 'J', description: 'Next note' },
        { keys: 'K', description: 'Previous note' },
        { keys: isMac ? '⌘↓' : 'Ctrl+↓', description: 'Next note' },
        { keys: isMac ? '⌘↑' : 'Ctrl+↑', description: 'Previous note' },
      ],
    },
    {
      name: 'View',
      icon: '👁',
      items: [
        { keys: isMac ? '⌘\\' : 'Ctrl+\\', description: 'Toggle focus mode' },
        { keys: isMac ? '⌘⇧D' : 'Ctrl+Shift+D', description: 'Toggle dark mode' },
        { keys: isMac ? '⌘E' : 'Ctrl+E', description: 'Toggle view mode' },
      ],
    },
    {
      name: 'App',
      icon: '⚙️',
      items: [
        { keys: isMac ? '⌘,' : 'Ctrl+,', description: 'Settings' },
        { keys: isMac ? '⌘/' : 'Ctrl+/', description: 'Keyboard shortcuts' },
        { keys: 'Esc', description: 'Close modal' },
      ],
    },
    {
      name: 'Editor',
      icon: '✏️',
      items: [
        { keys: isMac ? '⌘F' : 'Ctrl+F', description: 'Find & Replace' },
        { keys: '[[title]]', description: 'Link to note' },
        { keys: ':emoji:', description: 'Emoji autocomplete' },
        { keys: '/snippet', description: 'Quick snippets' },
        { keys: '**text**', description: 'Bold' },
        { keys: '*text*', description: 'Italic' },
        { keys: '`code`', description: 'Inline code' },
        { keys: '- [ ]', description: 'Task item' },
        { keys: '> text', description: 'Blockquote' },
        { keys: '| A | B |', description: 'Table' },
      ],
    },
  ];

  let searchQuery = $state('');

  const filteredGroups = $derived(
    searchQuery.trim()
      ? shortcutGroups.map(group => ({
          ...group,
          items: group.items.filter(item =>
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.keys.toLowerCase().includes(searchQuery.toLowerCase())
          )
        })).filter(group => group.items.length > 0)
      : shortcutGroups
  );

  function close() {
    open = false;
    searchQuery = '';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="shortcuts-title"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
        <div class="header-actions">
          <button class="customize-btn" onclick={onCustomize} title="Customize shortcuts">
            ⚙️ Customize
          </button>
          <button class="close-btn" onclick={close} aria-label="Close">✕</button>
        </div>
      </header>

      <div class="search-container">
        <input
          type="text"
          class="search-input"
          placeholder="Search shortcuts..."
          bind:value={searchQuery}
        />
      </div>

      <div class="modal-content">
        {#each filteredGroups as group (group.name)}
          <section class="shortcut-group">
            <h3>
              <span class="group-icon">{group.icon}</span>
              {group.name}
            </h3>
            <div class="shortcut-list">
              {#each group.items as item}
                <div class="shortcut-item">
                  <span class="shortcut-description">{item.description}</span>
                  <div class="shortcut-keys-container">
                    {#each item.keys.split('+') as key, i}
                      {#if i > 0}
                        <span class="key-separator">+</span>
                      {/if}
                      <kbd class="shortcut-key">{key}</kbd>
                    {/each}
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
          Tip: Use <kbd>[[note title]]</kbd> to link between notes
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
    max-width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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

  .customize-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .customize-btn:hover {
    opacity: 0.9;
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

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
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
    padding: 10px 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .shortcut-item:hover {
    background: var(--bg-hover);
  }

  .shortcut-description {
    font-size: 14px;
    color: var(--text-primary);
  }

  .shortcut-keys-container {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .key-separator {
    color: var(--text-tertiary);
    font-size: 12px;
  }

  .shortcut-key {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    min-width: 24px;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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

  .tip kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
</style>
