<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onInsert: (callout: string) => void;
    onclose: () => void;
  }

  let { open, onInsert, onclose }: Props = $props();

  type CalloutType = 'note' | 'tip' | 'info' | 'warning' | 'danger';

  let selectedType = $state<CalloutType>('note');

  const calloutTypes: { id: CalloutType; name: string; icon: string; color: string }[] = [
    { id: 'note', name: 'Note', icon: '📝', color: '#6b7280' },
    { id: 'tip', name: 'Tip', icon: '💡', color: '#10b981' },
    { id: 'info', name: 'Info', icon: 'ℹ️', color: '#3b82f6' },
    { id: 'warning', name: 'Warning', icon: '⚠️', color: '#f59e0b' },
    { id: 'danger', name: 'Danger', icon: '🚨', color: '#ef4444' },
  ];

  function generateCallout(): string {
    const type = calloutTypes.find((t) => t.id === selectedType);
    // Using GitHub-style callout syntax
    return `> [!${selectedType.toUpperCase()}]\n> Your ${type?.name.toLowerCase()} content here`;
  }

  function handleInsert() {
    const callout = generateCallout();
    onInsert(callout);
    onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleInsert();
    }
  }
</script>

{#if open}
  <div class="callout-insert-backdrop" onclick={onclose} onkeydown={handleKeydown} role="presentation">
    <div class="callout-insert-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert Callout" tabindex="-1">
      <header class="panel-header">
        <h3>Insert Callout</h3>
        <button class="close-btn" onclick={onclose} title="Close"><X size={18} /></button>
      </header>

      <div class="panel-body">
        <p class="description">Select callout type:</p>

        <div class="callout-types">
          {#each calloutTypes as type (type.id)}
            <button
              class="callout-type-btn"
              class:selected={selectedType === type.id}
              onclick={() => selectedType = type.id}
              style="--type-color: {type.color}"
            >
              <span class="type-icon">{type.icon}</span>
              <span class="type-name">{type.name}</span>
            </button>
          {/each}
        </div>

        <div class="preview">
          <span class="preview-label">Preview:</span>
          <pre class="preview-code">{generateCallout()}</pre>
        </div>
      </div>

      <footer class="panel-footer">
        <button class="btn secondary" onclick={onclose}>Cancel</button>
        <button class="btn primary" onclick={handleInsert}>Insert Callout</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .callout-insert-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .callout-insert-panel {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
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

  .panel-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .description {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .callout-types {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .callout-type-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .callout-type-btn:hover {
    border-color: var(--type-color);
  }

  .callout-type-btn.selected {
    border-color: var(--type-color);
    background: color-mix(in srgb, var(--type-color) 15%, var(--bg-secondary));
  }

  .type-icon {
    font-size: 16px;
  }

  .type-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .preview-code {
    margin: 0;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 12px;
    font-family: 'SF Mono', Consolas, monospace;
    color: var(--text-primary);
    overflow-x: auto;
    white-space: pre;
  }

  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn.secondary {
    border: 1px solid var(--border-color);
    background: transparent;
    color: var(--text-secondary);
  }

  .btn.secondary:hover {
    background: var(--bg-hover);
  }

  .btn.primary {
    border: none;
    background: var(--accent-color);
    color: white;
  }

  .btn.primary:hover {
    filter: brightness(1.1);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .callout-insert-backdrop {
      padding: 0;
    }

    .callout-insert-panel {
      max-width: 100%;
      height: 100%;
      border-radius: 0;
      display: flex;
      flex-direction: column;
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
    }

    .callout-types {
      justify-content: center;
    }
  }
</style>
