<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onInsert: (checklist: string) => void;
    onclose: () => void;
  }

  let { open, onInsert, onclose }: Props = $props();

  let itemCount = $state(3);
  let hoveredCount = $state(0);

  const maxItems = 10;

  function handleItemHover(count: number) {
    hoveredCount = count;
  }

  function handleItemClick(count: number) {
    itemCount = count;
  }

  function generateChecklist(): string {
    const items = Array(itemCount)
      .fill(0)
      .map((_, i) => `- [ ] Item ${i + 1}`);
    return items.join('\n');
  }

  function handleInsert() {
    const checklist = generateChecklist();
    onInsert(checklist);
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
  <div class="checklist-insert-backdrop" onclick={onclose} onkeydown={handleKeydown} role="presentation">
    <div class="checklist-insert-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert Checklist" tabindex="-1">
      <header class="panel-header">
        <h3>Insert Checklist</h3>
        <button class="close-btn" onclick={onclose} title="Close"><X size={18} /></button>
      </header>

      <div class="panel-body">
        <p class="description">Click to select number of items:</p>

        <div class="item-selector" onmouseleave={() => { hoveredCount = 0; }} role="group" aria-label="Select item count">
          {#each Array(maxItems) as _, i}
            <button
              class="item-btn"
              class:hovered={(i + 1) <= (hoveredCount || itemCount)}
              class:selected={(i + 1) <= itemCount}
              onmouseenter={() => handleItemHover(i + 1)}
              onclick={() => handleItemClick(i + 1)}
              type="button"
              title="{i + 1} item{i > 0 ? 's' : ''}"
            >
              <span class="checkbox-icon">☐</span>
            </button>
          {/each}
        </div>

        <div class="count-display">
          {hoveredCount || itemCount} item{(hoveredCount || itemCount) !== 1 ? 's' : ''}
        </div>

        <div class="preview">
          <span class="preview-label">Preview:</span>
          <pre class="preview-code">{generateChecklist()}</pre>
        </div>
      </div>

      <footer class="panel-footer">
        <button class="btn secondary" onclick={onclose}>Cancel</button>
        <button class="btn primary" onclick={handleInsert}>Insert Checklist</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .checklist-insert-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .checklist-insert-panel {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 360px;
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

  .item-selector {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .item-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.1s;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .item-btn:hover {
    border-color: var(--accent-color);
  }

  .item-btn.hovered {
    background: var(--accent-color);
    border-color: var(--accent-color);
    opacity: 0.5;
  }

  .item-btn.selected {
    background: var(--accent-color);
    border-color: var(--accent-color);
    opacity: 1;
  }

  .item-btn.selected .checkbox-icon,
  .item-btn.hovered .checkbox-icon {
    color: white;
  }

  .checkbox-icon {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .count-display {
    text-align: center;
    font-size: 14px;
    font-weight: 600;
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
    max-height: 150px;
    overflow-y: auto;
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
    .checklist-insert-backdrop {
      padding: 0;
    }

    .checklist-insert-panel {
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

    .item-btn {
      width: 32px;
      height: 32px;
    }
  }
</style>
