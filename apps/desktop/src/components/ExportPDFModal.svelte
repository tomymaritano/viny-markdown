<script lang="ts">
  import { parseMarkdown, getWordCount, getReadingTime } from '$lib/markdown';
  import { toast } from '$lib/toast';
  import { X, FileDown, Loader2 } from '@lucide/svelte';
  import jsPDF from 'jspdf';
  import html2canvas from 'html2canvas';

  interface Note {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    tags?: string[];
  }

  let { open = $bindable(false), note = null as Note | null } = $props();

  // Export options
  let paperSize = $state<'a4' | 'letter' | 'legal'>('a4');
  let orientation = $state<'portrait' | 'landscape'>('portrait');
  let fontSize = $state<'small' | 'medium' | 'large'>('medium');
  let includeTitle = $state(true);
  let includeMeta = $state(true);
  let includeTOC = $state(false);
  let headerText = $state('');
  let footerText = $state('');
  let theme = $state<'light' | 'dark' | 'sepia'>('light');
  let isExporting = $state(false);
  let exportMethod = $state<'native' | 'print'>('native');

  const paperSizes = {
    a4: { width: '210mm', height: '297mm', margin: '20mm' },
    letter: { width: '8.5in', height: '11in', margin: '0.75in' },
    legal: { width: '8.5in', height: '14in', margin: '0.75in' },
  };

  const fontSizes = {
    small: { body: '10pt', h1: '20pt', h2: '16pt', h3: '13pt' },
    medium: { body: '12pt', h1: '24pt', h2: '18pt', h3: '14pt' },
    large: { body: '14pt', h1: '28pt', h2: '22pt', h3: '17pt' },
  };

  const themes = {
    light: { bg: '#ffffff', text: '#1a1a1a', accent: '#0066cc', codeBg: '#f5f5f5', border: '#e0e0e0' },
    dark: { bg: '#1a1a1a', text: '#e0e0e0', accent: '#66b3ff', codeBg: '#2d2d2d', border: '#404040' },
    sepia: { bg: '#f4ecd8', text: '#5c4b37', accent: '#8b6914', codeBg: '#e8dcc8', border: '#d4c4a8' },
  };

  function close() {
    open = false;
  }

  function extractHeadingsForTOC(content: string): { level: number; text: string }[] {
    const headings: { level: number; text: string }[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        headings.push({ level: match[1].length, text: match[2] });
      }
    }
    return headings;
  }

  function generateTOC(headings: { level: number; text: string }[]): string {
    if (headings.length === 0) return '';

    let toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
    for (const h of headings) {
      const indent = (h.level - 1) * 16;
      toc += `<li style="margin-left: ${indent}px">${h.text}</li>`;
    }
    toc += '</ul></div>';
    return toc;
  }

  // Paper dimensions in mm for jsPDF
  const paperDimensionsMM = {
    a4: { width: 210, height: 297 },
    letter: { width: 215.9, height: 279.4 },
    legal: { width: 215.9, height: 355.6 },
  };

  async function exportPDF() {
    if (!note) return;

    if (exportMethod === 'native') {
      await exportNativePDF();
    } else {
      exportPrintPDF();
    }
  }

  async function exportNativePDF() {
    if (!note) return;

    isExporting = true;
    toast.info('Generating PDF...');

    try {
      const fonts = fontSizes[fontSize];
      const colors = themes[theme];
      const htmlContent = parseMarkdown(note.content);
      const wordCount = getWordCount(note.content);
      const readingTime = getReadingTime(note.content);
      const headings = extractHeadingsForTOC(note.content);
      const tocHtml = includeTOC ? generateTOC(headings) : '';

      // Create a hidden container for rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = orientation === 'portrait'
        ? `${paperDimensionsMM[paperSize].width * 3.78}px`  // Convert mm to px (96dpi / 25.4)
        : `${paperDimensionsMM[paperSize].height * 3.78}px`;
      container.style.padding = '40px';
      container.style.background = colors.bg;
      container.style.fontFamily = 'Georgia, "Times New Roman", serif';
      container.style.fontSize = fonts.body;
      container.style.lineHeight = '1.8';
      container.style.color = colors.text;

      // Build HTML content
      let html = '';

      if (headerText) {
        html += `<div style="font-size: 10pt; color: ${colors.text}88; border-bottom: 1px solid ${colors.border}; padding-bottom: 8px; margin-bottom: 20px;">${headerText}</div>`;
      }

      if (includeTitle) {
        html += `<h1 style="font-size: ${fonts.h1}; font-weight: 700; margin: 0 0 0.5em; border-bottom: 3px solid ${colors.accent}; padding-bottom: 0.3em;">${note.title || 'Untitled'}</h1>`;
      }

      if (includeMeta) {
        html += `<div style="font-size: 10pt; color: ${colors.text}99; margin-bottom: 2em; padding-bottom: 1em; border-bottom: 1px solid ${colors.border};">`;
        html += `<span style="margin-right: 1.5em;">${new Date(note.updated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>`;
        html += `<span style="margin-right: 1.5em;">${wordCount} words</span>`;
        html += `<span>${readingTime} min read</span>`;
        if (note.tags && note.tags.length > 0) {
          html += `<div style="margin-top: 0.5em;">${note.tags.map(t => `<span style="display: inline-block; background: ${colors.accent}22; color: ${colors.accent}; padding: 2px 8px; border-radius: 12px; font-size: 9pt; margin-right: 6px;">#${t}</span>`).join('')}</div>`;
        }
        html += '</div>';
      }

      if (tocHtml) {
        html += `<div style="background: ${colors.codeBg}; padding: 1em 1.5em; border-radius: 8px; margin-bottom: 2em;">${tocHtml}</div>`;
      }

      // Add the main content with styled markdown
      html += `<div class="markdown-content" style="
        --code-bg: ${colors.codeBg};
        --accent: ${colors.accent};
        --border: ${colors.border};
        --text: ${colors.text};
      ">${htmlContent}</div>`;

      if (footerText) {
        html += `<div style="font-size: 10pt; color: ${colors.text}88; border-top: 1px solid ${colors.border}; padding-top: 8px; margin-top: 20px;">${footerText}</div>`;
      }

      container.innerHTML = `
        <style>
          .markdown-content h1 { font-size: ${fonts.h1}; margin-top: 1.5em; margin-bottom: 0.5em; }
          .markdown-content h2 { font-size: ${fonts.h2}; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid ${colors.border}; padding-bottom: 0.2em; }
          .markdown-content h3 { font-size: ${fonts.h3}; margin-top: 1.2em; margin-bottom: 0.5em; }
          .markdown-content p { margin: 1em 0; text-align: justify; }
          .markdown-content code { background: ${colors.codeBg}; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; font-family: monospace; color: ${colors.accent}; }
          .markdown-content pre { background: ${colors.codeBg}; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 0.85em; border-left: 4px solid ${colors.accent}; }
          .markdown-content pre code { background: none; padding: 0; color: ${colors.text}; }
          .markdown-content blockquote { border-left: 4px solid ${colors.accent}; margin: 1.5em 0; padding: 0.5em 0 0.5em 1.5em; color: ${colors.text}cc; font-style: italic; background: ${colors.codeBg}66; border-radius: 0 6px 6px 0; }
          .markdown-content table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
          .markdown-content th, .markdown-content td { border: 1px solid ${colors.border}; padding: 10px 14px; text-align: left; }
          .markdown-content th { background: ${colors.codeBg}; font-weight: 600; }
          .markdown-content ul, .markdown-content ol { margin: 1em 0; padding-left: 2em; }
          .markdown-content li { margin: 0.5em 0; }
          .markdown-content a { color: ${colors.accent}; text-decoration: none; }
          .markdown-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 1em 0; }
          .markdown-content hr { border: none; border-top: 2px solid ${colors.border}; margin: 2em 0; }
        </style>
        ${html}
      `;

      document.body.appendChild(container);

      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Render to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: colors.bg,
      });

      document.body.removeChild(container);

      // Create PDF
      const dims = paperDimensionsMM[paperSize];
      const pdfWidth = orientation === 'portrait' ? dims.width : dims.height;
      const pdfHeight = orientation === 'portrait' ? dims.height : dims.width;

      const pdf = new jsPDF({
        orientation: orientation === 'portrait' ? 'p' : 'l',
        unit: 'mm',
        format: paperSize,
      });

      const imgWidth = pdfWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Handle multi-page content
      const pageHeight = pdfHeight - 20; // 10mm margin top and bottom
      let heightLeft = imgHeight;
      let position = 10; // Start 10mm from top

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save the PDF using Tauri dialog
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const fileName = `${(note.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (filePath) {
        const pdfBlob = pdf.output('arraybuffer');
        await writeFile(filePath, new Uint8Array(pdfBlob));
        toast.success(`PDF saved to ${filePath}`);
        close();
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF. Try using Print mode instead.');
    } finally {
      isExporting = false;
    }
  }

  function exportPrintPDF() {
    if (!note) return;

    const paper = paperSizes[paperSize];
    const fonts = fontSizes[fontSize];
    const colors = themes[theme];
    const htmlContent = parseMarkdown(note.content);
    const wordCount = getWordCount(note.content);
    const readingTime = getReadingTime(note.content);

    const headings = extractHeadingsForTOC(note.content);
    const tocHtml = includeTOC ? generateTOC(headings) : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to export PDF');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${note.title || 'Untitled'}</title>
        <style>
          @page {
            size: ${paper.width} ${paper.height} ${orientation};
            margin: ${paper.margin};
          }

          * {
            box-sizing: border-box;
          }

          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            max-width: 100%;
            margin: 0;
            padding: 0;
            line-height: 1.8;
            color: ${colors.text};
            background: ${colors.bg};
            font-size: ${fonts.body};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Header and Footer */
          .header, .footer {
            position: fixed;
            left: 0;
            right: 0;
            font-size: 9pt;
            color: ${colors.text}88;
            padding: 0 ${paper.margin};
          }

          .header {
            top: 5mm;
            border-bottom: 1px solid ${colors.border};
            padding-bottom: 3mm;
          }

          .footer {
            bottom: 5mm;
            border-top: 1px solid ${colors.border};
            padding-top: 3mm;
            display: flex;
            justify-content: space-between;
          }

          .content {
            padding-top: ${headerText ? '15mm' : '0'};
            padding-bottom: ${footerText ? '15mm' : '0'};
          }

          /* Title */
          .doc-title {
            font-size: ${fonts.h1};
            font-weight: 700;
            margin: 0 0 0.5em;
            color: ${colors.text};
            border-bottom: 3px solid ${colors.accent};
            padding-bottom: 0.3em;
            line-height: 1.2;
          }

          /* Meta info */
          .meta {
            font-size: 10pt;
            color: ${colors.text}99;
            margin-bottom: 2em;
            padding-bottom: 1em;
            border-bottom: 1px solid ${colors.border};
          }

          .meta-item {
            display: inline-block;
            margin-right: 1.5em;
          }

          /* Table of Contents */
          .toc {
            background: ${colors.codeBg};
            padding: 1em 1.5em;
            border-radius: 8px;
            margin-bottom: 2em;
            page-break-after: always;
          }

          .toc h2 {
            font-size: ${fonts.h3};
            margin: 0 0 0.5em;
            color: ${colors.accent};
          }

          .toc ul {
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .toc li {
            padding: 4px 0;
            border-bottom: 1px dotted ${colors.border};
          }

          /* Typography */
          h1 {
            font-size: ${fonts.h1};
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: ${colors.text};
            page-break-after: avoid;
          }

          h2 {
            font-size: ${fonts.h2};
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: ${colors.text};
            border-bottom: 1px solid ${colors.border};
            padding-bottom: 0.2em;
            page-break-after: avoid;
          }

          h3 {
            font-size: ${fonts.h3};
            margin-top: 1.2em;
            margin-bottom: 0.5em;
            color: ${colors.text};
            page-break-after: avoid;
          }

          p {
            margin: 1em 0;
            text-align: justify;
            orphans: 3;
            widows: 3;
          }

          /* Code */
          code {
            background: ${colors.codeBg};
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            color: ${colors.accent};
          }

          pre {
            background: ${colors.codeBg};
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85em;
            border-left: 4px solid ${colors.accent};
            page-break-inside: avoid;
          }

          pre code {
            background: none;
            padding: 0;
            color: ${colors.text};
          }

          /* Blockquote */
          blockquote {
            border-left: 4px solid ${colors.accent};
            margin: 1.5em 0;
            padding: 0.5em 0 0.5em 1.5em;
            color: ${colors.text}cc;
            font-style: italic;
            background: ${colors.codeBg}66;
            border-radius: 0 6px 6px 0;
          }

          /* Tables */
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5em 0;
            font-size: 0.95em;
            page-break-inside: avoid;
          }

          th, td {
            border: 1px solid ${colors.border};
            padding: 10px 14px;
            text-align: left;
          }

          th {
            background: ${colors.codeBg};
            font-weight: 600;
            color: ${colors.text};
          }

          tr:nth-child(even) {
            background: ${colors.codeBg}44;
          }

          /* Lists */
          ul, ol {
            margin: 1em 0;
            padding-left: 2em;
          }

          li {
            margin: 0.5em 0;
          }

          li > ul, li > ol {
            margin: 0.25em 0;
          }

          /* Tasks */
          .task {
            list-style: none;
            margin-left: -1.5em;
          }

          .task input {
            margin-right: 8px;
            accent-color: ${colors.accent};
          }

          /* Links */
          a {
            color: ${colors.accent};
            text-decoration: none;
          }

          /* Images */
          img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 1em 0;
          }

          /* Horizontal rule */
          hr {
            border: none;
            border-top: 2px solid ${colors.border};
            margin: 2em 0;
          }

          /* Tags */
          .tags {
            margin-top: 1em;
          }

          .tag {
            display: inline-block;
            background: ${colors.accent}22;
            color: ${colors.accent};
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9pt;
            margin-right: 6px;
          }

          /* Syntax highlighting */
          .hl-keyword { color: #d73a49; font-weight: 600; }
          .hl-string { color: #032f62; }
          .hl-number { color: #005cc5; }
          .hl-comment { color: #6a737d; font-style: italic; }
          .hl-function { color: #6f42c1; }

          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        ${headerText ? `<div class="header">${headerText}</div>` : ''}
        ${footerText ? `<div class="footer"><span>${footerText}</span><span class="page-number"></span></div>` : ''}

        <div class="content">
          ${includeTitle ? `<h1 class="doc-title">${note.title || 'Untitled'}</h1>` : ''}

          ${includeMeta ? `
            <div class="meta">
              <span class="meta-item">${new Date(note.updated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span class="meta-item">${wordCount} words</span>
              <span class="meta-item">${readingTime} min read</span>
              ${note.tags && note.tags.length > 0 ? `
                <div class="tags">
                  ${note.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${tocHtml}

          ${htmlContent}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);

    toast.success('Opening print dialog...');
    close();
  }
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="export-title">Export to PDF</h2>
        <button class="close-btn" onclick={close} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-content">
        <div class="preview-note">
          <span class="preview-title">{note.title || 'Untitled'}</span>
          <span class="preview-meta">{getWordCount(note.content)} words</span>
        </div>

        <div class="options-grid">
          <div class="option-group">
            <label class="option-label">Paper Size</label>
            <div class="option-buttons">
              <button
                class="option-btn"
                class:active={paperSize === 'a4'}
                onclick={() => paperSize = 'a4'}
              >A4</button>
              <button
                class="option-btn"
                class:active={paperSize === 'letter'}
                onclick={() => paperSize = 'letter'}
              >Letter</button>
              <button
                class="option-btn"
                class:active={paperSize === 'legal'}
                onclick={() => paperSize = 'legal'}
              >Legal</button>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">Orientation</label>
            <div class="option-buttons">
              <button
                class="option-btn"
                class:active={orientation === 'portrait'}
                onclick={() => orientation = 'portrait'}
              >Portrait</button>
              <button
                class="option-btn"
                class:active={orientation === 'landscape'}
                onclick={() => orientation = 'landscape'}
              >Landscape</button>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">Font Size</label>
            <div class="option-buttons">
              <button
                class="option-btn"
                class:active={fontSize === 'small'}
                onclick={() => fontSize = 'small'}
              >Small</button>
              <button
                class="option-btn"
                class:active={fontSize === 'medium'}
                onclick={() => fontSize = 'medium'}
              >Medium</button>
              <button
                class="option-btn"
                class:active={fontSize === 'large'}
                onclick={() => fontSize = 'large'}
              >Large</button>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">Theme</label>
            <div class="option-buttons">
              <button
                class="option-btn theme-btn light"
                class:active={theme === 'light'}
                onclick={() => theme = 'light'}
              >Light</button>
              <button
                class="option-btn theme-btn dark"
                class:active={theme === 'dark'}
                onclick={() => theme = 'dark'}
              >Dark</button>
              <button
                class="option-btn theme-btn sepia"
                class:active={theme === 'sepia'}
                onclick={() => theme = 'sepia'}
              >Sepia</button>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">Export Method</label>
            <div class="option-buttons">
              <button
                class="option-btn"
                class:active={exportMethod === 'native'}
                onclick={() => exportMethod = 'native'}
                title="Save directly to file"
              >
                <FileDown size={14} style="margin-right: 4px; vertical-align: middle;" />
                Save to File
              </button>
              <button
                class="option-btn"
                class:active={exportMethod === 'print'}
                onclick={() => exportMethod = 'print'}
                title="Open print dialog"
              >Print Dialog</button>
            </div>
          </div>
        </div>

        <div class="toggles">
          <label class="toggle-item">
            <input type="checkbox" bind:checked={includeTitle} />
            <span>Include title</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" bind:checked={includeMeta} />
            <span>Include metadata (date, word count, tags)</span>
          </label>
          <label class="toggle-item">
            <input type="checkbox" bind:checked={includeTOC} />
            <span>Include table of contents</span>
          </label>
        </div>

        <div class="text-options">
          <div class="text-option">
            <label>Header text</label>
            <input
              type="text"
              placeholder="Optional header text..."
              bind:value={headerText}
            />
          </div>
          <div class="text-option">
            <label>Footer text</label>
            <input
              type="text"
              placeholder="Optional footer text..."
              bind:value={footerText}
            />
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn-secondary" onclick={close} disabled={isExporting}>Cancel</button>
        <button class="btn-primary" onclick={exportPDF} disabled={isExporting}>
          {#if isExporting}
            <Loader2 size={16} class="spin" style="margin-right: 6px; animation: spin 1s linear infinite;" />
            Generating...
          {:else}
            <FileDown size={16} style="margin-right: 6px;" />
            {exportMethod === 'native' ? 'Save PDF' : 'Print PDF'}
          {/if}
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
    max-width: 520px;
    max-height: 90vh;
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

  .preview-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .preview-title {
    font-weight: 600;
    color: var(--text-primary);
  }

  .preview-meta {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .options-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .option-buttons {
    display: flex;
    gap: 8px;
  }

  .option-btn {
    flex: 1;
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .option-btn:hover {
    background: var(--bg-hover);
  }

  .option-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .theme-btn.light {
    background: #fff;
    color: #1a1a1a;
  }

  .theme-btn.dark {
    background: #1a1a1a;
    color: #e0e0e0;
  }

  .theme-btn.sepia {
    background: #f4ecd8;
    color: #5c4b37;
  }

  .toggles {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .toggle-item input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .text-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .text-option {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .text-option label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .text-option input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
  }

  .text-option input::placeholder {
    color: var(--text-tertiary);
  }

  .text-option input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-primary {
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
