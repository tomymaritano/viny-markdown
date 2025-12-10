<script lang="ts">
  import { Link, Quote } from 'lucide-svelte';

  interface Props {
    textarea: HTMLTextAreaElement | null;
    content: string;
    onFormat: (newContent: string) => void;
  }

  let { textarea, content, onFormat }: Props = $props();

  let visible = $state(false);
  let position = $state({ x: 0, y: 0 });
  let selection = $state({ start: 0, end: 0, text: '' });

  // Handle selection changes
  function handleSelectionChange() {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    // Only show menu if there's a selection
    if (start !== end && selectedText.trim().length > 0) {
      selection = { start, end, text: selectedText };

      // Get position from textarea
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
      const textBeforeSelection = content.slice(0, start);
      const lines = textBeforeSelection.split('\n');
      const currentLine = lines.length - 1;

      // Calculate approximate position
      const scrollTop = textarea.scrollTop;
      const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 24;
      const y = rect.top + paddingTop + currentLine * lineHeight - scrollTop - 40;
      const x = rect.left + rect.width / 2;

      position = { x, y };
      visible = true;
    } else {
      visible = false;
    }
  }

  // Setup event listeners
  $effect(() => {
    if (!textarea) return;

    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') {
        setTimeout(handleSelectionChange, 10);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Hide menu if clicking outside
      const target = e.target as HTMLElement;
      if (!target.closest('.quick-format-menu')) {
        visible = false;
      }
    };

    textarea.addEventListener('mouseup', handleMouseUp);
    textarea.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      textarea.removeEventListener('mouseup', handleMouseUp);
      textarea.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  });

  // Format helpers
  function wrapSelection(prefix: string, suffix: string = prefix) {
    const before = content.slice(0, selection.start);
    const selected = selection.text;
    const after = content.slice(selection.end);

    // Check if already wrapped - if so, unwrap
    if (
      before.endsWith(prefix) &&
      after.startsWith(suffix)
    ) {
      const newContent =
        before.slice(0, -prefix.length) + selected + after.slice(suffix.length);
      onFormat(newContent);
    } else {
      const newContent = before + prefix + selected + suffix + after;
      onFormat(newContent);
    }

    visible = false;
  }

  function formatBold() {
    wrapSelection('**');
  }

  function formatItalic() {
    wrapSelection('*');
  }

  function formatStrikethrough() {
    wrapSelection('~~');
  }

  function formatCode() {
    // Check if multi-line
    if (selection.text.includes('\n')) {
      wrapSelection('```\n', '\n```');
    } else {
      wrapSelection('`');
    }
  }

  function formatHighlight() {
    wrapSelection('==');
  }

  function formatLink() {
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    const newContent = before + `[${selection.text}](url)` + after;
    onFormat(newContent);
    visible = false;
  }

  function formatWikiLink() {
    wrapSelection('[[', ']]');
  }

  function formatHeading() {
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    // Add heading prefix at start of line
    const lineStart = before.lastIndexOf('\n') + 1;
    const newContent =
      before.slice(0, lineStart) + '## ' + before.slice(lineStart) + selection.text + after;
    onFormat(newContent);
    visible = false;
  }

  function formatQuote() {
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    // Add quote prefix to each line
    const quotedText = selection.text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    const newContent = before + quotedText + after;
    onFormat(newContent);
    visible = false;
  }

  function formatBulletList() {
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.end);
    const listText = selection.text
      .split('\n')
      .map((line) => `- ${line}`)
      .join('\n');
    const newContent = before + listText + after;
    onFormat(newContent);
    visible = false;
  }
</script>

{#if visible}
  <div
    class="quick-format-menu"
    style="left: {position.x}px; top: {position.y}px;"
  >
    <button class="format-btn" onclick={formatBold} title="Bold (Cmd+B)">
      <strong>B</strong>
    </button>
    <button class="format-btn" onclick={formatItalic} title="Italic (Cmd+I)">
      <em>I</em>
    </button>
    <button class="format-btn" onclick={formatStrikethrough} title="Strikethrough">
      <s>S</s>
    </button>
    <button class="format-btn" onclick={formatCode} title="Code">
      <code>&lt;/&gt;</code>
    </button>
    <button class="format-btn" onclick={formatHighlight} title="Highlight">
      <span class="highlight-icon">H</span>
    </button>
    <span class="divider"></span>
    <button class="format-btn" onclick={formatLink} title="Link">
      <Link size={14} />
    </button>
    <button class="format-btn" onclick={formatWikiLink} title="Wiki Link">
      [[]]
    </button>
    <span class="divider"></span>
    <button class="format-btn" onclick={formatHeading} title="Heading">
      H2
    </button>
    <button class="format-btn" onclick={formatQuote} title="Quote">
      <Quote size={14} />
    </button>
    <button class="format-btn" onclick={formatBulletList} title="Bullet List">
      •
    </button>
  </div>
{/if}

<style>
  .quick-format-menu {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    transform: translateX(-50%);
    animation: fadeIn 0.1s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .format-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.1s;
  }

  .format-btn:hover {
    background: var(--bg-hover);
  }

  .format-btn strong {
    font-weight: 700;
  }

  .format-btn em {
    font-style: italic;
  }

  .format-btn s {
    text-decoration: line-through;
  }

  .format-btn code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    padding: 0;
    background: transparent;
  }

  .highlight-icon {
    background: rgba(255, 235, 59, 0.5);
    padding: 0 4px;
    border-radius: 2px;
    font-weight: 600;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border-color);
    margin: 0 4px;
  }

  :global([data-theme='dark']) .quick-format-menu {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  :global([data-theme='dark']) .highlight-icon {
    background: rgba(255, 235, 59, 0.3);
  }
</style>
