<script lang="ts">
  import { ChevronUp, ChevronDown, X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    content: string;
    onReplace: (newContent: string) => void;
    onclose: () => void;
  }

  let { open, content, onReplace, onclose }: Props = $props();

  let findQuery = $state('');
  let replaceQuery = $state('');
  let currentIndex = $state(0);
  let caseSensitive = $state(false);
  let findInputRef: HTMLInputElement;

  // Find all matches
  const matches = $derived(() => {
    if (!findQuery) return [];

    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, flags);

    const results: { start: number; end: number }[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      results.push({ start: match.index, end: match.index + match[0].length });
    }
    return results;
  });

  // Reset index when matches change
  $effect(() => {
    const m = matches();
    if (currentIndex >= m.length) {
      currentIndex = Math.max(0, m.length - 1);
    }
  });

  // Focus input when opened
  $effect(() => {
    if (open && findInputRef) {
      setTimeout(() => findInputRef?.focus(), 50);
    }
  });

  function goToNext() {
    const m = matches();
    if (m.length === 0) return;
    currentIndex = (currentIndex + 1) % m.length;
  }

  function goToPrev() {
    const m = matches();
    if (m.length === 0) return;
    currentIndex = currentIndex <= 0 ? m.length - 1 : currentIndex - 1;
  }

  function replaceCurrent() {
    const m = matches();
    if (m.length === 0 || !m[currentIndex]) return;

    const match = m[currentIndex];
    const newContent = content.slice(0, match.start) + replaceQuery + content.slice(match.end);
    onReplace(newContent);
  }

  function replaceAll() {
    if (!findQuery) return;

    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, flags);

    const newContent = content.replace(regex, replaceQuery);
    onReplace(newContent);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      goToNext();
    } else if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      goToPrev();
    }
  }
</script>

{#if open}
  <div class="find-replace-panel" onkeydown={handleKeydown}>
    <div class="find-row">
      <input
        bind:this={findInputRef}
        type="text"
        class="find-input"
        placeholder="Find..."
        bind:value={findQuery}
      />
      <span class="match-count">
        {#if matches().length > 0}
          {currentIndex + 1} / {matches().length}
        {:else if findQuery}
          No results
        {/if}
      </span>
      <button class="nav-btn" onclick={goToPrev} disabled={matches().length === 0} title="Previous (Shift+Enter)">
        <ChevronUp size={14} />
      </button>
      <button class="nav-btn" onclick={goToNext} disabled={matches().length === 0} title="Next (Enter)">
        <ChevronDown size={14} />
      </button>
      <button
        class="option-btn"
        class:active={caseSensitive}
        onclick={() => caseSensitive = !caseSensitive}
        title="Case sensitive"
      >
        Aa
      </button>
      <button class="close-btn" onclick={onclose} title="Close (Esc)">
        <X size={14} />
      </button>
    </div>
    <div class="replace-row">
      <input
        type="text"
        class="replace-input"
        placeholder="Replace..."
        bind:value={replaceQuery}
      />
      <button class="action-btn" onclick={replaceCurrent} disabled={matches().length === 0}>
        Replace
      </button>
      <button class="action-btn" onclick={replaceAll} disabled={matches().length === 0}>
        Replace All
      </button>
    </div>
  </div>
{/if}

<style>
  .find-replace-panel {
    position: absolute;
    top: 8px;
    right: 24px;
    z-index: 50;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 360px;
  }

  .find-row,
  .replace-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .find-input,
  .replace-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
  }

  .find-input:focus,
  .replace-input:focus {
    border-color: var(--accent-color);
  }

  .match-count {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 60px;
    text-align: center;
  }

  .nav-btn,
  .option-btn,
  .close-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .nav-btn:hover:not(:disabled),
  .option-btn:hover,
  .close-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .option-btn.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .close-btn {
    font-size: 18px;
  }

  .action-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .find-replace-panel {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      min-width: 100%;
      border-radius: 0;
      border-top: none;
      border-left: none;
      border-right: none;
    }

    .find-input,
    .replace-input {
      font-size: 16px; /* Prevent iOS zoom */
    }

    .match-count {
      min-width: 50px;
      font-size: 11px;
    }

    .action-btn {
      padding: 6px 8px;
      font-size: 11px;
    }
  }
</style>
