<script lang="ts">
  interface Props {
    content: string;
    onHeadingClick: (line: number) => void;
  }

  let { content, onHeadingClick }: Props = $props();

  interface Heading {
    level: number;
    text: string;
    line: number;
  }

  const headings = $derived(() => {
    const result: Heading[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        result.push({
          level: match[1].length,
          text: match[2].trim(),
          line: i,
        });
      }
    }

    return result;
  });
</script>

<div class="toc-panel">
  <header class="toc-header">
    <h3>Table of Contents</h3>
  </header>

  <div class="toc-content">
    {#if headings().length === 0}
      <p class="empty-state">No headings found</p>
    {:else}
      <nav class="toc-nav">
        {#each headings() as heading (heading.line)}
          <button
            class="toc-item level-{heading.level}"
            onclick={() => onHeadingClick(heading.line)}
            title="Go to: {heading.text}"
          >
            <span class="toc-marker">{heading.level === 1 ? '#' : heading.level === 2 ? '##' : '###'}</span>
            <span class="toc-text">{heading.text}</span>
          </button>
        {/each}
      </nav>
    {/if}
  </div>
</div>

<style>
  .toc-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
  }

  .toc-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .toc-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toc-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .toc-nav {
    display: flex;
    flex-direction: column;
  }

  .toc-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-size: 13px;
    transition: background 0.1s;
  }

  .toc-item:hover {
    background: var(--bg-hover);
  }

  .toc-item.level-1 {
    font-weight: 600;
    padding-left: 16px;
  }

  .toc-item.level-2 {
    padding-left: 24px;
  }

  .toc-item.level-3 {
    padding-left: 32px;
    font-size: 12px;
  }

  .toc-item.level-4 {
    padding-left: 40px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .toc-item.level-5 {
    padding-left: 48px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .toc-item.level-6 {
    padding-left: 56px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .toc-marker {
    color: var(--text-muted);
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 10px;
    min-width: 20px;
    flex-shrink: 0;
  }

  .toc-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
