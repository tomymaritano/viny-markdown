<script lang="ts">
  import { parseMarkdown } from '$lib/markdown';
  import { toast } from '$lib/toast';
  import { X, FileText, FileType, Code, Braces, FileCode } from '@lucide/svelte';

  interface Note {
    id: string;
    title: string;
    content: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
  }

  let {
    open = $bindable(false),
    note = null,
  } = $props<{
    open?: boolean;
    note?: Note | null;
  }>();

  type ExportFormat = 'md' | 'txt' | 'html' | 'json' | 'rtf';

  let selectedFormat = $state<ExportFormat>('md');
  let includeMetadata = $state(true);
  let includeTitle = $state(true);
  let includeTags = $state(true);
  let includeTimestamps = $state(false);
  let wrapText = $state(80); // 0 = no wrap
  let isExporting = $state(false);

  const formats: { id: ExportFormat; name: string; description: string }[] = [
    { id: 'md', name: 'Markdown', description: 'Original format with full formatting' },
    { id: 'txt', name: 'Plain Text', description: 'Simple text without formatting' },
    { id: 'html', name: 'HTML', description: 'Web page with styling' },
    { id: 'json', name: 'JSON', description: 'Structured data format' },
    { id: 'rtf', name: 'Rich Text', description: 'Compatible with Word processors' },
  ];

  const formatIcons: Record<ExportFormat, typeof FileText> = {
    md: FileText,
    txt: FileType,
    html: Code,
    json: Braces,
    rtf: FileCode,
  };

  function getFileExtension(format: ExportFormat): string {
    return format;
  }

  function wrapLines(text: string, width: number): string {
    if (width <= 0) return text;

    const lines = text.split('\n');
    const wrapped: string[] = [];

    for (const line of lines) {
      if (line.length <= width) {
        wrapped.push(line);
        continue;
      }

      let remaining = line;
      while (remaining.length > width) {
        let breakPoint = remaining.lastIndexOf(' ', width);
        if (breakPoint === -1) breakPoint = width;

        wrapped.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint).trimStart();
      }
      if (remaining) wrapped.push(remaining);
    }

    return wrapped.join('\n');
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s?/g, '') // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/__(.+?)__/g, '$1') // Bold alt
      .replace(/_(.+?)_/g, '$1') // Italic alt
      .replace(/~~(.+?)~~/g, '$1') // Strikethrough
      .replace(/`{1,3}[^`]*`{1,3}/g, (match) => match.replace(/`/g, '')) // Code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
      .replace(/^[-*+]\s/gm, '• ') // Unordered lists
      .replace(/^\d+\.\s/gm, '') // Ordered lists
      .replace(/^>\s?/gm, '') // Blockquotes
      .replace(/^-{3,}$/gm, '---') // Horizontal rules
      .replace(/\|/g, ' '); // Tables
  }

  function generateContent(format: ExportFormat): string {
    if (!note) return '';

    const title = note.title || 'Untitled';
    const content = note.content;
    const tags = note.tags || [];
    const createdAt = note.created_at ? new Date(note.created_at).toLocaleString() : '';
    const updatedAt = note.updated_at ? new Date(note.updated_at).toLocaleString() : '';

    switch (format) {
      case 'md': {
        let result = '';
        if (includeTitle) result += `# ${title}\n\n`;
        if (includeTags && tags.length > 0) {
          result += `Tags: ${tags.map(t => `#${t}`).join(' ')}\n\n`;
        }
        if (includeTimestamps) {
          if (createdAt) result += `Created: ${createdAt}\n`;
          if (updatedAt) result += `Updated: ${updatedAt}\n`;
          result += '\n';
        }
        result += content;
        return result;
      }

      case 'txt': {
        let result = '';
        if (includeTitle) result += `${title}\n${'='.repeat(title.length)}\n\n`;
        if (includeTags && tags.length > 0) {
          result += `Tags: ${tags.join(', ')}\n\n`;
        }
        if (includeTimestamps) {
          if (createdAt) result += `Created: ${createdAt}\n`;
          if (updatedAt) result += `Updated: ${updatedAt}\n`;
          result += '\n';
        }
        result += stripMarkdown(content);
        return wrapText > 0 ? wrapLines(result, wrapText) : result;
      }

      case 'html': {
        const htmlContent = parseMarkdown(content);
        let tagsHtml = '';
        if (includeTags && tags.length > 0) {
          tagsHtml = `<div class="tags">${tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</div>`;
        }
        let timestampsHtml = '';
        if (includeTimestamps) {
          timestampsHtml = `<div class="timestamps">`;
          if (createdAt) timestampsHtml += `<span>Created: ${createdAt}</span>`;
          if (updatedAt) timestampsHtml += `<span>Updated: ${updatedAt}</span>`;
          timestampsHtml += `</div>`;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root { --text: #1a1a1a; --bg: #fff; --accent: #3b82f6; --border: #e5e7eb; --muted: #6b7280; }
    @media (prefers-color-scheme: dark) {
      :root { --text: #f3f4f6; --bg: #111827; --accent: #60a5fa; --border: #374151; --muted: #9ca3af; }
    }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.7; color: var(--text); background: var(--bg); }
    h1 { font-size: 2.25em; margin-bottom: 0.5em; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; }
    h2 { font-size: 1.75em; margin-top: 1.5em; }
    h3 { font-size: 1.4em; margin-top: 1.3em; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: rgba(127,127,127,0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: rgba(127,127,127,0.1); padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid var(--accent); margin: 1em 0; padding: 0.5em 1em; background: rgba(127,127,127,0.05); }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border); padding: 10px 14px; text-align: left; }
    th { background: rgba(127,127,127,0.1); font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    .tags { margin: 1em 0; }
    .tag { display: inline-block; background: var(--accent); color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.85em; margin-right: 6px; }
    .timestamps { font-size: 0.85em; color: var(--muted); margin-bottom: 2em; }
    .timestamps span { margin-right: 1.5em; }
    footer { margin-top: 3em; padding-top: 1.5em; border-top: 1px solid var(--border); font-size: 0.85em; color: var(--muted); }
  </style>
</head>
<body>
  ${includeTitle ? `<h1>${title}</h1>` : ''}
  ${tagsHtml}
  ${timestampsHtml}
  <article>${htmlContent}</article>
  <footer>Exported from Viny on ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;
      }

      case 'json': {
        const data: Record<string, unknown> = {
          title,
          content,
        };
        if (includeTags && tags.length > 0) data.tags = tags;
        if (includeTimestamps) {
          if (createdAt) data.created_at = note.created_at;
          if (updatedAt) data.updated_at = note.updated_at;
        }
        if (includeMetadata) {
          data.exported_at = new Date().toISOString();
          data.word_count = content.split(/\s+/).filter(w => w).length;
          data.character_count = content.length;
        }
        return JSON.stringify(data, null, 2);
      }

      case 'rtf': {
        // Basic RTF format
        const rtfEscape = (text: string) => text
          .replace(/\\/g, '\\\\')
          .replace(/\{/g, '\\{')
          .replace(/\}/g, '\\}')
          .replace(/\n/g, '\\par\n');

        let rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}{\\f1 Courier New;}}
{\\colortbl;\\red0\\green0\\blue0;\\red59\\green130\\blue246;}
\\f0\\fs24\n`;

        if (includeTitle) {
          rtfContent += `{\\b\\fs36 ${rtfEscape(title)}}\\par\\par\n`;
        }
        if (includeTags && tags.length > 0) {
          rtfContent += `{\\i Tags: ${tags.join(', ')}}\\par\\par\n`;
        }
        if (includeTimestamps) {
          if (createdAt) rtfContent += `{\\fs20 Created: ${createdAt}}\\par\n`;
          if (updatedAt) rtfContent += `{\\fs20 Updated: ${updatedAt}}\\par\n`;
          rtfContent += '\\par\n';
        }

        // Convert basic markdown to RTF
        let processedContent = content
          .replace(/^### (.+)$/gm, '{\\b\\fs28 $1}\\par')
          .replace(/^## (.+)$/gm, '{\\b\\fs32 $1}\\par')
          .replace(/^# (.+)$/gm, '{\\b\\fs36 $1}\\par')
          .replace(/\*\*(.+?)\*\*/g, '{\\b $1}')
          .replace(/\*(.+?)\*/g, '{\\i $1}')
          .replace(/`(.+?)`/g, '{\\f1 $1}')
          .replace(/^- (.+)$/gm, '\\bullet  $1\\par')
          .replace(/^\d+\. (.+)$/gm, '$1\\par');

        rtfContent += rtfEscape(processedContent);
        rtfContent += '\n}';

        return rtfContent;
      }

      default:
        return content;
    }
  }

  async function handleExport() {
    if (!note) return;

    isExporting = true;

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filename = (note.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ext = getFileExtension(selectedFormat);

      const path = await save({
        filters: [
          { name: formats.find(f => f.id === selectedFormat)?.name || 'File', extensions: [ext] },
        ],
        defaultPath: `${filename}.${ext}`,
      });

      if (path) {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const content = generateContent(selectedFormat);
        await writeTextFile(path, content);
        toast.success(`Exported as ${formats.find(f => f.id === selectedFormat)?.name}`);
        close();
      }
    } catch (err) {
      toast.error('Failed to export');
      console.error(err);
    } finally {
      isExporting = false;
    }
  }

  function copyToClipboard() {
    if (!note) return;

    const content = generateContent(selectedFormat);
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }

  function close() {
    open = false;
  }

  const previewContent = $derived(() => {
    const content = generateContent(selectedFormat);
    return content.slice(0, 500) + (content.length > 500 ? '...' : '');
  });
</script>

{#if open && note}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-title"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="export-title">Export Note</h2>
        <button class="close-btn" onclick={close} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-content">
        <!-- Format Selection -->
        <section class="format-section">
          <h3>Format</h3>
          <div class="format-grid">
            {#each formats as format}
              <button
                class="format-card"
                class:selected={selectedFormat === format.id}
                onclick={() => selectedFormat = format.id}
              >
                <span class="format-icon"><svelte:component this={formatIcons[format.id]} size={20} /></span>
                <span class="format-name">{format.name}</span>
                <span class="format-ext">.{format.id}</span>
              </button>
            {/each}
          </div>
        </section>

        <!-- Options -->
        <section class="options-section">
          <h3>Options</h3>
          <div class="options-grid">
            <label class="option-item">
              <input type="checkbox" bind:checked={includeTitle} />
              <span>Include title</span>
            </label>
            <label class="option-item">
              <input type="checkbox" bind:checked={includeTags} />
              <span>Include tags</span>
            </label>
            <label class="option-item">
              <input type="checkbox" bind:checked={includeTimestamps} />
              <span>Include timestamps</span>
            </label>
            {#if selectedFormat === 'json'}
              <label class="option-item">
                <input type="checkbox" bind:checked={includeMetadata} />
                <span>Include metadata</span>
              </label>
            {/if}
            {#if selectedFormat === 'txt'}
              <div class="option-item wrap-option">
                <span>Line wrap at</span>
                <input
                  type="number"
                  min="0"
                  max="200"
                  bind:value={wrapText}
                />
                <span class="wrap-hint">{wrapText === 0 ? 'disabled' : 'chars'}</span>
              </div>
            {/if}
          </div>
        </section>

        <!-- Preview -->
        <section class="preview-section">
          <h3>Preview</h3>
          <pre class="preview-content">{previewContent()}</pre>
        </section>
      </div>

      <footer class="modal-footer">
        <button class="copy-btn" onclick={copyToClipboard}>
          Copy to Clipboard
        </button>
        <button class="export-btn" onclick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Export File'}
        </button>
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
    padding: 24px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
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

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  section {
    margin-bottom: 24px;
  }

  section:last-child {
    margin-bottom: 0;
  }

  section h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 0 0 12px;
    letter-spacing: 0.5px;
  }

  /* Format Selection */
  .format-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .format-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--bg-secondary);
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .format-card:hover {
    background: var(--bg-hover);
  }

  .format-card.selected {
    border-color: var(--accent);
    background: rgba(59, 130, 246, 0.1);
  }

  .format-icon {
    font-size: 20px;
  }

  .format-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .format-ext {
    font-size: 10px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
  }

  /* Options */
  .options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .option-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .wrap-option {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wrap-option input[type="number"] {
    width: 60px;
    padding: 4px 8px;
    font-size: 13px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    text-align: center;
  }

  .wrap-hint {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  /* Preview */
  .preview-content {
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 150px;
    overflow-y: auto;
    margin: 0;
    color: var(--text-secondary);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .copy-btn {
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .copy-btn:hover {
    background: var(--bg-hover);
  }

  .export-btn {
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
