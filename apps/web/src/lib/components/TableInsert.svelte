<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onInsert: (table: string) => void;
    onclose: () => void;
  }

  let { open, onInsert, onclose }: Props = $props();

  let rows = $state(3);
  let cols = $state(3);
  let hoveredRows = $state(0);
  let hoveredCols = $state(0);
  let includeHeader = $state(true);

  const maxRows = 8;
  const maxCols = 8;

  function handleCellHover(r: number, c: number) {
    hoveredRows = r;
    hoveredCols = c;
  }

  function handleCellClick(r: number, c: number) {
    rows = r;
    cols = c;
  }

  function generateTable(): string {
    const lines: string[] = [];

    // Header row
    const headerCells = Array(cols).fill(0).map((_, i) => `Column ${i + 1}`);
    lines.push(`| ${headerCells.join(' | ')} |`);

    // Separator row
    const separator = Array(cols).fill('---');
    lines.push(`| ${separator.join(' | ')} |`);

    // Data rows (minus 1 for header)
    const dataRows = includeHeader ? rows - 1 : rows;
    for (let i = 0; i < dataRows; i++) {
      const cells = Array(cols).fill('');
      lines.push(`| ${cells.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  function handleInsert() {
    const table = generateTable();
    onInsert(table);
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
  <div class="table-insert-backdrop" onclick={onclose} onkeydown={handleKeydown} role="presentation">
    <div class="table-insert-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert Table">
      <header class="panel-header">
        <h3>Insert Table</h3>
        <button class="close-btn" onclick={onclose} title="Close"><X size={18} /></button>
      </header>

      <div class="panel-body">
        <div class="grid-selector" onmouseleave={() => { hoveredRows = 0; hoveredCols = 0; }}>
          {#each Array(maxRows) as _, r}
            <div class="grid-row">
              {#each Array(maxCols) as _, c}
                <button
                  class="grid-cell"
                  class:hovered={(r + 1) <= (hoveredRows || rows) && (c + 1) <= (hoveredCols || cols)}
                  class:selected={(r + 1) <= rows && (c + 1) <= cols}
                  onmouseenter={() => handleCellHover(r + 1, c + 1)}
                  onclick={() => handleCellClick(r + 1, c + 1)}
                  type="button"
                ></button>
              {/each}
            </div>
          {/each}
        </div>

        <div class="size-display">
          {hoveredRows || rows} × {hoveredCols || cols}
        </div>

        <label class="header-option">
          <input type="checkbox" bind:checked={includeHeader} />
          <span>Include header row</span>
        </label>

        <div class="preview">
          <span class="preview-label">Preview:</span>
          <pre class="preview-code">{generateTable()}</pre>
        </div>
      </div>

      <footer class="panel-footer">
        <button class="btn secondary" onclick={onclose}>Cancel</button>
        <button class="btn primary" onclick={handleInsert}>Insert Table</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .table-insert-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .table-insert-panel {
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

  .grid-selector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-self: center;
  }

  .grid-row {
    display: flex;
    gap: 4px;
  }

  .grid-cell {
    width: 24px;
    height: 24px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.1s;
    padding: 0;
  }

  .grid-cell:hover {
    border-color: var(--accent-color);
  }

  .grid-cell.hovered {
    background: var(--accent-color);
    border-color: var(--accent-color);
    opacity: 0.5;
  }

  .grid-cell.selected {
    background: var(--accent-color);
    border-color: var(--accent-color);
    opacity: 1;
  }

  .size-display {
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .header-option input {
    width: 16px;
    height: 16px;
    cursor: pointer;
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
    font-size: 11px;
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
    .table-insert-backdrop {
      padding: 0;
    }

    .table-insert-panel {
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

    .preview-code {
      font-size: 10px;
    }
  }
</style>
