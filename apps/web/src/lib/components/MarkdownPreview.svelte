<script lang="ts">
  import { onMount } from 'svelte';
  import { Marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import hljs from 'highlight.js';
  import 'highlight.js/styles/github.css';
  import katex from 'katex';
  import 'katex/dist/katex.min.css';
  import { notesStore } from '$lib/stores/notes.svelte';

  interface Props {
    content: string;
    onWikiLink?: (title: string) => void;
  }

  let { content, onWikiLink }: Props = $props();

  // Link preview state
  let previewNote = $state<{ title: string; content: string } | null>(null);
  let previewPosition = $state({ x: 0, y: 0 });
  let previewTimeout: ReturnType<typeof setTimeout> | null = null;

  // Container ref for mermaid rendering
  let containerRef: HTMLDivElement;
  let mermaidModule: typeof import('mermaid') | null = null;

  // Load mermaid dynamically (it's heavy)
  onMount(async () => {
    try {
      mermaidModule = await import('mermaid');
      mermaidModule.default.initialize({
        startOnLoad: false,
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });
    } catch {
      console.warn('Failed to load mermaid');
    }
  });

  // Wiki link extension for [[note title]] syntax
  const wikiLinkExtension = {
    name: 'wikiLink',
    level: 'inline' as const,
    start(src: string) {
      return src.indexOf('[[');
    },
    tokenizer(src: string) {
      const match = /^\[\[([^\]]+)\]\]/.exec(src);
      if (match) {
        return {
          type: 'wikiLink',
          raw: match[0],
          title: match[1].trim(),
        };
      }
      return undefined;
    },
    renderer(token: { title: string }) {
      const encodedTitle = encodeURIComponent(token.title);
      return `<a href="#" class="wiki-link" data-wiki-link="${encodedTitle}">${token.title}</a>`;
    },
  };

  // Inline math extension $...$
  const inlineMathExtension = {
    name: 'inlineMath',
    level: 'inline' as const,
    start(src: string) {
      return src.indexOf('$');
    },
    tokenizer(src: string) {
      // Match $...$ but not $$...$$
      const match = /^\$([^\$\n]+?)\$(?!\$)/.exec(src);
      if (match) {
        return {
          type: 'inlineMath',
          raw: match[0],
          text: match[1],
        };
      }
      return undefined;
    },
    renderer(token: { text: string }) {
      try {
        return katex.renderToString(token.text, { throwOnError: false, displayMode: false });
      } catch {
        return `<code class="math-error">${token.text}</code>`;
      }
    },
  };

  // Block math extension $$...$$
  const blockMathExtension = {
    name: 'blockMath',
    level: 'block' as const,
    start(src: string) {
      return src.indexOf('$$');
    },
    tokenizer(src: string) {
      const match = /^\$\$\n?([\s\S]+?)\n?\$\$/.exec(src);
      if (match) {
        return {
          type: 'blockMath',
          raw: match[0],
          text: match[1].trim(),
        };
      }
      return undefined;
    },
    renderer(token: { text: string }) {
      try {
        return `<div class="math-block">${katex.renderToString(token.text, { throwOnError: false, displayMode: true })}</div>`;
      } catch {
        return `<pre class="math-error">${token.text}</pre>`;
      }
    },
  };

  // Create marked instance with highlight.js integration and wiki links
  const markedInstance = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code: string, lang: string) {
        // Handle mermaid code blocks
        if (lang === 'mermaid') {
          return `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent(code)}">${code}</div>`;
        }
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch {
            // Fall through to auto-detection
          }
        }
        // Auto-detect language if not specified or unknown
        try {
          return hljs.highlightAuto(code).value;
        } catch {
          return code;
        }
      },
    }),
    {
      breaks: true,
      gfm: true,
    }
  );

  // Add extensions
  markedInstance.use({ extensions: [wikiLinkExtension, inlineMathExtension, blockMathExtension] });

  const html = $derived(markedInstance.parse(content) as string);

  // Render mermaid diagrams after HTML updates
  $effect(() => {
    if (!containerRef || !mermaidModule) return;
    // Reference html to trigger on content change
    html;

    // Small delay to ensure DOM is updated
    setTimeout(async () => {
      const placeholders = containerRef.querySelectorAll('.mermaid-placeholder');
      for (const placeholder of placeholders) {
        const code = decodeURIComponent(placeholder.getAttribute('data-mermaid') || '');
        if (!code) continue;

        try {
          const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
          const { svg } = await mermaidModule!.default.render(id, code);
          placeholder.innerHTML = svg;
          placeholder.classList.remove('mermaid-placeholder');
          placeholder.classList.add('mermaid-diagram');
        } catch (e) {
          placeholder.innerHTML = `<pre class="mermaid-error">Diagram error: ${e}</pre>`;
        }
      }
    }, 10);
  });

  // Handle wiki link clicks
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      event.preventDefault();
      const title = decodeURIComponent(target.dataset.wikiLink || '');
      if (title && onWikiLink) {
        onWikiLink(title);
      }
    }
  }

  // Handle mouse enter for link preview
  function handleMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      const title = decodeURIComponent(target.dataset.wikiLink || '');
      if (!title) return;

      // Clear any existing timeout
      if (previewTimeout) clearTimeout(previewTimeout);

      // Delay showing preview to avoid flickering
      previewTimeout = setTimeout(() => {
        // Find the note by title
        const note = notesStore.allNotes.find(
          (n) => n.title.toLowerCase() === title.toLowerCase()
        );

        if (note) {
          const rect = target.getBoundingClientRect();
          previewPosition = {
            x: rect.left,
            y: rect.bottom + 8,
          };
          previewNote = {
            title: note.title,
            content: note.content,
          };
        } else {
          // Note doesn't exist yet
          const rect = target.getBoundingClientRect();
          previewPosition = {
            x: rect.left,
            y: rect.bottom + 8,
          };
          previewNote = {
            title: title,
            content: '(Note does not exist yet - click to create)',
          };
        }
      }, 300);
    }
  }

  // Handle mouse leave to hide preview
  function handleMouseOut(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
      }
      previewNote = null;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  class="markdown-preview"
  bind:this={containerRef}
  onclick={handleClick}
  onmouseover={handleMouseOver}
  onmouseout={handleMouseOut}
>
  {@html html}
</div>

<!-- Link Preview Popover -->
{#if previewNote}
  <div
    class="link-preview"
    style="left: {previewPosition.x}px; top: {previewPosition.y}px;"
  >
    <div class="preview-title">{previewNote.title}</div>
    <div class="preview-content">
      {previewNote.content.slice(0, 200)}{previewNote.content.length > 200 ? '...' : ''}
    </div>
  </div>
{/if}

<style>
  .markdown-preview {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    line-height: 1.7;
    color: var(--text-primary);
  }

  /* Headings */
  .markdown-preview :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0 0 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-color);
  }

  .markdown-preview :global(h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 1.5em 0 0.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--border-light);
  }

  .markdown-preview :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 1.5em 0 0.5em;
  }

  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    font-size: 1em;
    font-weight: 600;
    margin: 1.5em 0 0.5em;
  }

  /* Paragraphs */
  .markdown-preview :global(p) {
    margin: 0 0 1em;
  }

  /* Links */
  .markdown-preview :global(a) {
    color: var(--accent-color);
    text-decoration: none;
  }

  .markdown-preview :global(a:hover) {
    text-decoration: underline;
  }

  /* Lists */
  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    margin: 0 0 1em;
    padding-left: 2em;
  }

  .markdown-preview :global(li) {
    margin: 0.25em 0;
  }

  .markdown-preview :global(li > ul),
  .markdown-preview :global(li > ol) {
    margin: 0.25em 0;
  }

  /* Code */
  .markdown-preview :global(code) {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
    padding: 0.2em 0.4em;
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .markdown-preview :global(pre) {
    margin: 0 0 1em;
    padding: 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    overflow-x: auto;
  }

  .markdown-preview :global(pre code) {
    padding: 0;
    background: transparent;
  }

  /* Blockquotes */
  .markdown-preview :global(blockquote) {
    margin: 0 0 1em;
    padding: 0.5em 1em;
    border-left: 4px solid var(--accent-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .markdown-preview :global(blockquote p:last-child) {
    margin-bottom: 0;
  }

  /* Horizontal rule */
  .markdown-preview :global(hr) {
    margin: 2em 0;
    border: none;
    border-top: 1px solid var(--border-color);
  }

  /* Tables */
  .markdown-preview :global(table) {
    width: 100%;
    margin: 0 0 1em;
    border-collapse: collapse;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    text-align: left;
  }

  .markdown-preview :global(th) {
    background: var(--bg-secondary);
    font-weight: 600;
  }

  .markdown-preview :global(tr:nth-child(even)) {
    background: var(--bg-secondary);
  }

  /* Images */
  .markdown-preview :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }

  /* Task lists */
  .markdown-preview :global(input[type="checkbox"]) {
    margin-right: 0.5em;
  }

  /* Strong and emphasis */
  .markdown-preview :global(strong) {
    font-weight: 600;
  }

  .markdown-preview :global(em) {
    font-style: italic;
  }

  /* Wiki links */
  .markdown-preview :global(.wiki-link) {
    color: var(--accent-color);
    text-decoration: none;
    background: rgba(0, 122, 255, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .markdown-preview :global(.wiki-link:hover) {
    background: rgba(0, 122, 255, 0.2);
    text-decoration: underline;
  }

  :global([data-theme='dark']) .markdown-preview :global(.wiki-link) {
    background: rgba(74, 158, 255, 0.15);
  }

  :global([data-theme='dark']) .markdown-preview :global(.wiki-link:hover) {
    background: rgba(74, 158, 255, 0.25);
  }

  /* Math blocks (KaTeX) */
  .markdown-preview :global(.math-block) {
    margin: 1em 0;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow-x: auto;
    text-align: center;
  }

  .markdown-preview :global(.math-error) {
    color: #e74c3c;
    background: rgba(231, 76, 60, 0.1);
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }

  /* KaTeX overrides for dark theme */
  :global([data-theme='dark']) .markdown-preview :global(.katex) {
    color: var(--text-primary);
  }

  /* Mermaid diagrams */
  .markdown-preview :global(.mermaid-placeholder) {
    margin: 1em 0;
    padding: 16px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    color: var(--text-secondary);
    white-space: pre-wrap;
  }

  .markdown-preview :global(.mermaid-diagram) {
    margin: 1em 0;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    text-align: center;
    overflow-x: auto;
  }

  .markdown-preview :global(.mermaid-diagram svg) {
    max-width: 100%;
    height: auto;
  }

  .markdown-preview :global(.mermaid-error) {
    color: #e74c3c;
    background: rgba(231, 76, 60, 0.1);
    padding: 12px;
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    white-space: pre-wrap;
  }

  /* Dark mode syntax highlighting overrides */
  :global([data-theme='dark']) .markdown-preview :global(.hljs) {
    background: #1e1e1e;
    color: #d4d4d4;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-keyword),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-selector-tag),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-literal),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-section) {
    color: #569cd6;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-string),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-title),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-name),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-type) {
    color: #ce9178;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-comment),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-quote) {
    color: #6a9955;
    font-style: italic;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-number),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-symbol),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-bullet) {
    color: #b5cea8;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-variable),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-template-variable),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-attr) {
    color: #9cdcfe;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-function),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-title.function_) {
    color: #dcdcaa;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-built_in),
  :global([data-theme='dark']) .markdown-preview :global(.hljs-class) {
    color: #4ec9b0;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-meta) {
    color: #c586c0;
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-addition) {
    color: #b5cea8;
    background-color: rgba(155, 185, 85, 0.2);
  }

  :global([data-theme='dark']) .markdown-preview :global(.hljs-deletion) {
    color: #ce9178;
    background-color: rgba(255, 0, 0, 0.2);
  }

  /* Link Preview Popover */
  .link-preview {
    position: fixed;
    z-index: 9999;
    max-width: 320px;
    padding: 12px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .preview-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-content {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
  }

  :global([data-theme='dark']) .link-preview {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
</style>
