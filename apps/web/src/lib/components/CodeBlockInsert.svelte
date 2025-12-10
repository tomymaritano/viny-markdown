<script lang="ts">
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onInsert: (codeBlock: string) => void;
    onclose: () => void;
  }

  let { open, onInsert, onclose }: Props = $props();

  let selectedLanguage = $state('');
  let searchQuery = $state('');
  let inputRef: HTMLInputElement;

  const languages = [
    { id: '', name: 'Plain text', alias: [] },
    { id: 'javascript', name: 'JavaScript', alias: ['js'] },
    { id: 'typescript', name: 'TypeScript', alias: ['ts'] },
    { id: 'python', name: 'Python', alias: ['py'] },
    { id: 'rust', name: 'Rust', alias: ['rs'] },
    { id: 'go', name: 'Go', alias: ['golang'] },
    { id: 'java', name: 'Java', alias: [] },
    { id: 'c', name: 'C', alias: [] },
    { id: 'cpp', name: 'C++', alias: ['c++'] },
    { id: 'csharp', name: 'C#', alias: ['cs', 'c#'] },
    { id: 'php', name: 'PHP', alias: [] },
    { id: 'ruby', name: 'Ruby', alias: ['rb'] },
    { id: 'swift', name: 'Swift', alias: [] },
    { id: 'kotlin', name: 'Kotlin', alias: ['kt'] },
    { id: 'html', name: 'HTML', alias: [] },
    { id: 'css', name: 'CSS', alias: [] },
    { id: 'scss', name: 'SCSS', alias: ['sass'] },
    { id: 'json', name: 'JSON', alias: [] },
    { id: 'yaml', name: 'YAML', alias: ['yml'] },
    { id: 'xml', name: 'XML', alias: [] },
    { id: 'markdown', name: 'Markdown', alias: ['md'] },
    { id: 'sql', name: 'SQL', alias: [] },
    { id: 'bash', name: 'Bash', alias: ['sh', 'shell', 'zsh'] },
    { id: 'powershell', name: 'PowerShell', alias: ['ps1'] },
    { id: 'dockerfile', name: 'Dockerfile', alias: ['docker'] },
    { id: 'graphql', name: 'GraphQL', alias: ['gql'] },
    { id: 'svelte', name: 'Svelte', alias: [] },
    { id: 'vue', name: 'Vue', alias: [] },
    { id: 'jsx', name: 'JSX', alias: ['react'] },
    { id: 'tsx', name: 'TSX', alias: [] },
  ];

  const filteredLanguages = $derived(() => {
    if (!searchQuery.trim()) return languages;
    const query = searchQuery.toLowerCase();
    return languages.filter(lang =>
      lang.name.toLowerCase().includes(query) ||
      lang.id.toLowerCase().includes(query) ||
      lang.alias.some(a => a.toLowerCase().includes(query))
    );
  });

  // Focus input when opened
  $effect(() => {
    if (open && inputRef) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  function handleSelect(languageId: string) {
    selectedLanguage = languageId;
    insertCodeBlock();
  }

  function insertCodeBlock() {
    const codeBlock = '```' + selectedLanguage + '\n\n```';
    onInsert(codeBlock);
    onclose();
    // Reset state
    selectedLanguage = '';
    searchQuery = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const filtered = filteredLanguages();
      if (filtered.length > 0) {
        handleSelect(filtered[0].id);
      }
    }
  }
</script>

{#if open}
  <div class="code-block-backdrop" onclick={onclose} onkeydown={handleKeydown} role="presentation">
    <div class="code-block-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Insert Code Block">
      <header class="panel-header">
        <h3>Insert Code Block</h3>
        <button class="close-btn" onclick={onclose} title="Close"><X size={18} /></button>
      </header>

      <div class="panel-body">
        <input
          bind:this={inputRef}
          type="text"
          class="search-input"
          placeholder="Search languages..."
          bind:value={searchQuery}
        />

        <div class="languages-grid">
          {#each filteredLanguages() as lang (lang.id)}
            <button
              class="language-btn"
              class:selected={selectedLanguage === lang.id}
              onclick={() => handleSelect(lang.id)}
            >
              <span class="lang-name">{lang.name}</span>
              {#if lang.id}
                <span class="lang-id">{lang.id}</span>
              {/if}
            </button>
          {/each}
        </div>

        {#if filteredLanguages().length === 0}
          <p class="no-results">No languages found</p>
        {/if}
      </div>

      <footer class="panel-footer">
        <span class="hint">Press Enter to insert, Escape to close</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .code-block-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .code-block-panel {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 480px;
    max-height: 70vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    margin-bottom: 16px;
  }

  .search-input:focus {
    border-color: var(--accent-color);
  }

  .languages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .language-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .language-btn:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .language-btn.selected {
    border-color: var(--accent-color);
    background: var(--accent-color);
  }

  .language-btn.selected .lang-name,
  .language-btn.selected .lang-id {
    color: white;
  }

  .lang-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .lang-id {
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'SF Mono', Consolas, monospace;
  }

  .no-results {
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
    padding: 20px;
  }

  .panel-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    text-align: center;
  }

  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .code-block-backdrop {
      padding: 0;
    }

    .code-block-panel {
      max-width: 100%;
      max-height: 100%;
      height: 100%;
      border-radius: 0;
    }

    .search-input {
      font-size: 16px; /* Prevent iOS zoom */
    }

    .languages-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }

    .panel-footer {
      display: none;
    }
  }
</style>
