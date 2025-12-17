<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import Link from '@tiptap/extension-link';
  import Image from '@tiptap/extension-image';
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';
  import Highlight from '@tiptap/extension-highlight';
  import Typography from '@tiptap/extension-typography';
  import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
  import { common, createLowlight } from 'lowlight';
  import {
    Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
    List, ListOrdered, CheckSquare, Quote, Minus, Link as LinkIcon,
    Image as ImageIcon, Undo, Redo, Highlighter, Code2
  } from '@lucide/svelte';

  interface Props {
    content: string;
    placeholder?: string;
    onUpdate?: (markdown: string) => void;
    readonly?: boolean;
  }

  let { content, placeholder = 'Start writing...', onUpdate, readonly = false }: Props = $props();

  let editorElement: HTMLDivElement;
  let editor: Editor | null = $state(null);

  // Create lowlight instance for syntax highlighting
  const lowlight = createLowlight(common);

  // Convert markdown to HTML for TipTap
  function markdownToHtml(markdown: string): string {
    // Basic markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Strikethrough
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Highlight
      .replace(/==(.*?)==/g, '<mark>$1</mark>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote><p>$1</p></blockquote>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr>')
      // Task lists
      .replace(/^- \[x\] (.*$)/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">$1</li></ul>')
      .replace(/^- \[ \] (.*$)/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">$1</li></ul>')
      // Unordered lists
      .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
      // Ordered lists
      .replace(/^\d+\. (.*$)/gm, '<ol><li>$1</li></ol>')
      // Paragraphs (lines that aren't already wrapped)
      .replace(/^(?!<[a-z])(.*$)/gm, (match) => match.trim() ? `<p>${match}</p>` : '<p></p>');

    // Merge consecutive list items
    html = html
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/<\/ol>\s*<ol>/g, '')
      .replace(/<\/ul>\s*<ul data-type="taskList">/g, '')
      .replace(/<\/blockquote>\s*<blockquote>/g, '');

    return html;
  }

  // Convert HTML back to markdown
  function htmlToMarkdown(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    function processNode(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as Element;
      const children = Array.from(el.childNodes).map(processNode).join('');

      switch (el.tagName.toLowerCase()) {
        case 'h1': return `# ${children}\n\n`;
        case 'h2': return `## ${children}\n\n`;
        case 'h3': return `### ${children}\n\n`;
        case 'p': return `${children}\n\n`;
        case 'strong': return `**${children}**`;
        case 'em': return `*${children}*`;
        case 's': return `~~${children}~~`;
        case 'code':
          if (el.parentElement?.tagName.toLowerCase() === 'pre') {
            return children;
          }
          return `\`${children}\``;
        case 'pre': {
          const codeEl = el.querySelector('code');
          const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
          const code = codeEl?.textContent || children;
          return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
        }
        case 'mark': return `==${children}==`;
        case 'a': return `[${children}](${el.getAttribute('href') || ''})`;
        case 'img': return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`;
        case 'blockquote': return `> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
        case 'hr': return '---\n\n';
        case 'ul': {
          if (el.getAttribute('data-type') === 'taskList') {
            return Array.from(el.children).map(li => {
              const checked = li.getAttribute('data-checked') === 'true';
              const text = processNode(li).trim();
              return `- [${checked ? 'x' : ' '}] ${text}\n`;
            }).join('') + '\n';
          }
          return Array.from(el.children).map(li => `- ${processNode(li).trim()}\n`).join('') + '\n';
        }
        case 'ol': {
          return Array.from(el.children).map((li, i) => `${i + 1}. ${processNode(li).trim()}\n`).join('') + '\n';
        }
        case 'li': return children;
        case 'br': return '\n';
        default: return children;
      }
    }

    return processNode(tempDiv).trim();
  }

  onMount(() => {
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          codeBlock: false, // We use CodeBlockLowlight instead
        }),
        Placeholder.configure({
          placeholder,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'wysiwyg-link',
          },
        }),
        Image.configure({
          HTMLAttributes: {
            class: 'wysiwyg-image',
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Highlight.configure({
          multicolor: false,
        }),
        Typography,
        CodeBlockLowlight.configure({
          lowlight,
        }),
      ],
      content: markdownToHtml(content),
      editable: !readonly,
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          const html = editor.getHTML();
          const markdown = htmlToMarkdown(html);
          onUpdate(markdown);
        }
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  // Update content when prop changes
  $effect(() => {
    if (editor && !editor.isFocused) {
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(content);
      if (currentHtml !== newHtml) {
        editor.commands.setContent(newHtml);
      }
    }
  });

  // Toolbar actions
  function toggleBold() { editor?.chain().focus().toggleBold().run(); }
  function toggleItalic() { editor?.chain().focus().toggleItalic().run(); }
  function toggleStrike() { editor?.chain().focus().toggleStrike().run(); }
  function toggleCode() { editor?.chain().focus().toggleCode().run(); }
  function toggleHighlight() { editor?.chain().focus().toggleHighlight().run(); }
  function toggleHeading1() { editor?.chain().focus().toggleHeading({ level: 1 }).run(); }
  function toggleHeading2() { editor?.chain().focus().toggleHeading({ level: 2 }).run(); }
  function toggleHeading3() { editor?.chain().focus().toggleHeading({ level: 3 }).run(); }
  function toggleBulletList() { editor?.chain().focus().toggleBulletList().run(); }
  function toggleOrderedList() { editor?.chain().focus().toggleOrderedList().run(); }
  function toggleTaskList() { editor?.chain().focus().toggleTaskList().run(); }
  function toggleBlockquote() { editor?.chain().focus().toggleBlockquote().run(); }
  function toggleCodeBlock() { editor?.chain().focus().toggleCodeBlock().run(); }
  function setHorizontalRule() { editor?.chain().focus().setHorizontalRule().run(); }
  function undo() { editor?.chain().focus().undo().run(); }
  function redo() { editor?.chain().focus().redo().run(); }

  function setLink() {
    const url = prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  function addImage() {
    const url = prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }

  // Check if format is active
  function isActive(name: string, attrs?: Record<string, unknown>): boolean {
    return editor?.isActive(name, attrs) || false;
  }
</script>

<div class="wysiwyg-container">
  {#if !readonly}
    <div class="wysiwyg-toolbar" role="toolbar" aria-label="Formatting options">
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          class:active={isActive('bold')}
          onclick={toggleBold}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('italic')}
          onclick={toggleItalic}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('strike')}
          onclick={toggleStrike}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('code')}
          onclick={toggleCode}
          title="Inline Code"
          aria-label="Inline code"
        >
          <Code size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('highlight')}
          onclick={toggleHighlight}
          title="Highlight"
          aria-label="Highlight"
        >
          <Highlighter size={16} />
        </button>
      </div>

      <span class="toolbar-divider"></span>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          class:active={isActive('heading', { level: 1 })}
          onclick={toggleHeading1}
          title="Heading 1"
          aria-label="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('heading', { level: 2 })}
          onclick={toggleHeading2}
          title="Heading 2"
          aria-label="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('heading', { level: 3 })}
          onclick={toggleHeading3}
          title="Heading 3"
          aria-label="Heading 3"
        >
          <Heading3 size={16} />
        </button>
      </div>

      <span class="toolbar-divider"></span>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          class:active={isActive('bulletList')}
          onclick={toggleBulletList}
          title="Bullet List"
          aria-label="Bullet list"
        >
          <List size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('orderedList')}
          onclick={toggleOrderedList}
          title="Numbered List"
          aria-label="Numbered list"
        >
          <ListOrdered size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('taskList')}
          onclick={toggleTaskList}
          title="Task List"
          aria-label="Task list"
        >
          <CheckSquare size={16} />
        </button>
      </div>

      <span class="toolbar-divider"></span>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          class:active={isActive('blockquote')}
          onclick={toggleBlockquote}
          title="Quote"
          aria-label="Blockquote"
        >
          <Quote size={16} />
        </button>
        <button
          class="toolbar-btn"
          class:active={isActive('codeBlock')}
          onclick={toggleCodeBlock}
          title="Code Block"
          aria-label="Code block"
        >
          <Code2 size={16} />
        </button>
        <button
          class="toolbar-btn"
          onclick={setHorizontalRule}
          title="Horizontal Rule"
          aria-label="Horizontal rule"
        >
          <Minus size={16} />
        </button>
      </div>

      <span class="toolbar-divider"></span>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          class:active={isActive('link')}
          onclick={setLink}
          title="Insert Link"
          aria-label="Insert link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          class="toolbar-btn"
          onclick={addImage}
          title="Insert Image"
          aria-label="Insert image"
        >
          <ImageIcon size={16} />
        </button>
      </div>

      <span class="toolbar-divider"></span>

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          onclick={undo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          class="toolbar-btn"
          onclick={redo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo size={16} />
        </button>
      </div>
    </div>
  {/if}

  <div
    class="wysiwyg-editor"
    class:readonly
    bind:this={editorElement}
  ></div>
</div>

<style>
  .wysiwyg-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }

  .wysiwyg-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--border);
    margin: 0 6px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .toolbar-btn.active {
    background: var(--accent);
    color: white;
  }

  .wysiwyg-editor {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  .wysiwyg-editor.readonly {
    background: var(--bg-secondary);
  }

  /* TipTap Editor Styles */
  .wysiwyg-editor :global(.tiptap) {
    outline: none;
    min-height: 100%;
  }

  .wysiwyg-editor :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--text-tertiary);
    pointer-events: none;
    float: left;
    height: 0;
  }

  .wysiwyg-editor :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0.5em 0;
    color: var(--text-primary);
  }

  .wysiwyg-editor :global(h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 0.5em 0;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }

  .wysiwyg-editor :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.5em 0;
    color: var(--text-primary);
  }

  .wysiwyg-editor :global(p) {
    margin: 0.75em 0;
    line-height: 1.7;
  }

  .wysiwyg-editor :global(strong) {
    font-weight: 600;
  }

  .wysiwyg-editor :global(code) {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
    font-size: 0.9em;
    color: var(--accent);
  }

  .wysiwyg-editor :global(pre) {
    background: var(--bg-tertiary);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
    border-left: 4px solid var(--accent);
  }

  .wysiwyg-editor :global(pre code) {
    background: none;
    padding: 0;
    color: var(--text-primary);
    font-size: 0.9em;
  }

  .wysiwyg-editor :global(mark) {
    background: var(--warning-light);
    color: inherit;
    padding: 2px 4px;
    border-radius: 2px;
  }

  .wysiwyg-editor :global(blockquote) {
    border-left: 4px solid var(--accent);
    margin: 1em 0;
    padding: 0.5em 0 0.5em 1em;
    color: var(--text-secondary);
    font-style: italic;
    background: var(--bg-secondary);
    border-radius: 0 8px 8px 0;
  }

  .wysiwyg-editor :global(ul),
  .wysiwyg-editor :global(ol) {
    margin: 0.75em 0;
    padding-left: 1.5em;
  }

  .wysiwyg-editor :global(li) {
    margin: 0.25em 0;
  }

  .wysiwyg-editor :global(ul[data-type="taskList"]) {
    list-style: none;
    padding-left: 0;
  }

  .wysiwyg-editor :global(ul[data-type="taskList"] li) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .wysiwyg-editor :global(ul[data-type="taskList"] li > label) {
    flex-shrink: 0;
    margin-top: 4px;
  }

  .wysiwyg-editor :global(ul[data-type="taskList"] li > div) {
    flex: 1;
  }

  .wysiwyg-editor :global(ul[data-type="taskList"] input[type="checkbox"]) {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }

  .wysiwyg-editor :global(hr) {
    border: none;
    border-top: 2px solid var(--border);
    margin: 1.5em 0;
  }

  .wysiwyg-editor :global(a) {
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }

  .wysiwyg-editor :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1em 0;
  }

  /* Syntax highlighting for code blocks */
  .wysiwyg-editor :global(.hljs-keyword) { color: #d73a49; }
  .wysiwyg-editor :global(.hljs-string) { color: #032f62; }
  .wysiwyg-editor :global(.hljs-number) { color: #005cc5; }
  .wysiwyg-editor :global(.hljs-comment) { color: #6a737d; font-style: italic; }
  .wysiwyg-editor :global(.hljs-function) { color: #6f42c1; }
  .wysiwyg-editor :global(.hljs-attr) { color: #005cc5; }
  .wysiwyg-editor :global(.hljs-tag) { color: #22863a; }
</style>
