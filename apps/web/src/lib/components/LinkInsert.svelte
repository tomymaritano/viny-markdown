<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onInsert: (link: string) => void;
    onclose: () => void;
  }

  let { open, onInsert, onclose }: Props = $props();

  let url = $state('');
  let text = $state('');
  let urlInputRef: HTMLInputElement;

  // Focus input when opened
  $effect(() => {
    if (open && urlInputRef) {
      setTimeout(() => urlInputRef?.focus(), 50);
    }
  });

  // Reset when closing
  $effect(() => {
    if (!open) {
      url = '';
      text = '';
    }
  });

  function handleInsert() {
    if (!url.trim()) return;

    let link: string;
    if (text.trim()) {
      link = `[${text}](${url})`;
    } else {
      link = `<${url}>`;
    }

    onInsert(link);
    onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleInsert();
    }
  }
</script>

{#if open}
  <div class="link-insert-backdrop" onclick={onclose} onkeydown={handleKeydown} role="presentation">
    <div class="link-insert-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert Link">
      <header class="panel-header">
        <h3>Insert Link</h3>
        <button class="close-btn" onclick={onclose} title="Close"><X size={18} /></button>
      </header>

      <div class="panel-body">
        <div class="input-group">
          <label for="link-url">URL</label>
          <input
            bind:this={urlInputRef}
            id="link-url"
            type="url"
            class="text-input"
            placeholder="https://example.com"
            bind:value={url}
          />
        </div>

        <div class="input-group">
          <label for="link-text">Text (optional)</label>
          <input
            id="link-text"
            type="text"
            class="text-input"
            placeholder="Link text"
            bind:value={text}
          />
        </div>

        <div class="preview">
          <span class="preview-label">Preview:</span>
          <code class="preview-code">
            {#if text.trim()}
              [{text}]({url || 'url'})
            {:else if url.trim()}
              &lt;{url}&gt;
            {:else}
              [text](url)
            {/if}
          </code>
        </div>
      </div>

      <footer class="panel-footer">
        <button class="btn secondary" onclick={onclose}>Cancel</button>
        <button class="btn primary" onclick={handleInsert} disabled={!url.trim()}>Insert Link</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .link-insert-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .link-insert-panel {
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

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .text-input {
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
  }

  .text-input:focus {
    border-color: var(--accent-color);
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
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 13px;
    font-family: 'SF Mono', Consolas, monospace;
    color: var(--text-primary);
    word-break: break-all;
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

  .btn.primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .link-insert-backdrop {
      padding: 0;
    }

    .link-insert-panel {
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

    .text-input {
      font-size: 16px; /* Prevent iOS zoom */
    }
  }
</style>
