<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { category: 'Notes', items: [
      { keys: `${mod} + N`, description: 'New note' },
      { keys: `${mod} + D`, description: 'Open daily note' },
      { keys: `${mod} + Shift + R`, description: 'Open random note' },
      { keys: `${mod} + Shift + M`, description: 'Template manager' },
      { keys: `${mod} + Shift + T`, description: 'New from template' },
      { keys: `${mod} + P`, description: 'Pin/unpin note' },
      { keys: `${mod} + Shift + D`, description: 'Duplicate note' },
      { keys: `${mod} + Shift + C`, description: 'Copy to clipboard' },
      { keys: `${mod} + Shift + E`, description: 'Export note' },
      { keys: `${mod} + Shift + A`, description: 'Archive note' },
      { keys: `${mod} + Backspace`, description: 'Delete note' },
      { keys: '↑ / ↓', description: 'Navigate notes' },
    ]},
    { category: 'Search', items: [
      { keys: `${mod} + K`, description: 'Command palette' },
      { keys: `${mod} + O`, description: 'Quick switcher' },
      { keys: `${mod} + F`, description: 'Find & replace' },
      { keys: 'Escape', description: 'Clear focus / blur' },
    ]},
    { category: 'View', items: [
      { keys: `${mod} + E`, description: 'Cycle view mode (Edit/Split/Preview)' },
      { keys: `${mod} + Shift + G`, description: 'Open note graph' },
      { keys: `${mod} + Shift + J`, description: 'Note calendar' },
      { keys: `${mod} + Shift + U`, description: 'Note outline' },
      { keys: `${mod} + Shift + K`, description: 'Backlinks' },
      { keys: `${mod} + Shift + X`, description: 'Daily word goal' },
      { keys: `${mod} + Shift + Y`, description: 'Open focus timer' },
      { keys: `${mod} + Shift + W`, description: 'Writing statistics' },
      { keys: `${mod} + Shift + L`, description: 'Tag manager' },
      { keys: `${mod} + Shift + B`, description: 'Notebook manager' },
      { keys: `${mod} + Shift + V`, description: 'Toggle list/card view' },
      { keys: `${mod} + Shift + S`, description: 'Toggle select mode' },
      { keys: `${mod} + T`, description: 'Toggle typewriter mode' },
      { keys: `${mod} + .`, description: 'Toggle focus mode' },
      { keys: `${mod} + I`, description: 'Show note info' },
      { keys: `${mod} + H`, description: 'Show version history' },
    ]},
    { category: 'Help', items: [
      { keys: '?', description: 'Show keyboard shortcuts' },
    ]},
  ];

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="shortcuts-title"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={onclose} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div class="modal-body">
        {#each shortcuts as section}
          <div class="shortcut-section">
            <h3 class="section-title">{section.category}</h3>
            <ul class="shortcut-list">
              {#each section.items as shortcut}
                <li class="shortcut-item">
                  <kbd class="keys">{shortcut.keys}</kbd>
                  <span class="description">{shortcut.description}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>

      <footer class="modal-footer">
        <span class="tip">Press <kbd>Escape</kbd> to close</span>
      </footer>
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
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 420px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .close-btn:hover {
    background: var(--bg-hover);
  }

  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .shortcut-section {
    margin-bottom: 20px;
  }

  .shortcut-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }

  .shortcut-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-light);
  }

  .shortcut-item:last-child {
    border-bottom: none;
  }

  .keys {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    color: var(--text-primary);
  }

  .description {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    text-align: center;
  }

  .tip {
    font-size: 12px;
    color: var(--text-muted);
  }

  .tip kbd {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    color: var(--text-primary);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal {
      max-width: 100%;
      max-height: 100%;
      height: 100%;
      border-radius: 0;
    }

    .modal-header {
      padding: 12px 16px;
    }

    .modal-body {
      padding: 12px 16px;
    }

    .shortcut-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .keys {
      font-size: 11px;
    }

    .description {
      font-size: 13px;
    }

    .modal-footer {
      display: none;
    }
  }
</style>
