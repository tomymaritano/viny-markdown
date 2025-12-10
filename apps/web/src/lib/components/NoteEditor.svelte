<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import TagInput from './TagInput.svelte';
  import MarkdownPreview from './MarkdownPreview.svelte';
  import Backlinks from './Backlinks.svelte';
  import WikiLinkAutocomplete from './WikiLinkAutocomplete.svelte';
  import WordCountGoal from './WordCountGoal.svelte';
  import NoteInfoPanel from './NoteInfoPanel.svelte';
  import ReadingProgress from './ReadingProgress.svelte';
  import VersionHistory from './VersionHistory.svelte';
  import FindReplace from './FindReplace.svelte';
  import TableInsert from './TableInsert.svelte';
  import CodeBlockInsert from './CodeBlockInsert.svelte';
  import LinkInsert from './LinkInsert.svelte';
  import ChecklistInsert from './ChecklistInsert.svelte';
  import CalloutInsert from './CalloutInsert.svelte';
  import TableOfContents from './TableOfContents.svelte';
  import MiniGraph from './MiniGraph.svelte';
  import QuickFormatMenu from './QuickFormatMenu.svelte';
  import {
    ArrowLeft, Star, Copy, Clipboard, Check, Download, FileCode,
    Printer, Info, List, Network, Maximize2, History, Table2,
    Code, Sigma, ChartBar, Minus, Link, SquareCheck, Quote,
    MessageSquare, Image, Archive, Trash2, ArrowLeftRight
  } from 'lucide-svelte';

  let titleInput: HTMLInputElement;
  let showInfoPanel = $state(false);
  let showVersionHistory = $state(false);
  let showFindReplace = $state(false);
  let showTableInsert = $state(false);
  let showCodeBlockInsert = $state(false);
  let showLinkInsert = $state(false);
  let showChecklistInsert = $state(false);
  let showCalloutInsert = $state(false);
  let showTableOfContents = $state(false);
  let showMiniGraph = $state(false);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Split view scroll sync refs
  let splitTextarea: HTMLTextAreaElement;
  let splitPreview: HTMLDivElement;
  let isScrolling = false; // Prevent scroll loop

  // Edit mode textarea ref for autocomplete
  let editTextarea: HTMLTextAreaElement;

  // Preview mode container ref
  let previewContainer: HTMLDivElement;

  // Local state for editing
  let localTitle = $state('');
  let localContent = $state('');
  let lastNoteId = $state<string | null>(null);

  // View mode: 'edit' | 'split' | 'preview'
  type ViewMode = 'edit' | 'split' | 'preview';
  let viewMode = $state<ViewMode>('edit');

  // Save status: 'idle' | 'saving' | 'saved'
  type SaveStatus = 'idle' | 'saving' | 'saved';
  let saveStatus = $state<SaveStatus>('idle');
  let savedTimeout: ReturnType<typeof setTimeout> | null = null;

  // Handle keyboard shortcut for view toggle
  function handleKeydown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl + E: Cycle through view modes (edit -> split -> preview -> edit)
    if (modifier && event.key === 'e') {
      event.preventDefault();
      if (viewMode === 'edit') {
        viewMode = 'split';
      } else if (viewMode === 'split') {
        viewMode = 'preview';
      } else {
        viewMode = 'edit';
      }
    }

    // Cmd/Ctrl + T: Toggle typewriter mode
    if (modifier && event.key === 't') {
      event.preventDefault();
      appStore.toggleTypewriterMode();
    }

    // Cmd/Ctrl + I: Show note info panel
    if (modifier && event.key === 'i' && notesStore.selectedNote) {
      event.preventDefault();
      showInfoPanel = true;
    }

    // Cmd/Ctrl + H: Show version history
    if (modifier && event.key === 'h' && notesStore.selectedNote) {
      event.preventDefault();
      showVersionHistory = true;
    }

    // Cmd/Ctrl + F: Find & replace
    if (modifier && event.key === 'f' && notesStore.selectedNote) {
      event.preventDefault();
      showFindReplace = true;
    }
  }

  // Sync with selected note
  $effect(() => {
    const note = notesStore.selectedNote;
    if (note && note.id !== lastNoteId) {
      localTitle = note.title;
      localContent = note.content;
      lastNoteId = note.id;
    } else if (!note) {
      localTitle = '';
      localContent = '';
      lastNoteId = null;
    }
  });

  function handleTitleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    localTitle = target.value;
    debouncedSave();
  }

  function handleContentChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    localContent = target.value;
    debouncedSave();

    // Apply typewriter scroll if enabled
    if (appStore.typewriterMode) {
      scrollToCenter(target);
    }
  }

  // Scroll sync for split view
  function handleEditorScroll(event: Event) {
    if (!appStore.scrollSync || isScrolling || !splitPreview) return;
    isScrolling = true;

    const editor = event.target as HTMLTextAreaElement;
    const scrollPercent = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    const previewScrollTop = scrollPercent * (splitPreview.scrollHeight - splitPreview.clientHeight);
    splitPreview.scrollTop = previewScrollTop;

    requestAnimationFrame(() => { isScrolling = false; });
  }

  function handlePreviewScroll(event: Event) {
    if (!appStore.scrollSync || isScrolling || !splitTextarea) return;
    isScrolling = true;

    const preview = event.target as HTMLDivElement;
    const scrollPercent = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    const editorScrollTop = scrollPercent * (splitTextarea.scrollHeight - splitTextarea.clientHeight);
    splitTextarea.scrollTop = editorScrollTop;

    requestAnimationFrame(() => { isScrolling = false; });
  }

  // Typewriter mode: keep cursor line centered
  function scrollToCenter(textarea: HTMLTextAreaElement) {
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    const lineNumber = textBeforeCursor.split('\n').length;

    const cursorY = lineNumber * lineHeight;
    const viewportHeight = textarea.clientHeight;
    const targetScroll = cursorY - viewportHeight / 2;

    textarea.scrollTop = Math.max(0, targetScroll);
  }

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 300);
  }

  async function save() {
    const note = notesStore.selectedNote;
    if (!note) return;

    // Set status to saving
    saveStatus = 'saving';
    if (savedTimeout) clearTimeout(savedTimeout);

    await notesStore.updateNote(note.id, {
      title: localTitle,
      content: localContent,
    });

    // Set status to saved, then back to idle after 2 seconds
    saveStatus = 'saved';
    savedTimeout = setTimeout(() => {
      saveStatus = 'idle';
    }, 2000);
  }

  async function handleDelete() {
    const note = notesStore.selectedNote;
    if (!note) return;

    if (confirm('Delete this note?')) {
      await notesStore.deleteNote(note.id);
    }
  }

  function handleArchive() {
    const note = notesStore.selectedNote;
    if (!note) return;
    if (confirm('Archive this note?')) {
      notesStore.archiveNote(note.id);
    }
  }

  async function handleTogglePin() {
    const note = notesStore.selectedNote;
    if (!note) return;
    await notesStore.togglePin(note.id);
  }

  async function handleDuplicate() {
    const note = notesStore.selectedNote;
    if (!note) return;
    await notesStore.duplicateNote(note.id);
  }

  function handleExport() {
    const note = notesStore.selectedNote;
    if (!note) return;
    notesStore.exportNote(note.id);
  }

  async function handleExportHtml() {
    const note = notesStore.selectedNote;
    if (!note) return;
    await notesStore.exportNoteAsHtml(note.id);
  }

  function handleFindReplace(newContent: string) {
    localContent = newContent;
    debouncedSave();
  }

  function handleTableInsert(table: string) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) {
      localContent = localContent + '\n\n' + table;
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + table + '\n\n' + after;
    }
    debouncedSave();
  }

  function handleCodeBlockInsert(codeBlock: string) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) {
      localContent = localContent + '\n\n' + codeBlock;
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + codeBlock + '\n\n' + after;

      // Position cursor inside the code block
      const newCursorPos = cursorPos + codeBlock.indexOf('\n') + 3;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  function handleHorizontalRuleInsert() {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    const hr = '---';
    if (!textarea) {
      localContent = localContent + '\n\n' + hr + '\n\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + hr + '\n\n' + after;

      // Position cursor after the hr
      const newCursorPos = cursorPos + hr.length + 4;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  function handleLinkInsert(link: string) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) {
      localContent = localContent + link;
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + link + after;

      const newCursorPos = cursorPos + link.length;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  function handleQuoteBlockInsert() {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    const quote = '> Your quote here\n> \n> — Author';
    if (!textarea) {
      localContent = localContent + '\n\n' + quote + '\n\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + quote + '\n\n' + after;

      // Position cursor at the quote text
      const newCursorPos = cursorPos + 4; // After "\n\n> "
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos + 15); // Select "Your quote here"
      });
    }
    debouncedSave();
  }

  function handleMathInsert() {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    const math = '$$\nE = mc^2\n$$';
    if (!textarea) {
      localContent = localContent + '\n\n' + math + '\n\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + math + '\n\n' + after;

      // Position cursor inside the math block to select formula
      const formulaStart = cursorPos + 5; // After "\n\n$$\n"
      const formulaEnd = formulaStart + 9; // "E = mc^2" length
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(formulaStart, formulaEnd);
      });
    }
    debouncedSave();
  }

  function handleMermaidInsert() {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    const diagram = '```mermaid\ngraph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Result 1]\n    B -->|No| D[Result 2]\n```';
    if (!textarea) {
      localContent = localContent + '\n\n' + diagram + '\n\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + diagram + '\n\n' + after;

      // Position cursor after the diagram
      const newCursorPos = cursorPos + diagram.length + 4;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  function handleChecklistInsert(checklist: string) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) {
      localContent = localContent + '\n\n' + checklist + '\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + checklist + '\n' + after;

      const newCursorPos = cursorPos + checklist.length + 3;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  // Hidden file input ref for image upload
  let imageInputRef: HTMLInputElement;

  function handleImageUploadClick() {
    imageInputRef?.click();
  }

  async function handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const imageMarkdown = `![${file.name}](${base64})`;

      const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
      if (!textarea) {
        localContent = localContent + '\n\n' + imageMarkdown + '\n\n';
      } else {
        const cursorPos = textarea.selectionStart;
        const before = localContent.slice(0, cursorPos);
        const after = localContent.slice(cursorPos);
        localContent = before + imageMarkdown + after;

        const newCursorPos = cursorPos + imageMarkdown.length;
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      }
      debouncedSave();
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    input.value = '';
  }

  function handleTocHeadingClick(line: number) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) return;

    // Calculate character position for the line
    const lines = localContent.split('\n');
    let charPos = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
      charPos += lines[i].length + 1; // +1 for newline
    }

    // Set cursor position and scroll into view
    textarea.focus();
    textarea.setSelectionRange(charPos, charPos);

    // Scroll textarea to show the line
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = line * lineHeight - textarea.clientHeight / 3;
  }

  function handleCalloutInsert(callout: string) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) {
      localContent = localContent + '\n\n' + callout + '\n\n';
    } else {
      const cursorPos = textarea.selectionStart;
      const before = localContent.slice(0, cursorPos);
      const after = localContent.slice(cursorPos);
      localContent = before + '\n\n' + callout + '\n\n' + after;

      const newCursorPos = cursorPos + callout.length + 4;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
    debouncedSave();
  }

  // Handle paste event for images
  async function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const imageMarkdown = `![Pasted image](${base64})`;

          const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
          if (!textarea) {
            localContent = localContent + '\n\n' + imageMarkdown + '\n\n';
          } else {
            const cursorPos = textarea.selectionStart;
            const before = localContent.slice(0, cursorPos);
            const after = localContent.slice(cursorPos);
            localContent = before + imageMarkdown + after;

            const newCursorPos = cursorPos + imageMarkdown.length;
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            });
          }
          debouncedSave();
        };
        reader.readAsDataURL(file);
        break; // Only handle first image
      }
    }
  }

  async function handlePrint() {
    const note = notesStore.selectedNote;
    if (!note) return;
    await notesStore.printNote(note.id);
  }

  let copyStatus = $state<'idle' | 'copied'>('idle');

  async function handleCopy() {
    const note = notesStore.selectedNote;
    if (!note) return;
    const success = await notesStore.copyNoteToClipboard(note.id);
    if (success) {
      copyStatus = 'copied';
      setTimeout(() => {
        copyStatus = 'idle';
      }, 2000);
    }
  }

  async function handleMoveNote(event: Event) {
    const note = notesStore.selectedNote;
    if (!note) return;
    const select = event.target as HTMLSelectElement;
    const notebookId = select.value === '' ? null : select.value;
    await notesStore.moveNote(note.id, notebookId);
  }

  function getNotebookName(notebookId: string | null): string {
    if (!notebookId) return 'No Notebook';
    const notebook = appStore.notebooks.find((n) => n.id === notebookId);
    return notebook?.name || 'Unknown';
  }

  // Statistics helpers
  function getWordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  function getCharCount(text: string): number {
    return text.length;
  }

  function getParagraphCount(text: string): number {
    return text.split(/\n\n+/).filter((p) => p.trim()).length || 0;
  }

  function getReadingTime(words: number): string {
    const minutes = Math.ceil(words / 200); // ~200 words per minute
    if (minutes < 1) return '< 1 min';
    return `${minutes} min`;
  }

  // Handle wiki link clicks - navigate to or create linked note
  function handleWikiLink(title: string) {
    notesStore.navigateToNoteByTitle(title);
  }

  // Compute backlinks for current note (notes that link TO this note)
  const backlinks = $derived(
    notesStore.selectedNote?.title
      ? notesStore.getBacklinks(notesStore.selectedNote.title)
      : []
  );

  // Compute forward links for current note (notes this note links TO)
  const forwardLinks = $derived(
    notesStore.selectedNote?.content
      ? notesStore.getForwardLinks(notesStore.selectedNote.content)
      : []
  );

  // Navigate to a backlinked note
  function handleBacklinkNavigate(noteId: string) {
    notesStore.selectNote(noteId);
  }

  // Handle wiki link autocomplete selection
  function handleWikiLinkSelect(title: string, startPos: number, endPos: number) {
    const textarea = viewMode === 'edit' ? editTextarea : splitTextarea;
    if (!textarea) return;

    const before = localContent.substring(0, startPos);
    const after = localContent.substring(endPos);
    const newContent = `${before}[[${title}]]${after}`;

    localContent = newContent;
    debouncedSave();

    // Set cursor position after the inserted link
    const newCursorPos = startPos + title.length + 4; // [[ + title + ]]
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  // Get current textarea based on view mode
  const currentTextarea = $derived(viewMode === 'edit' ? editTextarea : splitTextarea);

  // Handle quick format menu changes
  function handleQuickFormat(newContent: string) {
    localContent = newContent;
    debouncedSave();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<main class="note-editor">
  {#if notesStore.selectedNote}
    <header class="editor-header">
      <button
        class="mobile-back-btn"
        onclick={() => appStore.showMobileList()}
        aria-label="Back to notes list"
      >
        <ArrowLeft size={16} /> Notes
      </button>
      <input
        bind:this={titleInput}
        type="text"
        class="title-input"
        placeholder="Untitled"
        value={localTitle}
        oninput={handleTitleChange}
      />
      <div class="editor-actions">
        <div class="view-toggle">
          <button
            class="toggle-btn"
            class:active={viewMode === 'edit'}
            onclick={() => viewMode = 'edit'}
            title="Edit mode"
          >
            Edit
          </button>
          <button
            class="toggle-btn"
            class:active={viewMode === 'split'}
            onclick={() => viewMode = 'split'}
            title="Split view"
          >
            Split
          </button>
          <button
            class="toggle-btn"
            class:active={viewMode === 'preview'}
            onclick={() => viewMode = 'preview'}
            title="Preview mode"
          >
            Preview
          </button>
        </div>
        <button
          class="action-btn"
          onclick={handleTogglePin}
          title={notesStore.selectedNote.isPinned ? 'Unpin' : 'Pin'}
        >
          <Star size={16} fill={notesStore.selectedNote.isPinned ? 'currentColor' : 'none'} />
        </button>
        <button class="action-btn" onclick={handleDuplicate} title="Duplicate">
          <Copy size={16} />
        </button>
        <button class="action-btn" onclick={handleCopy} title={copyStatus === 'copied' ? 'Copied!' : 'Copy as Markdown'}>
          {#if copyStatus === 'copied'}
            <Check size={16} />
          {:else}
            <Clipboard size={16} />
          {/if}
        </button>
        <button class="action-btn" onclick={handleExport} title="Export as Markdown">
          <Download size={16} />
        </button>
        <button class="action-btn" onclick={handleExportHtml} title="Export as HTML">
          <FileCode size={16} />
        </button>
        <button class="action-btn" onclick={handlePrint} title="Print Note">
          <Printer size={16} />
        </button>
        <button class="action-btn" onclick={() => showInfoPanel = true} title="Note Info">
          <Info size={16} />
        </button>
        <button class="action-btn" class:active={showTableOfContents} onclick={() => showTableOfContents = !showTableOfContents} title="Table of Contents">
          <List size={16} />
        </button>
        <button class="action-btn" class:active={showMiniGraph} onclick={() => showMiniGraph = !showMiniGraph} title="Note Graph">
          <Network size={16} />
        </button>
        <button class="action-btn" class:active={appStore.focusMode} onclick={() => appStore.toggleFocusMode()} title="Focus Mode (Zen)">
          <Maximize2 size={16} />
        </button>
        <button class="action-btn" onclick={() => showVersionHistory = true} title="Version History">
          <History size={16} />
        </button>
        <button class="action-btn" onclick={() => showTableInsert = true} title="Insert Table">
          <Table2 size={16} />
        </button>
        <button class="action-btn" onclick={() => showCodeBlockInsert = true} title="Insert Code Block">
          <Code size={16} />
        </button>
        <button class="action-btn" onclick={handleMathInsert} title="Insert Math (LaTeX)">
          <Sigma size={16} />
        </button>
        <button class="action-btn" onclick={handleMermaidInsert} title="Insert Diagram (Mermaid)">
          <ChartBar size={16} />
        </button>
        <button class="action-btn" onclick={handleHorizontalRuleInsert} title="Insert Horizontal Rule">
          <Minus size={16} />
        </button>
        <button class="action-btn" onclick={() => showLinkInsert = true} title="Insert Link">
          <Link size={16} />
        </button>
        <button class="action-btn" onclick={() => showChecklistInsert = true} title="Insert Checklist">
          <SquareCheck size={16} />
        </button>
        <button class="action-btn" onclick={handleQuoteBlockInsert} title="Insert Quote Block">
          <Quote size={16} />
        </button>
        <button class="action-btn" onclick={() => showCalloutInsert = true} title="Insert Callout">
          <MessageSquare size={16} />
        </button>
        <button class="action-btn" onclick={handleImageUploadClick} title="Upload Image">
          <Image size={16} />
        </button>
        <input
          bind:this={imageInputRef}
          type="file"
          accept="image/*"
          class="hidden-input"
          onchange={handleImageUpload}
        />
        <button class="action-btn" onclick={handleArchive} title="Archive">
          <Archive size={16} />
        </button>
        <button class="action-btn danger" onclick={handleDelete} title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    </header>

    <div class="tags-section">
      <TagInput />
    </div>

    <div class="notebook-section">
      <label class="notebook-label">
        <span class="label-text">Notebook:</span>
        <select class="notebook-select" value={notesStore.selectedNote.notebookId || ''} onchange={handleMoveNote}>
          <option value="">No Notebook</option>
          {#each appStore.notebooks as notebook (notebook.id)}
            <option value={notebook.id}>{notebook.name}</option>
          {/each}
        </select>
      </label>
    </div>

    {#if viewMode === 'edit'}
      <div class="editor-wrapper">
        <FindReplace
          open={showFindReplace}
          content={localContent}
          onReplace={handleFindReplace}
          onclose={() => showFindReplace = false}
        />
        <textarea
          bind:this={editTextarea}
          class="content-input"
          placeholder="Start writing..."
          value={localContent}
          oninput={handleContentChange}
          onpaste={handlePaste}
        ></textarea>
        <WikiLinkAutocomplete textarea={editTextarea} onSelect={handleWikiLinkSelect} />
        <QuickFormatMenu textarea={editTextarea} content={localContent} onFormat={handleQuickFormat} />
      </div>
    {:else if viewMode === 'split'}
      <div class="split-view">
        <FindReplace
          open={showFindReplace}
          content={localContent}
          onReplace={handleFindReplace}
          onclose={() => showFindReplace = false}
        />
        <div class="split-pane edit-pane">
          <textarea
            bind:this={splitTextarea}
            class="content-input"
            placeholder="Start writing..."
            value={localContent}
            oninput={handleContentChange}
            onscroll={handleEditorScroll}
            onpaste={handlePaste}
          ></textarea>
          <WikiLinkAutocomplete textarea={splitTextarea} onSelect={handleWikiLinkSelect} />
          <QuickFormatMenu textarea={splitTextarea} content={localContent} onFormat={handleQuickFormat} />
        </div>
        <div class="split-divider">
          <button
            class="sync-toggle"
            class:active={appStore.scrollSync}
            onclick={() => appStore.toggleScrollSync()}
            title={appStore.scrollSync ? 'Scroll sync ON' : 'Scroll sync OFF'}
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>
        <div class="split-pane preview-pane" bind:this={splitPreview} onscroll={handlePreviewScroll}>
          <MarkdownPreview content={localContent} onWikiLink={handleWikiLink} />
        </div>
      </div>
    {:else}
      <div class="preview-container" bind:this={previewContainer}>
        <MarkdownPreview content={localContent} onWikiLink={handleWikiLink} />
      </div>
    {/if}

    <Backlinks backlinks={backlinks} forwardLinks={forwardLinks} onNavigate={handleBacklinkNavigate} />

    <footer class="editor-footer">
      <div class="stats-left">
        <span class="stat">{getWordCount(localContent)} words</span>
        <span class="stat-separator">·</span>
        <span class="stat">{getCharCount(localContent)} chars</span>
        <span class="stat-separator">·</span>
        <span class="stat">{getParagraphCount(localContent)} paragraphs</span>
        <span class="stat-separator">·</span>
        <span class="stat">{getReadingTime(getWordCount(localContent))} read</span>
        <span class="stat-separator">·</span>
        <button
          class="typewriter-toggle"
          class:active={appStore.typewriterMode}
          onclick={() => appStore.toggleTypewriterMode()}
          title="Typewriter mode (Cmd+T)"
        >
          TW
        </button>
        <span class="stat-separator">·</span>
        <WordCountGoal currentWords={getWordCount(localContent)} />
        {#if viewMode === 'preview' || viewMode === 'split'}
          <span class="stat-separator">·</span>
          <ReadingProgress container={viewMode === 'preview' ? previewContainer : splitPreview} />
        {/if}
      </div>
      <div class="save-status-container">
        {#if saveStatus === 'saving'}
          <span class="save-status saving">Saving...</span>
        {:else if saveStatus === 'saved'}
          <span class="save-status saved">Saved</span>
        {/if}
        <span class="last-updated">
          Updated {new Date(notesStore.selectedNote.updatedAt).toLocaleString()}
        </span>
      </div>
    </footer>

    {#if showTableOfContents}
      <aside class="toc-sidebar">
        <TableOfContents
          content={localContent}
          onHeadingClick={handleTocHeadingClick}
        />
      </aside>
    {/if}

    {#if showMiniGraph}
      <aside class="graph-sidebar">
        <MiniGraph
          currentNote={notesStore.selectedNote}
          backlinks={backlinks}
          forwardLinks={forwardLinks}
          onNavigate={handleBacklinkNavigate}
          onClose={() => showMiniGraph = false}
        />
      </aside>
    {/if}
  {:else}
    <div class="no-note">
      <p>Select a note or create a new one</p>
      <div class="quick-actions">
        <kbd>⌘N</kbd> New note
        <span class="separator">·</span>
        <kbd>⌘D</kbd> Daily note
        <span class="separator">·</span>
        <kbd>⌘K</kbd> Quick switcher
      </div>
    </div>
  {/if}
</main>

<NoteInfoPanel open={showInfoPanel} onclose={() => showInfoPanel = false} />

{#if notesStore.selectedNote}
  <VersionHistory
    noteId={notesStore.selectedNote.id}
    open={showVersionHistory}
    onclose={() => showVersionHistory = false}
  />
{/if}

<TableInsert
  open={showTableInsert}
  onInsert={handleTableInsert}
  onclose={() => showTableInsert = false}
/>

<CodeBlockInsert
  open={showCodeBlockInsert}
  onInsert={handleCodeBlockInsert}
  onclose={() => showCodeBlockInsert = false}
/>

<LinkInsert
  open={showLinkInsert}
  onInsert={handleLinkInsert}
  onclose={() => showLinkInsert = false}
/>

<ChecklistInsert
  open={showChecklistInsert}
  onInsert={handleChecklistInsert}
  onclose={() => showChecklistInsert = false}
/>

<CalloutInsert
  open={showCalloutInsert}
  onInsert={handleCalloutInsert}
  onclose={() => showCalloutInsert = false}
/>

<style>
  .note-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    overflow: hidden;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  /* Mobile back button - hidden on desktop */
  .mobile-back-btn {
    display: none;
    padding: 8px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .mobile-back-btn:hover {
    background: var(--bg-hover);
  }

  @media (max-width: 768px) {
    .mobile-back-btn {
      display: block;
    }

    .editor-header {
      padding: 12px 16px;
      gap: 12px;
    }

    .title-input {
      font-size: 18px !important;
    }

    .editor-actions {
      display: none;
    }
  }

  .title-input {
    flex: 1;
    border: none;
    font-size: 24px;
    font-weight: 600;
    outline: none;
    background: transparent;
    color: var(--text-primary);
  }

  .title-input::placeholder {
    color: var(--text-muted);
  }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .toggle-btn {
    padding: 4px 10px;
    border: none;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn:hover {
    color: var(--text-primary);
  }

  .toggle-btn.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    cursor: pointer;
    font-size: 14px;
  }

  .action-btn:hover {
    background: var(--border-color);
  }

  .action-btn.danger:hover {
    background: #fee2e2;
  }

  .tags-section {
    padding: 6px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .notebook-section {
    padding: 6px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .notebook-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .label-text {
    font-weight: 500;
  }

  .notebook-select {
    padding: 4px 8px;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-lg);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    outline: none;
  }

  .notebook-select:focus {
    border-color: var(--accent-color);
  }

  .content-input {
    flex: 1;
    padding: 16px;
    border: none;
    font-size: 15px;
    line-height: 1.6;
    resize: none;
    outline: none;
    font-family: inherit;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .content-input::placeholder {
    color: var(--text-muted);
  }

  .editor-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .editor-wrapper .content-input {
    flex: 1;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-top: 1px solid var(--border-color);
    font-size: 12px;
    color: var(--text-muted);
  }

  .stats-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-separator {
    color: var(--border-color);
  }

  .save-status-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .save-status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: var(--radius-lg);
  }

  .save-status.saving {
    color: var(--warning-text);
    background: var(--warning-bg);
  }

  .save-status.saved {
    color: var(--success-text);
    background: var(--success-bg);
  }

  .no-note {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    gap: 16px;
  }

  .quick-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .quick-actions kbd {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .quick-actions .separator {
    color: var(--border-color);
  }

  /* Split view styles */
  .split-view {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .split-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .split-pane .content-input {
    flex: 1;
    height: 100%;
  }

  .split-divider {
    width: 24px;
    background: var(--border-color);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sync-toggle {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sync-toggle:hover {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .sync-toggle.active {
    background: var(--accent-color);
    color: white;
  }

  .preview-pane {
    background: var(--bg-secondary);
    overflow-y: auto;
  }

  /* Typewriter mode toggle */
  .typewriter-toggle {
    padding: 2px 6px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .typewriter-toggle:hover {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .typewriter-toggle.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .hidden-input {
    display: none;
  }

  .toc-sidebar {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 220px;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
    z-index: 10;
    overflow: hidden;
  }

  .graph-sidebar {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 420px;
    max-width: 90%;
    z-index: 20;
    margin-right: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .graph-sidebar {
      width: calc(100% - 32px);
      margin: 0 16px;
      left: 0;
      right: 0;
    }
  }

  /* Focus mode styles */
  :global(.focus-mode) .editor-header {
    border-bottom: none;
    padding: 24px 32px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  :global(.focus-mode) .note-editor:hover .editor-header {
    opacity: 1;
  }

  :global(.focus-mode) .title-input {
    font-size: 28px;
    text-align: center;
  }

  :global(.focus-mode) .editor-actions {
    opacity: 0;
    transition: opacity 0.2s;
  }

  :global(.focus-mode) .editor-header:hover .editor-actions {
    opacity: 1;
  }

  :global(.focus-mode) .editor-wrapper {
    padding: 0 32px 32px;
  }

  :global(.focus-mode) .content-input {
    font-size: 17px;
    line-height: 1.75;
  }

  :global(.focus-mode) .tags-section,
  :global(.focus-mode) .notebook-section {
    display: none;
  }

  :global(.focus-mode) .editor-footer {
    border-top: none;
    opacity: 0.4;
    transition: opacity 0.2s;
  }

  :global(.focus-mode) .editor-footer:hover {
    opacity: 1;
  }
</style>
