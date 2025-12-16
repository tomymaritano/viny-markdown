<script lang="ts">
  import { notesStore, appStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import { parseMarkdown, getWordCount, getReadingTime, extractNoteLinks, extractHeadings } from '$lib/markdown';
  import { searchEmojis } from '$lib/emojis';
  import { searchSnippets, getSnippetContent, type Snippet } from '$lib/snippets';
  import { ambientSounds, playAmbientSound, stopAmbientSound, setAmbientVolume } from '$lib/ambientSounds';
  import { lofiStations, playLofiStation, stopLofiStation, setLofiVolume, isLofiPlaying } from '$lib/lofiPlayer';
  import {
    speechRecognition,
    isSpeechRecognitionSupported,
    speechLanguages,
    getSpeechSettings,
    setSpeechLanguage,
  } from '$lib/speechRecognition';
  import TagInput from './TagInput.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import VersionHistoryModal from './VersionHistoryModal.svelte';
  import PomodoroTimer from './PomodoroTimer.svelte';
  import WritingStatsPanel from './WritingStatsPanel.svelte';
  import ExportPDFModal from './ExportPDFModal.svelte';
  import SnippetsManagerModal from './SnippetsManagerModal.svelte';
  import FocusModeOverlay from './FocusModeOverlay.svelte';
  import ExportModal from './ExportModal.svelte';
  import CalendarView from './CalendarView.svelte';
  import RemindersModal from './RemindersModal.svelte';
  import { addWordsWritten, incrementNotesEdited, getTodayStats } from '$lib/writingStats';
  import { getOverdueReminders, getTodayReminders, checkDueReminders, markAsNotified, showReminderNotification, requestNotificationPermission } from '$lib/reminders';
  import { NOTE_COLORS, getNoteColor, setNoteColor, getNoteColorId, type NoteColor } from '$lib/noteColors';
  import {
    MoreHorizontal, Copy, Download, FileOutput, Clock, Scissors, Trash2, X,
    ArrowLeft, ArrowRight, AlertTriangle, FileText
  } from '@lucide/svelte';

  let titleInput: HTMLInputElement;
  let contentArea: HTMLTextAreaElement;
  let isSaving = $state(false);
  let lastSavedAt = $state<Date | null>(null);
  let hasUnsavedChanges = $state(false);
  let viewMode = $state<'edit' | 'preview' | 'split' | 'split-horizontal' | 'reading' | 'presentation'>('edit');
  let currentSlide = $state(0);
  let showDeleteConfirm = $state(false);
  let showMoreMenu = $state(false);
  let showVersionHistory = $state(false);
  let showColorPicker = $state(false);
  let noteColorVersion = $state(0); // Used to trigger reactivity when color changes

  // Current note color (reactive)
  const currentNoteColor = $derived(() => {
    // Reference noteColorVersion to trigger updates
    noteColorVersion;
    const noteId = notesStore.selectedNoteId;
    if (!noteId) return NOTE_COLORS[0];
    return getNoteColor(noteId);
  });

  function handleColorChange(colorId: string) {
    const noteId = notesStore.selectedNoteId;
    if (!noteId) return;
    setNoteColor(noteId, colorId);
    noteColorVersion++; // Trigger reactivity
    showColorPicker = false;
    toast.success(`Color changed to ${NOTE_COLORS.find(c => c.id === colorId)?.name || 'Default'}`);
  }

  // Find and replace state
  let showFindReplace = $state(false);
  let findQuery = $state('');
  let replaceQuery = $state('');
  let findCaseSensitive = $state(false);
  let findWholeWord = $state(false);
  let findRegex = $state(false);
  let currentMatchIndex = $state(0);
  let totalMatches = $state(0);
  let regexError = $state<string | null>(null);
  let showRegexHelp = $state(false);
  let replacePreview = $state<string | null>(null);
  let showSearchHistory = $state(false);
  let searchHistory = $state<Array<{ query: string; isRegex: boolean; timestamp: number }>>([]);

  // Load search history from localStorage
  function loadSearchHistory() {
    try {
      const stored = localStorage.getItem('viny-search-history');
      if (stored) {
        searchHistory = JSON.parse(stored);
      }
    } catch {
      searchHistory = [];
    }
  }

  // Save search to history
  function saveToSearchHistory(query: string, isRegex: boolean) {
    if (!query.trim()) return;

    // Remove duplicate if exists
    const filtered = searchHistory.filter(h => h.query !== query);

    // Add to beginning
    const newHistory = [
      { query, isRegex, timestamp: Date.now() },
      ...filtered
    ].slice(0, 10); // Keep only 10 recent searches

    searchHistory = newHistory;
    localStorage.setItem('viny-search-history', JSON.stringify(newHistory));
  }

  // Clear search history
  function clearSearchHistory() {
    searchHistory = [];
    localStorage.removeItem('viny-search-history');
    showSearchHistory = false;
  }

  // Use search from history
  function useSearchFromHistory(item: { query: string; isRegex: boolean }) {
    findQuery = item.query;
    findRegex = item.isRegex;
    showSearchHistory = false;
    updateFindMatches();
  }

  // Format timestamp for display
  function formatSearchTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // Initialize search history on mount
  $effect(() => {
    loadSearchHistory();
  });

  // Initialize reminder checker
  $effect(() => {
    // Request notification permission
    requestNotificationPermission();

    // Check for due reminders every minute
    const checkReminders = () => {
      const dueReminders = checkDueReminders();
      for (const reminder of dueReminders) {
        showReminderNotification(reminder);
        markAsNotified(reminder.id);
      }
    };

    // Initial check
    checkReminders();

    // Set interval
    reminderCheckInterval = setInterval(checkReminders, 60000);

    return () => {
      if (reminderCheckInterval) {
        clearInterval(reminderCheckInterval);
      }
    };
  });
  let showWordGoal = $state(false);
  let showCharLimit = $state(false);
  let charLimit = $state(0); // 0 means no limit
  let charLimitEnabled = $state(false);

  // Emoji autocomplete state
  let showEmojiSuggestions = $state(false);
  let emojiQuery = $state('');
  let emojiSuggestionIndex = $state(0);
  let emojiInsertPosition = $state(0);
  let wordGoal = $state(500);

  // Snippet autocomplete state
  let showSnippetSuggestions = $state(false);
  let snippetQuery = $state('');
  let snippetSuggestionIndex = $state(0);
  let snippetInsertPosition = $state(0);

  const snippetSuggestions = $derived(() => {
    return searchSnippets(snippetQuery, 8);
  });

  const wordCount = $derived(notesStore.selectedNote ? getWordCount(notesStore.selectedNote.content) : 0);
  const goalProgress = $derived(wordGoal > 0 ? Math.min(100, Math.round((wordCount / wordGoal) * 100)) : 0);

  // Advanced statistics
  const advancedStats = $derived(() => {
    const content = notesStore.selectedNote?.content || '';
    const chars = content.length;
    const charsNoSpaces = content.replace(/\s/g, '').length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim()).length || 1;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim()).length;
    const avgWordsPerSentence = sentences > 0 ? Math.round(wordCount / sentences) : 0;
    const readingTime = Math.ceil(wordCount / 200); // 200 wpm average
    const speakingTime = Math.ceil(wordCount / 150); // 150 wpm speaking

    // Count tasks
    const taskMatches = content.match(/- \[([ x])\]/g) || [];
    const totalTasks = taskMatches.length;
    const completedTasks = taskMatches.filter(t => t.includes('[x]')).length;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Count markdown elements
    const headings = (content.match(/^#{1,6}\s/gm) || []).length;
    const links = (content.match(/\[([^\]]+)\]\([^)]+\)/g) || []).length;
    const noteLinks = (content.match(/\[\[[^\]]+\]\]/g) || []).length;
    const images = (content.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length;
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    const inlineCode = (content.match(/`[^`]+`/g) || []).length;
    const quotes = (content.match(/^>\s/gm) || []).length;
    const lists = (content.match(/^[-*]\s/gm) || []).length;

    // Calculate readability (Flesch-Kincaid approximation)
    const syllables = content.toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/)
      .reduce((acc, word) => acc + countSyllables(word), 0);
    const fleschScore = sentences > 0 && wordCount > 0
      ? Math.round(206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount))
      : 0;
    const readabilityLevel = fleschScore >= 90 ? 'Very Easy' :
      fleschScore >= 80 ? 'Easy' :
      fleschScore >= 70 ? 'Fairly Easy' :
      fleschScore >= 60 ? 'Standard' :
      fleschScore >= 50 ? 'Fairly Difficult' :
      fleschScore >= 30 ? 'Difficult' : 'Very Difficult';

    // Top words (excluding common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'as', 'if']);
    const wordFreq: Record<string, number> = {};
    const words = content.toLowerCase().replace(/[^a-záéíóúñü\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    words.forEach(word => { wordFreq[word] = (wordFreq[word] || 0) + 1; });
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    return {
      chars,
      charsNoSpaces,
      paragraphs,
      sentences,
      avgWordsPerSentence,
      readingTime,
      speakingTime,
      totalTasks,
      completedTasks,
      taskProgress,
      headings,
      links,
      noteLinks,
      images,
      codeBlocks,
      inlineCode,
      quotes,
      lists,
      fleschScore,
      readabilityLevel,
      topWords,
    };
  });

  // Helper function to count syllables (approximation)
  function countSyllables(word: string): number {
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  let showAdvancedStats = $state(false);
  let typewriterMode = $state(false);
  let readingProgress = $state(0);
  let readingModeContainer: HTMLDivElement;
  let focusParagraphMode = $state(false);
  let currentParagraphIndex = $state(0);
  let readingTheme = $state<'default' | 'sepia' | 'night' | 'warm'>('default');
  let showTOC = $state(false);
  let activeTOCHeading = $state<string | null>(null);

  // Selection toolbar state
  let showSelectionToolbar = $state(false);
  let selectionToolbarX = $state(0);
  let selectionToolbarY = $state(0);
  let selectedTextLength = $state(0);

  // Presentation slides (split by ## headings)
  const presentationSlides = $derived(() => {
    const content = notesStore.selectedNote?.content || '';
    const title = notesStore.selectedNote?.title || 'Untitled';

    // Split content by ## headings
    const sections = content.split(/(?=^## )/m);
    const slides: Array<{ title: string; content: string }> = [];

    // First slide is the title + content before first ##
    const firstSection = sections[0];
    if (firstSection.trim()) {
      slides.push({
        title: title,
        content: firstSection.trim()
      });
    } else {
      slides.push({
        title: title,
        content: ''
      });
    }

    // Remaining slides from ## headings
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const heading = lines[0].replace(/^##\s*/, '').trim();
      const body = lines.slice(1).join('\n').trim();

      slides.push({
        title: heading,
        content: body
      });
    }

    return slides;
  });

  const emojiSuggestions = $derived(() => {
    if (!emojiQuery) return [];
    return searchEmojis(emojiQuery, 8);
  });
  const goalReached = $derived(wordCount >= wordGoal);

  // Character limit derived values
  const charCount = $derived(notesStore.selectedNote?.content.length ?? 0);
  const charLimitProgress = $derived(charLimitEnabled && charLimit > 0 ? Math.min(100, Math.round((charCount / charLimit) * 100)) : 0);
  const charLimitExceeded = $derived(charLimitEnabled && charLimit > 0 && charCount > charLimit);
  const charLimitWarning = $derived(charLimitEnabled && charLimit > 0 && charCount >= charLimit * 0.9 && !charLimitExceeded);

  // Session statistics
  const sessionWordsWritten = $derived(isSessionActive ? Math.max(0, wordCount - sessionStartWordCount) : 0);
  const sessionDuration = $derived(() => {
    if (!sessionStartTime || !isSessionActive) return '0m';
    const minutes = Math.floor((Date.now() - sessionStartTime.getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  });
  const sessionWPM = $derived(() => {
    if (!sessionStartTime || !isSessionActive || sessionWordsWritten === 0) return 0;
    const minutes = (Date.now() - sessionStartTime.getTime()) / 60000;
    return minutes > 0 ? Math.round(sessionWordsWritten / minutes) : 0;
  });

  // Parse paragraphs for focus mode
  const contentParagraphs = $derived(() => {
    const content = notesStore.selectedNote?.content || '';
    return content.split(/\n\s*\n/).filter(p => p.trim());
  });

  // Find backlinks - notes that link to this note with context
  interface BacklinkItem {
    note: typeof notesStore.selectedNote;
    context: string;
    matchCount: number;
  }

  const backlinks = $derived(() => {
    const currentNote = notesStore.selectedNote;
    if (!currentNote || !currentNote.title) return [] as BacklinkItem[];

    const currentTitle = currentNote.title.toLowerCase();
    const results: BacklinkItem[] = [];

    for (const note of notesStore.notes) {
      if (note.id === currentNote.id) continue;
      const links = extractNoteLinks(note.content);
      if (!links.includes(currentTitle)) continue;

      // Find the context around the link
      const linkPattern = new RegExp(`\\[\\[${currentNote.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'gi');
      const matches = [...note.content.matchAll(linkPattern)];

      if (matches.length > 0) {
        const firstMatch = matches[0];
        const matchIndex = firstMatch.index || 0;
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(note.content.length, matchIndex + firstMatch[0].length + 40);
        let context = note.content.slice(start, end).replace(/\n/g, ' ').trim();
        if (start > 0) context = '...' + context;
        if (end < note.content.length) context = context + '...';

        results.push({
          note,
          context,
          matchCount: matches.length
        });
      }
    }

    return results;
  });

  let showBacklinks = $state(true);
  let showOutline = $state(false);

  // Detect broken links in current note
  const brokenLinks = $derived(() => {
    const currentNote = notesStore.selectedNote;
    if (!currentNote) return [];

    const links = extractNoteLinks(currentNote.content);
    const existingTitles = new Set(
      notesStore.notes.map(n => n.title.toLowerCase())
    );

    return links.filter(link => !existingTitles.has(link));
  });

  // Note link autocomplete
  let showLinkSuggestions = $state(false);
  let linkQuery = $state('');
  let linkSuggestionIndex = $state(0);
  let linkInsertPosition = $state(0);

  // Cursor position tracking
  let cursorLine = $state(1);
  let cursorColumn = $state(1);
  let totalLines = $state(1);

  // Zen/Typewriter mode
  let zenMode = $state(false);
  let ambientSoundId = $state('none');
  let ambientVolume = $state(0.3);
  let showAmbientPanel = $state(false);
  let showPomodoro = $state(false);

  // Lo-fi music player
  let lofiStationId = $state('none');
  let lofiVolume = $state(0.3);
  let showLofiPanel = $state(false);

  // Writing stats
  let showWritingStats = $state(false);
  let previousWordCount = $state(0);

  // Voice dictation
  let isDictating = $state(false);
  let dictationSupported = $state(isSpeechRecognitionSupported());
  let showDictationPanel = $state(false);
  let dictationLanguage = $state(getSpeechSettings().language);
  let interimTranscript = $state('');

  // Export PDF modal
  let showExportPDF = $state(false);

  // Snippets manager
  let showSnippetsManager = $state(false);

  // Focus mode overlay
  let showFocusMode = $state(false);

  // Export modal
  let showExportModal = $state(false);

  // Calendar view
  let showCalendarView = $state(false);

  // Reminders
  let showReminders = $state(false);
  let reminderCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Context menu state
  let showContextMenu = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let selectedText = $state('');

  // Dictionary lookup state
  interface DictionaryPhonetic {
    text?: string;
    audio?: string;
  }
  interface DictionaryMeaning {
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }
  interface DictionaryEntry {
    word: string;
    phonetic?: string;
    phonetics?: DictionaryPhonetic[];
    meanings: DictionaryMeaning[];
    sourceUrls?: string[];
  }
  let showDefinitionModal = $state(false);
  let definitionWord = $state('');
  let definitionData = $state<DictionaryEntry | null>(null);
  let definitionLoading = $state(false);
  let definitionError = $state<string | null>(null);
  let definitionAudio = $state<HTMLAudioElement | null>(null);

  // Drag & drop state
  let isDraggingFile = $state(false);

  // Scroll sync state
  let scrollSyncEnabled = $state(true);
  let isScrollingEditor = $state(false);
  let isScrollingPreview = $state(false);
  let previewArea: HTMLDivElement;

  // Writing session tracking
  let sessionStartWordCount = $state(0);
  let sessionStartTime = $state<Date | null>(null);
  let isSessionActive = $state(false);

  // Typing indicator
  let isTyping = $state(false);
  let typingTimeout: ReturnType<typeof setTimeout>;
  let lastTypingTime = $state<Date | null>(null);
  let recentKeystrokeCount = $state(0);

  const linkSuggestions = $derived(() => {
    if (!linkQuery) return notesStore.allNotes.slice(0, 8);
    const query = linkQuery.toLowerCase();
    return notesStore.allNotes
      .filter(n => n.title.toLowerCase().includes(query) && n.id !== notesStore.selectedNoteId)
      .slice(0, 8);
  });

  // Extract headings for table of contents
  const headings = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return [];
    return extractHeadings(note.content);
  });

  // Outgoing links - notes that current note links to
  const outgoingLinks = $derived(() => {
    const note = notesStore.selectedNote;
    if (!note) return [];
    return notesStore.getOutgoingLinks(note.id);
  });

  // Link preview on hover state
  let showLinkPreview = $state(false);
  let linkPreviewNote = $state<{ title: string; content: string; updated_at: string } | null>(null);
  let linkPreviewPosition = $state({ x: 0, y: 0 });
  let linkPreviewTimeout: ReturnType<typeof setTimeout> | null = null;

  // Debounce save
  let saveTimeout: ReturnType<typeof setTimeout>;

  function handleTitleChange(e: Event) {
    const title = (e.target as HTMLInputElement).value;
    debouncedSave({ title });
  }

  function handleContentChange(e: Event) {
    const content = (e.target as HTMLTextAreaElement).value;
    debouncedSave({ content });
  }

  function debouncedSave(updates: { title?: string; content?: string }) {
    clearTimeout(saveTimeout);
    hasUnsavedChanges = true;
    isSaving = true;
    saveTimeout = setTimeout(async () => {
      const note = notesStore.selectedNote;
      if (note) {
        try {
          await notesStore.updateNote(note.id, {
            title: updates.title ?? null,
            content: updates.content ?? null,
            notebook_id: null,
            tags: null,
            status: null,
            is_pinned: null,
          });
          lastSavedAt = new Date();
          hasUnsavedChanges = false;
        } catch (err) {
          toast.error('Failed to save note');
        }
      }
      isSaving = false;
    }, 500);
  }

  // Writing session controls
  function startSession() {
    sessionStartWordCount = wordCount;
    sessionStartTime = new Date();
    isSessionActive = true;
    toast.success('Writing session started');
  }

  function stopSession() {
    if (sessionWordsWritten > 0) {
      toast.success(`Session ended: ${sessionWordsWritten} words in ${sessionDuration()}`);
    } else {
      toast.info('Session ended');
    }
    isSessionActive = false;
    sessionStartTime = null;
    sessionStartWordCount = 0;
  }

  function toggleSession() {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  }

  // Format relative time for last saved
  function formatLastSaved(): string {
    if (!lastSavedAt) return 'Saved';

    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastSavedAt.getTime()) / 1000);

    if (diffSeconds < 5) return 'Just saved';
    if (diffSeconds < 60) return `Saved ${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Saved ${diffMinutes}m ago`;

    return `Saved at ${lastSavedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  async function togglePin() {
    const note = notesStore.selectedNote;
    if (note) {
      await notesStore.updateNote(note.id, {
        title: null,
        content: null,
        notebook_id: null,
        tags: null,
        status: null,
        is_pinned: !note.is_pinned,
      });
    }
  }

  function confirmDelete() {
    showDeleteConfirm = true;
  }

  async function moveToTrash() {
    const note = notesStore.selectedNote;
    if (note) {
      await notesStore.deleteNote(note.id);
      toast.info('Note moved to trash');
    }
    showDeleteConfirm = false;
  }

  async function duplicateNote() {
    const note = notesStore.selectedNote;
    if (!note) return;

    try {
      const newNote = await notesStore.createNote({
        title: `${note.title} (copy)`,
        content: note.content,
        notebook_id: note.notebook_id,
        tags: note.tags,
      });
      notesStore.selectNote(newNote.id);
      toast.success('Note duplicated');
    } catch (err) {
      toast.error('Failed to duplicate note');
    }
  }

  async function copyToClipboard() {
    const note = notesStore.selectedNote;
    if (!note) return;

    try {
      const content = `# ${note.title || 'Untitled'}\n\n${note.content}`;
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  }

  async function exportNote() {
    const note = notesStore.selectedNote;
    if (!note) return;

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filename = (note.title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const path = await save({
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'HTML', extensions: ['html'] },
          { name: 'Plain Text', extensions: ['txt'] },
        ],
        defaultPath: `${filename}.md`,
      });

      if (path) {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        let content: string;

        if (path.endsWith('.html')) {
          // Export as HTML with styling
          const htmlContent = parseMarkdown(note.content);
          content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title || 'Untitled'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
    h1, h2, h3, h4 { margin-top: 1.5em; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    a { color: #0066cc; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f9f9f9; }
    .task { list-style: none; margin-left: -20px; }
    .task input { margin-right: 8px; }
  </style>
</head>
<body>
  <h1>${note.title || 'Untitled'}</h1>
  ${htmlContent}
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    Exported from Viny on ${new Date().toLocaleDateString()}
  </footer>
</body>
</html>`;
        } else {
          // Export as Markdown or plain text
          content = `# ${note.title || 'Untitled'}\n\n${note.content}`;
        }

        await writeTextFile(path, content);
        toast.success('Note exported successfully');
      }
    } catch (err) {
      toast.error('Failed to export note');
      console.error(err);
    }
  }

  function exportToPDF() {
    const note = notesStore.selectedNote;
    if (!note) return;

    const htmlContent = parseMarkdown(note.content);
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
          @page { margin: 1in; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 100%;
            margin: 0;
            padding: 0;
            line-height: 1.8;
            color: #1a1a1a;
            font-size: 12pt;
          }
          h1 { font-size: 24pt; margin-bottom: 0.5em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
          h2 { font-size: 18pt; margin-top: 1.5em; }
          h3 { font-size: 14pt; margin-top: 1.2em; }
          p { margin: 1em 0; }
          code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 10pt; font-family: 'Courier New', monospace; }
          pre { background: #f5f5f5; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 10pt; }
          pre code { background: none; padding: 0; }
          blockquote { border-left: 3px solid #666; margin: 1em 0; padding-left: 16px; color: #444; font-style: italic; }
          table { border-collapse: collapse; width: 100%; margin: 1em 0; }
          th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          ul, ol { margin: 1em 0; padding-left: 2em; }
          li { margin: 0.5em 0; }
          .task { list-style: none; }
          .task input { margin-right: 8px; }
          a { color: #0066cc; text-decoration: none; }
          img { max-width: 100%; height: auto; }
          hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
          .meta { font-size: 10pt; color: #666; margin-bottom: 2em; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>${note.title || 'Untitled'}</h1>
        <div class="meta">
          ${new Date(note.updated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          · ${wordCount} words
        </div>
        ${htmlContent}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    toast.success('Opening print dialog...');
  }

  function exportToHTML() {
    const note = notesStore.selectedNote;
    if (!note) return;

    const htmlContent = parseMarkdown(note.content);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title || 'Untitled'}</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1a1a1a;
      --text-secondary: #666;
      --accent: #0066cc;
      --border: #e0e0e0;
      --code-bg: #f5f5f5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1a1a1a;
        --text: #e0e0e0;
        --text-secondary: #999;
        --accent: #66b3ff;
        --border: #333;
        --code-bg: #2d2d2d;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px;
      line-height: 1.8;
      color: var(--text);
      background: var(--bg);
      font-size: 16px;
    }
    h1 {
      font-size: 2.5em;
      font-weight: 700;
      margin: 0 0 16px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    h2 { font-size: 1.8em; font-weight: 600; margin: 1.5em 0 0.5em; }
    h3 { font-size: 1.4em; font-weight: 600; margin: 1.2em 0 0.5em; }
    h4 { font-size: 1.2em; font-weight: 600; margin: 1em 0 0.5em; }
    p { margin: 1em 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
    }
    pre {
      background: var(--code-bg);
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 14px;
      line-height: 1.5;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--accent);
      margin: 1.5em 0;
      padding: 12px 20px;
      background: var(--code-bg);
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: var(--text-secondary);
    }
    blockquote p { margin: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th { background: var(--code-bg); font-weight: 600; }
    ul, ol { margin: 1em 0; padding-left: 1.5em; }
    li { margin: 0.5em 0; }
    input[type="checkbox"] { margin-right: 8px; }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1.5em 0;
    }
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2em 0;
    }
    .meta {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }
  </style>
</head>
<body>
  <article>
    <h1>${note.title || 'Untitled'}</h1>
    <div class="meta">
      ${new Date(note.updated_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      · ${wordCount} words
      · ${advancedStats().readingTime} min read
    </div>
    ${htmlContent}
  </article>
  <footer class="footer">
    Exported from VINY · ${new Date().toLocaleDateString()}
  </footer>
</body>
</html>`;

    // Create download link
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.title || 'Untitled'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('HTML exported successfully');
  }

  async function handleNotebookChange(e: Event) {
    const notebookId = (e.target as HTMLSelectElement).value || null;
    const note = notesStore.selectedNote;
    if (note) {
      await notesStore.updateNote(note.id, {
        title: null,
        content: null,
        notebook_id: notebookId,
        tags: null,
        status: null,
        is_pinned: null,
      });
    }
  }

  function handlePreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('note-link')) {
      e.preventDefault();
      const noteTitle = target.dataset.noteTitle;
      if (noteTitle) {
        // Find note by title
        const linkedNote = notesStore.notes.find(
          n => n.title.toLowerCase() === noteTitle.toLowerCase()
        );
        if (linkedNote) {
          notesStore.selectNote(linkedNote.id);
          toast.info(`Opened: ${linkedNote.title}`);
        } else {
          // Offer to create the note
          createLinkedNote(noteTitle);
        }
      }
    }
  }

  function handleLinkMouseEnter(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('note-link')) return;

    const noteTitle = target.dataset.noteTitle;
    if (!noteTitle) return;

    // Clear any existing timeout
    if (linkPreviewTimeout) {
      clearTimeout(linkPreviewTimeout);
    }

    // Delay showing preview to avoid flickering
    linkPreviewTimeout = setTimeout(() => {
      const linkedNote = notesStore.notes.find(
        n => n.title.toLowerCase() === noteTitle.toLowerCase()
      );

      if (linkedNote) {
        const rect = target.getBoundingClientRect();
        linkPreviewNote = {
          title: linkedNote.title,
          content: linkedNote.content,
          updated_at: linkedNote.updated_at
        };
        linkPreviewPosition = {
          x: rect.left,
          y: rect.bottom + 8
        };
        showLinkPreview = true;
      }
    }, 300);
  }

  function handleLinkMouseLeave() {
    if (linkPreviewTimeout) {
      clearTimeout(linkPreviewTimeout);
      linkPreviewTimeout = null;
    }
    showLinkPreview = false;
    linkPreviewNote = null;
  }

  async function createLinkedNote(title: string) {
    try {
      const newNote = await notesStore.createNote({ title, content: '' });
      notesStore.selectNote(newNote.id);
      toast.success(`Created: ${title}`);
    } catch (err) {
      toast.error('Failed to create linked note');
    }
  }

  function goToLine(lineNumber: number) {
    if (!contentArea) return;

    const lines = contentArea.value.split('\n');
    let charIndex = 0;

    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      charIndex += lines[i].length + 1; // +1 for the newline character
    }

    contentArea.focus();
    contentArea.setSelectionRange(charIndex, charIndex);

    // Scroll to the line
    const lineHeight = parseInt(getComputedStyle(contentArea).lineHeight) || 24;
    const scrollTop = (lineNumber - 1) * lineHeight;
    contentArea.scrollTop = scrollTop - contentArea.clientHeight / 3;
  }

  function navigateToHeading(heading: { level: number; text: string; line: number }) {
    activeTOCHeading = heading.text;

    if (viewMode === 'edit') {
      goToLine(heading.line);
    } else if (viewMode === 'preview' || viewMode === 'split' || viewMode === 'split-horizontal') {
      // Scroll to heading in preview
      const slug = heading.text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      const element = document.getElementById(slug);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // =========================================================================
  // Formatting Toolbar Functions
  // =========================================================================

  let showFormatBar = $state(true);

  function wrapSelection(before: string, after: string) {
    if (!contentArea) return;

    const start = contentArea.selectionStart;
    const end = contentArea.selectionEnd;
    const text = contentArea.value;
    const selectedText = text.substring(start, end);

    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    contentArea.value = newText;

    // Update the note
    debouncedSave({ content: newText });

    // Set cursor position
    contentArea.focus();
    if (selectedText) {
      contentArea.setSelectionRange(start + before.length, end + before.length);
    } else {
      contentArea.setSelectionRange(start + before.length, start + before.length);
    }

    // Hide selection toolbar after action
    showSelectionToolbar = false;
  }

  function handleTextSelection() {
    if (!contentArea) return;

    const start = contentArea.selectionStart;
    const end = contentArea.selectionEnd;
    const selectedText = contentArea.value.substring(start, end);

    if (selectedText.length > 0) {
      // Get cursor position for toolbar placement
      const rect = contentArea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(contentArea).lineHeight) || 24;
      const lines = contentArea.value.substring(0, start).split('\n');
      const currentLine = lines.length - 1;

      // Calculate approximate position
      selectionToolbarX = rect.left + 100; // Center-ish
      selectionToolbarY = rect.top + (currentLine * lineHeight) - contentArea.scrollTop - 40;

      // Clamp to viewport
      selectionToolbarX = Math.max(100, Math.min(selectionToolbarX, window.innerWidth - 300));
      selectionToolbarY = Math.max(60, selectionToolbarY);

      selectedTextLength = selectedText.length;
      showSelectionToolbar = true;
    } else {
      showSelectionToolbar = false;
    }
  }

  function makeLink() {
    if (!contentArea) return;
    const start = contentArea.selectionStart;
    const end = contentArea.selectionEnd;
    const selectedText = contentArea.value.substring(start, end);

    if (selectedText) {
      wrapSelection('[', '](url)');
      // Position cursor on "url"
      setTimeout(() => {
        contentArea.setSelectionRange(end + 3, end + 6);
      }, 0);
    }
  }

  function makeNoteLink() {
    if (!contentArea) return;
    wrapSelection('[[', ']]');
  }

  function insertAtCursor(text: string, cursorOffset: number = 0) {
    if (!contentArea) return;

    const start = contentArea.selectionStart;
    const end = contentArea.selectionEnd;
    const content = contentArea.value;

    const newContent = content.substring(0, start) + text + content.substring(end);
    contentArea.value = newContent;

    debouncedSave({ content: newContent });

    contentArea.focus();
    const newPos = start + text.length + cursorOffset;
    contentArea.setSelectionRange(newPos, newPos);
  }

  function insertLinePrefix(prefix: string) {
    if (!contentArea) return;

    const start = contentArea.selectionStart;
    const text = contentArea.value;

    // Find the start of the current line
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
      lineStart--;
    }

    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    contentArea.value = newText;

    debouncedSave({ content: newText });

    contentArea.focus();
    contentArea.setSelectionRange(start + prefix.length, start + prefix.length);
  }

  function formatBold() { wrapSelection('**', '**'); }
  function formatItalic() { wrapSelection('*', '*'); }
  function formatStrike() { wrapSelection('~~', '~~'); }
  function formatCode() { wrapSelection('`', '`'); }
  function formatCodeBlock() { wrapSelection('\n```\n', '\n```\n'); }
  function formatLink() { wrapSelection('[', '](url)'); }
  function formatH1() { insertLinePrefix('# '); }
  function formatH2() { insertLinePrefix('## '); }
  function formatH3() { insertLinePrefix('### '); }
  function formatQuote() { insertLinePrefix('> '); }
  function formatBullet() { insertLinePrefix('- '); }
  function formatNumbered() { insertLinePrefix('1. '); }
  function formatTask() { insertLinePrefix('- [ ] '); }
  function formatHr() { insertAtCursor('\n---\n'); }
  function formatNoteLink() { wrapSelection('[[', ']]'); }
  function formatTable() {
    insertAtCursor('\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n');
  }

  async function insertImageFromFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
        multiple: false,
      });

      if (path && typeof path === 'string') {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const contents = await readFile(path);
        const fileName = path.split('/').pop() || 'image';
        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';

        // Determine MIME type
        const mimeTypes: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
        };
        const mimeType = mimeTypes[ext] || 'image/png';

        // Convert to base64
        const base64 = btoa(String.fromCharCode(...contents));
        const dataUri = `data:${mimeType};base64,${base64}`;

        const markdownImage = `![${fileName}](${dataUri})`;
        insertAtCursor(markdownImage);
        toast.success('Image inserted');
      }
    } catch (err) {
      toast.error('Failed to insert image');
      console.error(err);
    }
  }

  function handleEditorKeydown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Handle link suggestions navigation
    if (showLinkSuggestions) {
      const suggestions = linkSuggestions();
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          linkSuggestionIndex = Math.min(linkSuggestionIndex + 1, suggestions.length - 1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          linkSuggestionIndex = Math.max(linkSuggestionIndex - 1, 0);
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[linkSuggestionIndex]) {
            insertNoteLinkFromSuggestion(suggestions[linkSuggestionIndex].title);
          }
          return;
        case 'Escape':
          e.preventDefault();
          closeLinkSuggestions();
          return;
      }
    }

    // Handle emoji suggestions navigation
    if (showEmojiSuggestions) {
      const suggestions = emojiSuggestions();
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          emojiSuggestionIndex = Math.min(emojiSuggestionIndex + 1, suggestions.length - 1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          emojiSuggestionIndex = Math.max(emojiSuggestionIndex - 1, 0);
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[emojiSuggestionIndex]) {
            insertEmoji(suggestions[emojiSuggestionIndex].emoji);
          }
          return;
        case 'Escape':
          e.preventDefault();
          closeEmojiSuggestions();
          return;
      }
    }

    // Handle snippet suggestions navigation
    if (showSnippetSuggestions) {
      const suggestions = snippetSuggestions();
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          snippetSuggestionIndex = Math.min(snippetSuggestionIndex + 1, suggestions.length - 1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          snippetSuggestionIndex = Math.max(snippetSuggestionIndex - 1, 0);
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[snippetSuggestionIndex]) {
            insertSnippet(suggestions[snippetSuggestionIndex]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          closeSnippetSuggestions();
          return;
      }
    }

    if (mod && !e.shiftKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          formatBold();
          break;
        case 'i':
          e.preventDefault();
          formatItalic();
          break;
        case 'e':
          e.preventDefault();
          formatCode();
          break;
        case 'l':
          e.preventDefault();
          formatLink();
          break;
      }
    }

    if (mod && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          formatStrike();
          break;
        case 'k':
          e.preventDefault();
          formatCodeBlock();
          break;
        case 'f':
          e.preventDefault();
          toggleFindReplace();
          break;
        case 'h':
          if (e.shiftKey) {
            e.preventDefault();
            replaceAll();
          } else {
            e.preventDefault();
            replaceCurrent();
          }
          break;
      }
    }

    // Escape closes find/replace
    if (e.key === 'Escape' && showFindReplace) {
      e.preventDefault();
      closeFindReplace();
    }

    // Enter in find mode goes to next match
    if (e.key === 'Enter' && showFindReplace && !e.shiftKey) {
      e.preventDefault();
      findNext();
    }
    if (e.key === 'Enter' && showFindReplace && e.shiftKey) {
      e.preventDefault();
      findPrevious();
    }
  }

  function handleContentInput(e: Event) {
    handleContentChange(e);
    checkForLinkTrigger();
    checkForEmojiTrigger();
    checkForSnippetTrigger();

    // Track words written for daily stats
    const currentWords = wordCount;
    if (currentWords > previousWordCount) {
      addWordsWritten(currentWords - previousWordCount);
    }
    previousWordCount = currentWords;

    // Update typing indicator
    isTyping = true;
    lastTypingTime = new Date();
    recentKeystrokeCount++;

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      recentKeystrokeCount = 0;
    }, 1500); // Stop typing indicator after 1.5s of inactivity
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleImageFile(file);
        }
        return;
      }
    }
  }

  async function handleDrop(e: DragEvent) {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        await handleImageFile(file);
        return;
      }
    }
  }

  async function handleImageFile(file: File) {
    try {
      // Convert to base64 for simplicity (could also save to app data directory)
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const fileName = file.name || `image_${Date.now()}`;

        // For now, embed as base64 data URI
        // In production, you'd want to save to a local attachments folder
        const markdownImage = `![${fileName}](${base64})`;

        insertAtCursor(markdownImage);
        toast.success('Image inserted');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to insert image');
      console.error(err);
    }
  }

  function handleEditorDragOver(e: DragEvent) {
    // Check if dragging files
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      isDraggingFile = true;
    }
  }

  function handleEditorDragLeave(e: DragEvent) {
    // Only set to false if leaving the container (not entering a child element)
    const relatedTarget = e.relatedTarget as Node;
    const container = e.currentTarget as HTMLElement;
    if (!container.contains(relatedTarget)) {
      isDraggingFile = false;
    }
  }

  function handleEditorDrop(e: DragEvent) {
    isDraggingFile = false;
    handleDrop(e);
  }

  function checkForLinkTrigger() {
    if (!contentArea) return;

    const cursorPos = contentArea.selectionStart;
    const text = contentArea.value;

    // Look for [[ before cursor
    const beforeCursor = text.substring(0, cursorPos);
    const lastDoubleBracket = beforeCursor.lastIndexOf('[[');

    if (lastDoubleBracket !== -1) {
      // Check if there's no closing ]] between [[ and cursor
      const textAfterBracket = beforeCursor.substring(lastDoubleBracket + 2);
      if (!textAfterBracket.includes(']]')) {
        linkQuery = textAfterBracket;
        linkInsertPosition = lastDoubleBracket;
        linkSuggestionIndex = 0;
        showLinkSuggestions = true;
        return;
      }
    }

    closeLinkSuggestions();
  }

  function closeLinkSuggestions() {
    showLinkSuggestions = false;
    linkQuery = '';
    linkSuggestionIndex = 0;
  }

  function insertNoteLinkFromSuggestion(title: string) {
    if (!contentArea) return;

    const text = contentArea.value;
    const cursorPos = contentArea.selectionStart;

    // Replace from [[ to current cursor with [[title]]
    const newText = text.substring(0, linkInsertPosition) + '[[' + title + ']]' + text.substring(cursorPos);
    contentArea.value = newText;

    // Update note
    debouncedSave({ content: newText });

    // Move cursor after the inserted link
    const newCursorPos = linkInsertPosition + title.length + 4; // [[ + title + ]]
    contentArea.focus();
    contentArea.setSelectionRange(newCursorPos, newCursorPos);

    closeLinkSuggestions();
  }

  function selectLinkSuggestion(title: string) {
    insertNoteLinkFromSuggestion(title);
  }

  // Emoji autocomplete functions
  function checkForEmojiTrigger() {
    if (!contentArea) return;

    const cursorPos = contentArea.selectionStart;
    const text = contentArea.value;

    // Look for : before cursor (but not ::)
    const beforeCursor = text.substring(0, cursorPos);
    const lastColon = beforeCursor.lastIndexOf(':');

    if (lastColon !== -1) {
      // Check this isn't a double colon or start of line colon
      const charBefore = lastColon > 0 ? beforeCursor[lastColon - 1] : ' ';
      const textAfterColon = beforeCursor.substring(lastColon + 1);

      // Only trigger if:
      // - There's a space or start before the colon
      // - The text after colon is alphanumeric/underscore (emoji shortcode chars)
      // - No spaces in the query
      if ((charBefore === ' ' || charBefore === '\n' || lastColon === 0) &&
          /^[a-zA-Z0-9_]*$/.test(textAfterColon) &&
          textAfterColon.length > 0 &&
          textAfterColon.length < 20) {
        emojiQuery = textAfterColon;
        emojiInsertPosition = lastColon;
        emojiSuggestionIndex = 0;
        showEmojiSuggestions = true;
        return;
      }
    }

    closeEmojiSuggestions();
  }

  function closeEmojiSuggestions() {
    showEmojiSuggestions = false;
    emojiQuery = '';
    emojiSuggestionIndex = 0;
  }

  function insertEmoji(emoji: string) {
    if (!contentArea) return;

    const text = contentArea.value;
    const cursorPos = contentArea.selectionStart;

    // Replace from : to current cursor with the emoji
    const newText = text.substring(0, emojiInsertPosition) + emoji + text.substring(cursorPos);
    contentArea.value = newText;

    // Update note
    debouncedSave({ content: newText });

    // Move cursor after the inserted emoji
    const newCursorPos = emojiInsertPosition + emoji.length;
    contentArea.focus();
    contentArea.setSelectionRange(newCursorPos, newCursorPos);

    closeEmojiSuggestions();
  }

  function selectEmojiSuggestion(emoji: string) {
    insertEmoji(emoji);
  }

  // Snippet autocomplete functions
  function checkForSnippetTrigger() {
    if (!contentArea) return;

    const cursorPos = contentArea.selectionStart;
    const text = contentArea.value;

    // Look for / at start of line or after space
    const beforeCursor = text.substring(0, cursorPos);
    const lastSlash = beforeCursor.lastIndexOf('/');

    if (lastSlash !== -1) {
      const charBefore = lastSlash > 0 ? beforeCursor[lastSlash - 1] : '\n';
      const textAfterSlash = beforeCursor.substring(lastSlash + 1);

      // Only trigger if:
      // - Slash is at start of line or after space/newline
      // - Text after slash is alphanumeric
      // - No spaces in the query
      if ((charBefore === ' ' || charBefore === '\n' || lastSlash === 0) &&
          /^[a-zA-Z0-9]*$/.test(textAfterSlash) &&
          textAfterSlash.length < 20) {
        snippetQuery = textAfterSlash;
        snippetInsertPosition = lastSlash;
        snippetSuggestionIndex = 0;
        showSnippetSuggestions = true;
        return;
      }
    }

    closeSnippetSuggestions();
  }

  function closeSnippetSuggestions() {
    showSnippetSuggestions = false;
    snippetQuery = '';
    snippetSuggestionIndex = 0;
  }

  function insertSnippet(snippet: Snippet) {
    if (!contentArea) return;

    const text = contentArea.value;
    const cursorPos = contentArea.selectionStart;
    const content = getSnippetContent(snippet);

    // Replace from / to current cursor with the snippet content
    const newText = text.substring(0, snippetInsertPosition) + content + text.substring(cursorPos);
    contentArea.value = newText;

    // Update note
    debouncedSave({ content: newText });

    // Move cursor to end of snippet (or inside if it's a template)
    const newCursorPos = snippetInsertPosition + content.length;
    contentArea.focus();
    contentArea.setSelectionRange(newCursorPos, newCursorPos);

    closeSnippetSuggestions();
    toast.success(`Inserted: ${snippet.name}`);
  }

  function selectSnippetSuggestion(snippet: Snippet) {
    insertSnippet(snippet);
  }

  function updateCursorPosition() {
    if (!contentArea) return;

    const text = contentArea.value;
    const cursorPos = contentArea.selectionStart;

    // Count lines before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    cursorLine = linesBeforeCursor.length;

    // Column is position in current line
    cursorColumn = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1;

    // Total lines
    totalLines = text.split('\n').length;
  }

  function handleCursorChange() {
    updateCursorPosition();
    if (zenMode || typewriterMode) {
      typewriterScroll();
    }
    if (focusParagraphMode) {
      updateCurrentParagraph();
    }
  }

  function updateCurrentParagraph() {
    if (!contentArea) return;

    const text = contentArea.value;
    const cursorPos = contentArea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Split by empty lines (paragraph breaks)
    const paragraphs = textBeforeCursor.split(/\n\s*\n/);
    currentParagraphIndex = paragraphs.length - 1;
  }

  function handleReadingScroll() {
    if (!readingModeContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = readingModeContainer;
    const maxScroll = scrollHeight - clientHeight;
    readingProgress = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * 100) : 100;
  }

  // Scroll sync functions
  function handleEditorScroll() {
    if (!scrollSyncEnabled || isScrollingPreview || !contentArea || !previewArea) return;
    if (viewMode !== 'split' && viewMode !== 'split-horizontal') return;

    isScrollingEditor = true;
    const editorScrollPercent = contentArea.scrollTop / (contentArea.scrollHeight - contentArea.clientHeight);
    const previewMaxScroll = previewArea.scrollHeight - previewArea.clientHeight;
    previewArea.scrollTop = editorScrollPercent * previewMaxScroll;

    setTimeout(() => isScrollingEditor = false, 50);
  }

  function handlePreviewScroll() {
    if (!scrollSyncEnabled || isScrollingEditor || !contentArea || !previewArea) return;
    if (viewMode !== 'split' && viewMode !== 'split-horizontal') return;

    isScrollingPreview = true;
    const previewScrollPercent = previewArea.scrollTop / (previewArea.scrollHeight - previewArea.clientHeight);
    const editorMaxScroll = contentArea.scrollHeight - contentArea.clientHeight;
    contentArea.scrollTop = previewScrollPercent * editorMaxScroll;

    setTimeout(() => isScrollingPreview = false, 50);
  }

  function nextSlide() {
    const slides = presentationSlides();
    if (currentSlide < slides.length - 1) {
      currentSlide++;
    }
  }

  function prevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
    }
  }

  function handlePresentationKeydown(e: KeyboardEvent) {
    if (viewMode !== 'presentation') return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'Enter':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        currentSlide = 0;
        break;
      case 'End':
        e.preventDefault();
        currentSlide = presentationSlides().length - 1;
        break;
      case 'Escape':
        e.preventDefault();
        viewMode = 'edit';
        break;
    }
  }

  function toggleZenMode() {
    zenMode = !zenMode;
    if (zenMode) {
      viewMode = 'edit';
      showFormatBar = false;
      showAmbientPanel = true;
      toast.success('Zen mode on - Press Esc to exit');
    } else {
      stopAmbientSound();
      ambientSoundId = 'none';
      showAmbientPanel = false;
      toast.success('Zen mode off');
    }
  }

  function selectAmbientSound(soundId: string) {
    ambientSoundId = soundId;
    if (soundId === 'none') {
      stopAmbientSound();
    } else {
      playAmbientSound(soundId, ambientVolume);
    }
  }

  function handleVolumeChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    ambientVolume = value;
    setAmbientVolume(value);
  }

  function selectLofiStation(stationId: string) {
    lofiStationId = stationId;
    if (stationId === 'none') {
      stopLofiStation();
    } else {
      playLofiStation(stationId, lofiVolume);
    }
  }

  function handleLofiVolumeChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    lofiVolume = value;
    setLofiVolume(value);
  }

  // Voice dictation functions
  function toggleDictation() {
    if (!dictationSupported) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }

    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  }

  function startDictation() {
    if (!contentArea) return;

    const started = speechRecognition.start({
      language: dictationLanguage,
      onStart: () => {
        isDictating = true;
        interimTranscript = '';
        toast.success('🎤 Listening... Speak now');
      },
      onEnd: () => {
        isDictating = false;
        interimTranscript = '';
      },
      onResult: (result) => {
        if (result.isFinal) {
          // Insert final text at cursor position
          insertTextAtCursor(result.transcript + ' ');
          interimTranscript = '';
        } else {
          // Show interim results
          interimTranscript = result.transcript;
        }
      },
      onError: (error) => {
        isDictating = false;
        interimTranscript = '';
        toast.error(error);
      },
    });

    if (!started) {
      toast.error('Failed to start dictation');
    }
  }

  function stopDictation() {
    speechRecognition.stop();
    isDictating = false;
    interimTranscript = '';
    toast.info('Dictation stopped');
  }

  function insertTextAtCursor(text: string) {
    if (!contentArea || !notesStore.selectedNote) return;

    const start = contentArea.selectionStart;
    const end = contentArea.selectionEnd;
    const currentContent = notesStore.selectedNote.content;

    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);

    notesStore.updateNote(notesStore.selectedNote.id, {
      title: null,
      content: newContent,
      notebook_id: null,
      tags: null,
      status: null,
      is_pinned: null,
    });

    // Move cursor to end of inserted text
    setTimeout(() => {
      if (contentArea) {
        const newPosition = start + text.length;
        contentArea.selectionStart = newPosition;
        contentArea.selectionEnd = newPosition;
        contentArea.focus();
      }
    }, 0);
  }

  function changeDictationLanguage(langCode: string) {
    dictationLanguage = langCode;
    setSpeechLanguage(langCode);
    speechRecognition.updateLanguage(langCode);
  }

  function typewriterScroll() {
    if (!contentArea || (!zenMode && !typewriterMode)) return;

    // Get the current line position and scroll to keep it centered
    const lineHeight = parseInt(getComputedStyle(contentArea).lineHeight) || 24;
    const viewportHeight = contentArea.clientHeight;
    const currentLineTop = (cursorLine - 1) * lineHeight;
    const targetScroll = currentLineTop - (viewportHeight / 2) + lineHeight;

    contentArea.scrollTop = Math.max(0, targetScroll);
  }

  // Navigate to a specific line (used by outline panel)
  function navigateToLine(lineNumber: number) {
    if (!contentArea) return;

    const note = notesStore.selectedNote;
    if (!note) return;

    // Find the position of the line in the content
    const lines = note.content.split('\n');
    let position = 0;
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      position += lines[i].length + 1; // +1 for newline
    }

    // Set cursor position
    contentArea.focus();
    contentArea.setSelectionRange(position, position);

    // Scroll to make the line visible
    const lineHeight = parseInt(getComputedStyle(contentArea).lineHeight) || 24;
    const targetScroll = (lineNumber - 1) * lineHeight - contentArea.clientHeight / 3;
    contentArea.scrollTop = Math.max(0, targetScroll);

    // Close outline panel after navigation
    showOutline = false;
  }

  function handleZenKeydown(e: KeyboardEvent) {
    if (zenMode && e.key === 'Escape') {
      e.preventDefault();
      toggleZenMode();
    }
  }

  // Context menu functions
  function handlePreviewContextMenu(e: MouseEvent) {
    e.preventDefault();

    // Get selected text
    const selection = window.getSelection();
    selectedText = selection?.toString() || '';

    // Position the menu
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    showContextMenu = true;
  }

  function closeContextMenu() {
    showContextMenu = false;
  }

  async function contextCopyText() {
    if (selectedText) {
      await navigator.clipboard.writeText(selectedText);
      toast.success('Copied to clipboard');
    }
    closeContextMenu();
  }

  async function contextCopyAsMarkdown() {
    const note = notesStore.selectedNote;
    if (!note) return;

    const content = selectedText || note.content;
    await navigator.clipboard.writeText(content);
    toast.success('Copied as Markdown');
    closeContextMenu();
  }

  async function contextCopyAll() {
    const note = notesStore.selectedNote;
    if (!note) return;

    const content = `# ${note.title || 'Untitled'}\n\n${note.content}`;
    await navigator.clipboard.writeText(content);
    toast.success('Copied entire note');
    closeContextMenu();
  }

  function contextSearchInNote() {
    if (selectedText && contentArea) {
      // Switch to edit mode and search for the text
      viewMode = 'edit';
      setTimeout(() => {
        if (contentArea) {
          const index = contentArea.value.toLowerCase().indexOf(selectedText.toLowerCase());
          if (index !== -1) {
            contentArea.focus();
            contentArea.setSelectionRange(index, index + selectedText.length);
          }
        }
      }, 100);
    }
    closeContextMenu();
  }

  async function contextCreateNoteFromSelection() {
    if (!selectedText) {
      closeContextMenu();
      return;
    }

    try {
      // Use first line or first 50 chars as title
      const lines = selectedText.split('\n');
      const title = lines[0].replace(/^#*\s*/, '').slice(0, 50) || 'New Note';
      const content = selectedText;

      const newNote = await notesStore.createNote({ title, content });
      toast.success(`Created: ${title}`);

      // Optionally link to the new note
      // notesStore.selectNote(newNote.id);
    } catch (err) {
      toast.error('Failed to create note');
    }
    closeContextMenu();
  }

  function contextLinkSelection() {
    if (!selectedText || !contentArea) {
      closeContextMenu();
      return;
    }

    // Switch to edit mode and wrap selection with link syntax
    viewMode = 'edit';
    setTimeout(() => {
      if (contentArea) {
        const index = contentArea.value.indexOf(selectedText);
        if (index !== -1) {
          contentArea.focus();
          contentArea.setSelectionRange(index, index + selectedText.length);
          wrapSelection('[[', ']]');
        }
      }
    }, 100);
    closeContextMenu();
  }

  async function contextDefineWord() {
    if (!selectedText) {
      closeContextMenu();
      return;
    }

    // Get the first word if multiple selected
    const word = selectedText.trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (!word) {
      toast.error('Please select a valid word');
      closeContextMenu();
      return;
    }

    definitionWord = word;
    definitionData = null;
    definitionError = null;
    definitionLoading = true;
    showDefinitionModal = true;
    closeContextMenu();

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);

      if (!response.ok) {
        if (response.status === 404) {
          definitionError = `No definition found for "${word}"`;
        } else {
          definitionError = 'Failed to fetch definition';
        }
        return;
      }

      const data = await response.json();
      if (data && data.length > 0) {
        definitionData = data[0];
      } else {
        definitionError = `No definition found for "${word}"`;
      }
    } catch (err) {
      definitionError = 'Network error. Please check your connection.';
    } finally {
      definitionLoading = false;
    }
  }

  function playPronunciation() {
    if (!definitionData) return;

    // Find the first audio URL
    const audioUrl = definitionData.phonetics?.find(p => p.audio)?.audio;
    if (!audioUrl) {
      toast.info('No audio pronunciation available');
      return;
    }

    if (definitionAudio) {
      definitionAudio.pause();
    }
    definitionAudio = new Audio(audioUrl);
    definitionAudio.play().catch(() => {
      toast.error('Could not play pronunciation');
    });
  }

  function closeDefinitionModal() {
    showDefinitionModal = false;
    definitionWord = '';
    definitionData = null;
    definitionError = null;
    if (definitionAudio) {
      definitionAudio.pause();
      definitionAudio = null;
    }
  }

  function insertDefinitionToNote() {
    if (!definitionData || !contentArea) return;

    const note = notesStore.selectedNote;
    if (!note) return;

    // Format definition as markdown
    let text = `\n\n---\n\n**${definitionData.word}**`;
    if (definitionData.phonetic) {
      text += ` _${definitionData.phonetic}_`;
    }
    text += '\n\n';

    definitionData.meanings.forEach(meaning => {
      text += `**${meaning.partOfSpeech}**\n`;
      meaning.definitions.slice(0, 2).forEach((def, i) => {
        text += `${i + 1}. ${def.definition}\n`;
        if (def.example) {
          text += `   > "${def.example}"\n`;
        }
      });
      text += '\n';
    });

    // Insert at cursor or end
    viewMode = 'edit';
    setTimeout(() => {
      if (contentArea) {
        const cursorPos = contentArea.selectionEnd;
        const currentContent = contentArea.value;
        const newContent = currentContent.slice(0, cursorPos) + text + currentContent.slice(cursorPos);
        contentArea.value = newContent;
        debouncedSave({ content: newContent });
        toast.success('Definition added to note');
      }
    }, 100);

    closeDefinitionModal();
  }

  // Close context menu when clicking elsewhere
  function handleDocumentClick(e: MouseEvent) {
    if (showContextMenu) {
      closeContextMenu();
    }
  }

  // Find and replace functions
  function toggleFindReplace() {
    showFindReplace = !showFindReplace;
    if (showFindReplace) {
      // If there's selected text, use it as the search query
      if (contentArea) {
        const selected = contentArea.value.substring(
          contentArea.selectionStart,
          contentArea.selectionEnd
        );
        if (selected) {
          findQuery = selected;
        }
      }
      updateFindMatches();
    }
  }

  function updateFindMatches() {
    if (!findQuery || !contentArea) {
      totalMatches = 0;
      currentMatchIndex = 0;
      regexError = null;
      replacePreview = null;
      return;
    }

    const text = contentArea.value;
    let pattern: RegExp;

    try {
      if (findRegex) {
        pattern = new RegExp(findQuery, findCaseSensitive ? 'g' : 'gi');
      } else {
        let escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (findWholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, findCaseSensitive ? 'g' : 'gi');
      }

      const matches = [...text.matchAll(pattern)];
      totalMatches = matches.length;
      regexError = null;

      if (totalMatches > 0 && currentMatchIndex >= totalMatches) {
        currentMatchIndex = 0;
      }

      // Generate replace preview for current match
      if (totalMatches > 0 && replaceQuery && matches[currentMatchIndex]) {
        const match = matches[currentMatchIndex];
        if (findRegex) {
          // Support capture groups ($1, $2, etc.)
          replacePreview = match[0].replace(pattern, replaceQuery);
        } else {
          replacePreview = replaceQuery;
        }
      } else {
        replacePreview = null;
      }
    } catch (e) {
      // Invalid regex
      totalMatches = 0;
      regexError = e instanceof Error ? e.message : 'Invalid regex pattern';
      replacePreview = null;
    }
  }

  function findNext() {
    if (totalMatches === 0 || !contentArea) return;

    currentMatchIndex = (currentMatchIndex + 1) % totalMatches;
    highlightCurrentMatch();
  }

  function findPrevious() {
    if (totalMatches === 0 || !contentArea) return;

    currentMatchIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    highlightCurrentMatch();
  }

  function highlightCurrentMatch() {
    if (!contentArea || !findQuery) return;

    const text = contentArea.value;
    let pattern: RegExp;

    try {
      if (findRegex) {
        pattern = new RegExp(findQuery, findCaseSensitive ? 'g' : 'gi');
      } else {
        let escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (findWholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, findCaseSensitive ? 'g' : 'gi');
      }

      const matches = [...text.matchAll(pattern)];
      if (matches[currentMatchIndex]) {
        const match = matches[currentMatchIndex];
        const start = match.index!;
        const end = start + match[0].length;

        contentArea.focus();
        contentArea.setSelectionRange(start, end);

        // Scroll to match
        const lineHeight = parseInt(getComputedStyle(contentArea).lineHeight) || 24;
        const linesBeforeMatch = text.substring(0, start).split('\n').length - 1;
        contentArea.scrollTop = linesBeforeMatch * lineHeight - contentArea.clientHeight / 2;
      }
    } catch (e) {
      // Invalid regex
    }
  }

  function replaceCurrent() {
    if (totalMatches === 0 || !contentArea) return;

    const text = contentArea.value;
    let pattern: RegExp;

    try {
      if (findRegex) {
        pattern = new RegExp(findQuery, findCaseSensitive ? 'g' : 'gi');
      } else {
        let escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (findWholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, findCaseSensitive ? 'g' : 'gi');
      }

      const matches = [...text.matchAll(pattern)];
      if (matches[currentMatchIndex]) {
        const match = matches[currentMatchIndex];
        const start = match.index!;
        const end = start + match[0].length;

        // Support capture groups in regex mode
        let replacement = replaceQuery;
        if (findRegex) {
          replacement = match[0].replace(pattern, replaceQuery);
        }

        const newText = text.substring(0, start) + replacement + text.substring(end);
        contentArea.value = newText;
        debouncedSave({ content: newText });

        // Update matches
        updateFindMatches();

        // Move to next match or stay at current index
        if (totalMatches > 0) {
          highlightCurrentMatch();
        }

        toast.success('Replaced');
      }
    } catch (e) {
      toast.error('Invalid search pattern');
    }
  }

  function replaceAll() {
    if (totalMatches === 0 || !contentArea) return;

    const text = contentArea.value;
    let pattern: RegExp;

    try {
      if (findRegex) {
        pattern = new RegExp(findQuery, findCaseSensitive ? 'g' : 'gi');
      } else {
        let escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (findWholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, findCaseSensitive ? 'g' : 'gi');
      }

      const count = totalMatches;
      const newText = text.replace(pattern, replaceQuery);
      contentArea.value = newText;
      debouncedSave({ content: newText });

      // Update matches
      updateFindMatches();

      toast.success(`Replaced ${count} occurrences`);
    } catch (e) {
      toast.error('Invalid search pattern');
    }
  }

  function closeFindReplace() {
    // Save to history before closing
    if (findQuery.trim()) {
      saveToSearchHistory(findQuery, findRegex);
    }
    showFindReplace = false;
    showSearchHistory = false;
    showRegexHelp = false;
    findQuery = '';
    replaceQuery = '';
    totalMatches = 0;
    currentMatchIndex = 0;
  }

  // Watch for find query changes
  $effect(() => {
    if (showFindReplace) {
      updateFindMatches();
    }
  });

  // Track note changes for writing stats
  let lastTrackedNoteId = $state<string | null>(null);
  $effect(() => {
    const noteId = notesStore.selectedNoteId;
    if (noteId && noteId !== lastTrackedNoteId) {
      // Reset unsaved changes indicator when switching notes
      hasUnsavedChanges = false;
      // Initialize word count for tracking
      previousWordCount = wordCount;
      // Track that a note was edited
      if (lastTrackedNoteId !== null) {
        incrementNotesEdited();
      }
      lastTrackedNoteId = noteId;
    }
  });
</script>

<svelte:document onclick={handleDocumentClick} onkeydown={handlePresentationKeydown} />

<div class="editor" class:zen-mode={zenMode} class:presentation-active={viewMode === 'presentation'} role="main" aria-label="Note editor" onkeydown={handleZenKeydown}>
  <!-- Ambient Sound Panel (Zen Mode) -->
  {#if zenMode && showAmbientPanel}
    <div class="ambient-panel">
      <div class="ambient-header">
        <span class="ambient-title">Ambient Sounds</span>
        <button class="ambient-close" onclick={() => showAmbientPanel = false}><X size={14} /></button>
      </div>
      <div class="ambient-sounds">
        {#each ambientSounds as sound}
          <button
            class="ambient-sound-btn"
            class:active={ambientSoundId === sound.id}
            onclick={() => selectAmbientSound(sound.id)}
            title={sound.name}
          >
            <span class="sound-icon">{sound.icon}</span>
            <span class="sound-name">{sound.name}</span>
          </button>
        {/each}
      </div>
      {#if ambientSoundId !== 'none'}
        <div class="ambient-volume">
          <span class="volume-icon">Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ambientVolume}
            oninput={handleVolumeChange}
            class="volume-slider"
          />
        </div>
      {/if}

      <!-- Lo-fi Music Section -->
      <div class="lofi-section">
        <div class="lofi-header">
          <span class="lofi-title">Lo-fi Music</span>
        </div>
        <div class="lofi-stations">
          {#each lofiStations as station}
            <button
              class="lofi-station-btn"
              class:active={lofiStationId === station.id}
              onclick={() => selectLofiStation(station.id)}
              title={station.description}
            >
              <span class="station-icon">{station.icon}</span>
              <span class="station-name">{station.name}</span>
            </button>
          {/each}
        </div>
        {#if lofiStationId !== 'none'}
          <div class="lofi-volume">
            <span class="volume-icon">🎶</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={lofiVolume}
              oninput={handleLofiVolumeChange}
              class="volume-slider"
            />
          </div>
          <div class="lofi-playing">
            <span class="playing-indicator"></span>
            <span class="playing-text">Playing: {lofiStations.find(s => s.id === lofiStationId)?.name}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if notesStore.selectedNote}
    {@const note = notesStore.selectedNote}

    <div class="editor-toolbar" role="toolbar" aria-label="Editor actions">
      <select
        class="notebook-select"
        value={note.notebook_id || ''}
        onchange={handleNotebookChange}
        aria-label="Select notebook"
      >
        <option value="">No notebook</option>
        {#each appStore.notebooks as notebook}
          <option value={notebook.id}>{notebook.name}</option>
        {/each}
      </select>

      <div class="view-toggle" role="group" aria-label="View mode">
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
          title="Split view (vertical)"
        >
          ⬓
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'split-horizontal'}
          onclick={() => viewMode = 'split-horizontal'}
          title="Split view (horizontal)"
        >
          ⬒
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'reading'}
          onclick={() => viewMode = 'reading'}
          title="Reading mode"
        >
          Read
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'presentation'}
          onclick={() => { viewMode = 'presentation'; currentSlide = 0; }}
          title="Presentation mode"
        >
          🎬
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'preview'}
          onclick={() => viewMode = 'preview'}
          title="Preview mode"
        >
          Preview
        </button>
        {#if viewMode === 'split' || viewMode === 'split-horizontal'}
          <button
            class="toggle-btn sync-toggle"
            class:active={scrollSyncEnabled}
            onclick={() => scrollSyncEnabled = !scrollSyncEnabled}
            title={scrollSyncEnabled ? 'Scroll sync enabled' : 'Scroll sync disabled'}
          >
            Link
          </button>
        {/if}
      </div>

      <div class="toolbar-actions">
        {#if headings().length > 0}
          <button
            class="toolbar-btn"
            class:active={showOutline}
            onclick={() => showOutline = !showOutline}
            title="Table of contents"
          >
            TOC
          </button>
        {/if}
        <button
          class="toolbar-btn"
          class:active={showBacklinks}
          onclick={() => showBacklinks = !showBacklinks}
          title="Backlinks ({backlinks().length} in, {outgoingLinks().length} out)"
        >
          Link
          {#if backlinks().length > 0}
            <span class="backlink-badge">{backlinks().length}</span>
          {/if}
        </button>
        <button
          class="toolbar-btn"
          class:active={note.is_pinned}
          onclick={togglePin}
          title={note.is_pinned ? 'Unpin' : 'Pin'}
        >
          Pin
        </button>
        <button class="toolbar-btn" onclick={copyToClipboard} title="Copy to clipboard">
          Copy
        </button>
        {#if dictationSupported}
          <div class="dictation-container">
            <button
              class="toolbar-btn"
              class:active={isDictating}
              class:recording={isDictating}
              onclick={toggleDictation}
              title={isDictating ? 'Stop dictation' : 'Start voice dictation'}
            >
              🎤
            </button>
            <button
              class="toolbar-btn dictation-settings"
              onclick={() => showDictationPanel = !showDictationPanel}
              title="Dictation settings"
            >
              ▼
            </button>
            {#if showDictationPanel}
              <div class="dictation-panel">
                <div class="dictation-header">
                  <span class="dictation-title">Voice Dictation</span>
                  <button class="dictation-close" onclick={() => showDictationPanel = false}><X size={14} /></button>
                </div>
                <div class="dictation-language">
                  <label>Language</label>
                  <select
                    value={dictationLanguage}
                    onchange={(e) => changeDictationLanguage((e.target as HTMLSelectElement).value)}
                  >
                    {#each speechLanguages as lang}
                      <option value={lang.code}>{lang.flag} {lang.name}</option>
                    {/each}
                  </select>
                </div>
                <div class="dictation-tips">
                  <p><strong>Voice commands:</strong></p>
                  <ul>
                    <li>"period" → .</li>
                    <li>"comma" → ,</li>
                    <li>"question mark" → ?</li>
                    <li>"new line" → ↵</li>
                    <li>"new paragraph" → ¶¶</li>
                  </ul>
                </div>
              </div>
            {/if}
          </div>
        {/if}
        <button
          class="toolbar-btn"
          class:active={zenMode}
          onclick={toggleZenMode}
          title="Zen mode (distraction-free writing)"
        >
          🧘
        </button>
        <button
          class="toolbar-btn"
          class:active={showPomodoro}
          onclick={() => showPomodoro = !showPomodoro}
          title="Pomodoro timer"
        >
          🍅
        </button>
        <button
          class="toolbar-btn"
          class:active={showFocusMode}
          onclick={() => showFocusMode = !showFocusMode}
          title="Focus mode with timer"
        >
          Focus
        </button>
        <div class="color-picker-container">
          <button
            class="toolbar-btn color-btn"
            class:active={showColorPicker}
            onclick={() => showColorPicker = !showColorPicker}
            title="Note color"
            style="--note-color: {currentNoteColor().accent}"
          >
            <span class="color-dot"></span>
          </button>
          {#if showColorPicker}
            <div class="color-picker-dropdown">
              <div class="color-picker-header">Note Color</div>
              <div class="color-grid">
                {#each NOTE_COLORS as color}
                  <button
                    class="color-option"
                    class:selected={currentNoteColor().id === color.id}
                    style="--color-bg: {color.bg}; --color-border: {color.border}; --color-accent: {color.accent}"
                    onclick={() => handleColorChange(color.id)}
                    title={color.name}
                  >
                    {#if color.id === 'none'}
                      <span class="no-color"><X size={12} /></span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
        <div class="more-menu-container">
          <button
            class="toolbar-btn"
            onclick={() => showMoreMenu = !showMoreMenu}
            title="More actions"
          >
            <MoreHorizontal size={18} />
          </button>
          {#if showMoreMenu}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="more-menu" role="menu" aria-label="More actions" onmouseleave={() => showMoreMenu = false}>
              <button class="menu-item" role="menuitem" onclick={() => { duplicateNote(); showMoreMenu = false; }}>
                <Copy size={16} /> Duplicate
              </button>
              <button class="menu-item" role="menuitem" onclick={() => { showExportModal = true; showMoreMenu = false; }}>
                <Download size={16} /> Export...
              </button>
              <button class="menu-item" role="menuitem" onclick={() => { showExportPDF = true; showMoreMenu = false; }}>
                <FileOutput size={16} /> Export PDF
              </button>
              <button class="menu-item" role="menuitem" onclick={() => { showVersionHistory = true; showMoreMenu = false; }}>
                <Clock size={16} /> Version History
              </button>
              <button class="menu-item" role="menuitem" onclick={() => { showSnippetsManager = true; showMoreMenu = false; }}>
                <Scissors size={16} /> Manage Snippets
              </button>
              <hr class="menu-divider" />
              <button class="menu-item danger" role="menuitem" onclick={() => { confirmDelete(); showMoreMenu = false; }}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Outline Panel -->
    {#if showOutline && headings().length > 0}
      <div class="outline-panel">
        <div class="outline-header">
          <span class="outline-title">Table of Contents</span>
          <span class="outline-count">{headings().length} headings</span>
          <button class="outline-close" onclick={() => showOutline = false}><X size={14} /></button>
        </div>
        <nav class="outline-nav" aria-label="Document outline">
          {#each headings() as heading, index}
            <button
              class="outline-item"
              class:level-1={heading.level === 1}
              class:level-2={heading.level === 2}
              class:level-3={heading.level === 3}
              class:level-4={heading.level >= 4}
              class:active={activeTOCHeading === heading.text}
              onclick={() => navigateToHeading(heading)}
            >
              <span class="outline-number">{index + 1}</span>
              <span class="outline-marker">{'#'.repeat(heading.level)}</span>
              <span class="outline-text">{heading.text}</span>
              <span class="outline-line">L{heading.line}</span>
            </button>
          {/each}
        </nav>
        <div class="outline-footer">
          <span class="outline-hint">Click to navigate</span>
        </div>
      </div>
    {/if}

    <!-- Backlinks Panel -->
    {#if showBacklinks && (backlinks().length > 0 || outgoingLinks().length > 0)}
      <div class="backlinks-panel">
        <div class="backlinks-header">
          <span class="backlinks-title">Links</span>
          <button class="backlinks-close" onclick={() => showBacklinks = false}><X size={14} /></button>
        </div>

        {#if backlinks().length > 0}
          <div class="backlinks-section">
            <div class="backlinks-section-header">
              <span class="backlinks-section-icon"><ArrowLeft size={12} /></span>
              <span class="backlinks-section-title">Backlinks</span>
              <span class="backlinks-count">{backlinks().length}</span>
            </div>
            <div class="backlinks-list">
              {#each backlinks() as backlinkItem}
                <button
                  class="backlink-item"
                  onclick={() => notesStore.selectNote(backlinkItem.note.id)}
                  title={backlinkItem.context}
                >
                  <div class="backlink-content">
                    <span class="backlink-title">{backlinkItem.note.title || 'Untitled'}</span>
                    <span class="backlink-context">{backlinkItem.context}</span>
                  </div>
                  {#if backlinkItem.matchCount > 1}
                    <span class="backlink-count">{backlinkItem.matchCount}</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if outgoingLinks().length > 0}
          <div class="backlinks-section">
            <div class="backlinks-section-header">
              <span class="backlinks-section-icon"><ArrowRight size={12} /></span>
              <span class="backlinks-section-title">Links to</span>
              <span class="backlinks-count">{outgoingLinks().length}</span>
            </div>
            <div class="backlinks-list">
              {#each outgoingLinks() as linkedNote}
                <button
                  class="backlink-item"
                  onclick={() => notesStore.selectNote(linkedNote.id)}
                  title={linkedNote.content.slice(0, 100)}
                >
                  <div class="backlink-content">
                    <span class="backlink-title">{linkedNote.title || 'Untitled'}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        {#if backlinks().length === 0 && outgoingLinks().length === 0}
          <div class="backlinks-empty">
            <p>No linked notes yet</p>
            <p class="backlinks-hint">Use [[note title]] to link notes</p>
          </div>
        {/if}
      </div>
    {/if}

    <div
      class="title-wrapper"
      style="--note-bg: {currentNoteColor().bg}; --note-border: {currentNoteColor().border}; --note-accent: {currentNoteColor().accent}"
      class:has-color={currentNoteColor().id !== 'none'}
    >
      {#if currentNoteColor().id !== 'none'}
        <span class="note-color-indicator" style="background: {currentNoteColor().accent}"></span>
      {/if}
      <input
        bind:this={titleInput}
        class="title-input"
        type="text"
        placeholder="Untitled"
        value={note.title}
        oninput={handleTitleChange}
        aria-label="Note title"
      />
    </div>

    <div class="tags-row">
      <TagInput noteId={note.id} tags={note.tags} />
    </div>

    <!-- Find and Replace Panel -->
    {#if showFindReplace}
      <div class="find-replace-panel" class:has-error={regexError}>
        <div class="find-row">
          <input
            type="text"
            class="find-input"
            class:error={regexError}
            placeholder={findRegex ? "Regex pattern..." : "Find..."}
            bind:value={findQuery}
            oninput={() => updateFindMatches()}
          />
          <span class="match-count">
            {#if regexError}
              <span class="regex-error-badge" title={regexError}>Error</span>
            {:else if totalMatches > 0}
              {currentMatchIndex + 1}/{totalMatches}
            {:else if findQuery}
              No matches
            {/if}
          </span>
          <button class="find-btn" onclick={findPrevious} title="Previous (Shift+Enter)">↑</button>
          <button class="find-btn" onclick={findNext} title="Next (Enter)">↓</button>
        </div>
        <div class="replace-row">
          <input
            type="text"
            class="find-input"
            placeholder={findRegex ? "Replace ($1, $2 for groups)..." : "Replace with..."}
            bind:value={replaceQuery}
            oninput={() => updateFindMatches()}
          />
          <button class="find-btn" onclick={replaceCurrent} title="Replace (⌘H)" disabled={regexError !== null || totalMatches === 0}>Replace</button>
          <button class="find-btn" onclick={replaceAll} title="Replace all (⌘⇧H)" disabled={regexError !== null || totalMatches === 0}>All</button>
        </div>
        {#if replacePreview && totalMatches > 0}
          <div class="replace-preview">
            <span class="preview-label">Preview:</span>
            <span class="preview-text">{replacePreview}</span>
          </div>
        {/if}
        {#if regexError}
          <div class="regex-error-message">
            {regexError}
          </div>
        {/if}
        <div class="find-options">
          <label class="find-option">
            <input type="checkbox" bind:checked={findCaseSensitive} onchange={() => updateFindMatches()} />
            <span title="Case sensitive">Aa</span>
          </label>
          <label class="find-option" title="Whole word" class:disabled={findRegex}>
            <input type="checkbox" bind:checked={findWholeWord} onchange={() => updateFindMatches()} disabled={findRegex} />
            <span>W</span>
          </label>
          <label class="find-option" title="Regular expression">
            <input type="checkbox" bind:checked={findRegex} onchange={() => { findWholeWord = false; updateFindMatches(); }} />
            <span>.*</span>
          </label>
          {#if findRegex}
            <button
              class="find-btn regex-help-btn"
              onclick={() => { showRegexHelp = !showRegexHelp; showSearchHistory = false; }}
              title="Regex help"
            >
              ?
            </button>
          {/if}
          {#if searchHistory.length > 0}
            <button
              class="find-btn history-btn"
              class:active={showSearchHistory}
              onclick={() => { showSearchHistory = !showSearchHistory; showRegexHelp = false; }}
              title="Search history"
            >
              ↺
            </button>
          {/if}
          <button class="find-close" onclick={closeFindReplace}><X size={14} /></button>
        </div>
        {#if showRegexHelp && findRegex}
          <div class="regex-help-panel">
            <div class="regex-help-title">Regex Quick Reference</div>
            <div class="regex-help-grid">
              <div class="regex-help-item">
                <code>.</code>
                <span>Any character</span>
              </div>
              <div class="regex-help-item">
                <code>*</code>
                <span>0 or more</span>
              </div>
              <div class="regex-help-item">
                <code>+</code>
                <span>1 or more</span>
              </div>
              <div class="regex-help-item">
                <code>?</code>
                <span>0 or 1</span>
              </div>
              <div class="regex-help-item">
                <code>\d</code>
                <span>Digit</span>
              </div>
              <div class="regex-help-item">
                <code>\w</code>
                <span>Word char</span>
              </div>
              <div class="regex-help-item">
                <code>\s</code>
                <span>Whitespace</span>
              </div>
              <div class="regex-help-item">
                <code>^</code>
                <span>Line start</span>
              </div>
              <div class="regex-help-item">
                <code>$</code>
                <span>Line end</span>
              </div>
              <div class="regex-help-item">
                <code>[abc]</code>
                <span>Any of a,b,c</span>
              </div>
              <div class="regex-help-item">
                <code>(group)</code>
                <span>Capture group</span>
              </div>
              <div class="regex-help-item">
                <code>$1, $2</code>
                <span>Use in replace</span>
              </div>
            </div>
            <div class="regex-help-examples">
              <div class="regex-help-subtitle">Common patterns:</div>
              <button class="regex-example" onclick={() => { findQuery = '\\b\\w+\\b'; updateFindMatches(); }}>
                Words: <code>\b\w+\b</code>
              </button>
              <button class="regex-example" onclick={() => { findQuery = '^#+\\s+.*$'; updateFindMatches(); }}>
                Headers: <code>^#+\s+.*$</code>
              </button>
              <button class="regex-example" onclick={() => { findQuery = '\\[([^\\]]+)\\]\\(([^)]+)\\)'; updateFindMatches(); }}>
                Links: <code>\[...\](...)</code>
              </button>
              <button class="regex-example" onclick={() => { findQuery = '- \\[ \\].*'; updateFindMatches(); }}>
                Unchecked: <code>- \[ \].*</code>
              </button>
            </div>
          </div>
        {/if}
        <!-- Search History Panel -->
        {#if showSearchHistory && searchHistory.length > 0}
          <div class="search-history-panel">
            <div class="search-history-header">
              <span class="search-history-title">Recent Searches</span>
              <button class="search-history-clear" onclick={clearSearchHistory} title="Clear history">
                Clear
              </button>
            </div>
            <div class="search-history-list">
              {#each searchHistory.slice(0, 10) as item}
                <button
                  class="search-history-item"
                  onclick={() => useSearchFromHistory(item)}
                >
                  <span class="search-history-query">{item.query}</span>
                  {#if item.isRegex}
                    <span class="search-history-badge">regex</span>
                  {/if}
                  <span class="search-history-time">
                    {formatSearchTime(item.timestamp)}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <div class="content-wrapper" class:split={viewMode === 'split'} class:split-horizontal={viewMode === 'split-horizontal'}>
      {#if viewMode === 'edit' || viewMode === 'split' || viewMode === 'split-horizontal'}
        <div class="editor-pane">
          {#if showFormatBar && viewMode === 'edit'}
            <div class="format-toolbar" role="toolbar" aria-label="Text formatting">
              <div class="format-group">
                <button class="format-btn" onclick={formatH1} title="Heading 1">H1</button>
                <button class="format-btn" onclick={formatH2} title="Heading 2">H2</button>
                <button class="format-btn" onclick={formatH3} title="Heading 3">H3</button>
              </div>
              <div class="format-divider"></div>
              <div class="format-group">
                <button class="format-btn" onclick={formatBold} title="Bold (⌘B)"><strong>B</strong></button>
                <button class="format-btn" onclick={formatItalic} title="Italic (⌘I)"><em>I</em></button>
                <button class="format-btn" onclick={formatStrike} title="Strikethrough"><s>S</s></button>
              </div>
              <div class="format-divider"></div>
              <div class="format-group">
                <button class="format-btn" onclick={formatBullet} title="Bullet list">•</button>
                <button class="format-btn" onclick={formatNumbered} title="Numbered list">1.</button>
                <button class="format-btn" onclick={formatTask} title="Task list">☐</button>
                <button class="format-btn" onclick={formatQuote} title="Blockquote">"</button>
              </div>
              <div class="format-divider"></div>
              <div class="format-group">
                <button class="format-btn" onclick={formatCode} title="Inline code">&lt;/&gt;</button>
                <button class="format-btn" onclick={formatCodeBlock} title="Code block">```</button>
                <button class="format-btn" onclick={formatLink} title="Link">Link</button>
                <button class="format-btn" onclick={formatNoteLink} title="Note link">[[]]</button>
              </div>
              <div class="format-divider"></div>
              <div class="format-group">
                <button class="format-btn" onclick={formatHr} title="Horizontal rule">―</button>
                <button class="format-btn" onclick={formatTable} title="Insert table">☷</button>
                <button class="format-btn" onclick={insertImageFromFile} title="Insert image">Img</button>
              </div>
              <button
                class="format-toggle"
                onclick={() => showFormatBar = false}
                title="Hide toolbar"
              >
                ▲
              </button>
            </div>
          {:else if viewMode === 'edit'}
            <button
              class="format-show-btn"
              onclick={() => showFormatBar = true}
              title="Show formatting toolbar"
            >
              Aa
            </button>
          {/if}
          <div
            class="textarea-container"
            class:focus-paragraph-mode={focusParagraphMode}
            class:dragging-file={isDraggingFile}
            ondragleave={handleEditorDragLeave}
          >
            <textarea
              bind:this={contentArea}
              class="content-area"
              placeholder="Start writing in Markdown..."
              value={note.content}
              oninput={handleContentInput}
              onkeydown={handleEditorKeydown}
              onkeyup={(e) => { handleCursorChange(); handleTextSelection(); }}
              onclick={(e) => { handleCursorChange(); handleTextSelection(); }}
              onfocus={handleCursorChange}
              onpaste={handlePaste}
              ondrop={handleEditorDrop}
              ondragover={handleEditorDragOver}
              onscroll={handleEditorScroll}
              onmouseup={handleTextSelection}
              aria-label="Note content"
            ></textarea>

            <!-- Drop Zone Overlay -->
            {#if isDraggingFile}
              <div class="drop-zone-overlay">
                <div class="drop-zone-content">
                  <span class="drop-icon">📷</span>
                  <span class="drop-text">Drop image here</span>
                </div>
              </div>
            {/if}

            <!-- Dictation Indicator -->
            {#if isDictating}
              <div class="dictation-indicator">
                <div class="dictation-pulse"></div>
                <span class="dictation-text">
                  {#if interimTranscript}
                    {interimTranscript}
                  {:else}
                    Listening...
                  {/if}
                </span>
              </div>
            {/if}

            <!-- Focus Paragraph Overlay -->
            {#if focusParagraphMode && contentParagraphs().length > 0}
              <div class="focus-overlay" aria-hidden="true">
                {#each contentParagraphs() as paragraph, i}
                  <div
                    class="focus-paragraph"
                    class:active={i === currentParagraphIndex}
                    class:dimmed={i !== currentParagraphIndex}
                  >
                    {paragraph}
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Note Link Suggestions -->
            {#if showLinkSuggestions}
              <div class="link-suggestions" role="listbox" aria-label="Note suggestions">
                <div class="link-suggestions-header">
                  <span>Link to note</span>
                  <span class="link-hint">↑↓ navigate • Enter select • Esc close</span>
                </div>
                {#if linkSuggestions().length > 0}
                  {#each linkSuggestions() as suggestion, i}
                    <button
                      class="link-suggestion-item"
                      class:selected={i === linkSuggestionIndex}
                      onclick={() => selectLinkSuggestion(suggestion.title)}
                      role="option"
                      aria-selected={i === linkSuggestionIndex}
                    >
                      <span class="suggestion-title">{suggestion.title || 'Untitled'}</span>
                      <span class="suggestion-preview">
                        {suggestion.content.substring(0, 50)}{suggestion.content.length > 50 ? '...' : ''}
                      </span>
                    </button>
                  {/each}
                {:else}
                  <div class="link-no-results">
                    No notes found matching "{linkQuery}"
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Emoji Suggestions -->
            {#if showEmojiSuggestions && emojiSuggestions().length > 0}
              <div class="emoji-suggestions" role="listbox" aria-label="Emoji suggestions">
                <div class="emoji-suggestions-header">
                  <span>:{emojiQuery}</span>
                  <span class="emoji-hint">↑↓ • Enter • Esc</span>
                </div>
                {#each emojiSuggestions() as suggestion, i}
                  <button
                    class="emoji-suggestion-item"
                    class:selected={i === emojiSuggestionIndex}
                    onclick={() => selectEmojiSuggestion(suggestion.emoji)}
                    role="option"
                    aria-selected={i === emojiSuggestionIndex}
                  >
                    <span class="emoji-preview">{suggestion.emoji}</span>
                    <span class="emoji-code">:{suggestion.code}:</span>
                  </button>
                {/each}
              </div>
            {/if}

            <!-- Snippet Suggestions -->
            {#if showSnippetSuggestions && snippetSuggestions().length > 0}
              <div class="snippet-suggestions" role="listbox" aria-label="Snippet suggestions">
                <div class="snippet-suggestions-header">
                  <span>/{snippetQuery || 'snippets'}</span>
                  <span class="snippet-hint">↑↓ • Enter • Esc</span>
                </div>
                {#each snippetSuggestions() as suggestion, i}
                  <button
                    class="snippet-suggestion-item"
                    class:selected={i === snippetSuggestionIndex}
                    onclick={() => selectSnippetSuggestion(suggestion)}
                    role="option"
                    aria-selected={i === snippetSuggestionIndex}
                  >
                    <span class="snippet-icon">{suggestion.icon}</span>
                    <div class="snippet-info">
                      <span class="snippet-name">/{suggestion.name}</span>
                      <span class="snippet-desc">{suggestion.description}</span>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if viewMode === 'preview' || viewMode === 'split' || viewMode === 'split-horizontal'}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          bind:this={previewArea}
          class="preview-area"
          role="article"
          aria-label="Markdown preview"
          onclick={handlePreviewClick}
          onmouseover={handleLinkMouseEnter}
          onmouseout={handleLinkMouseLeave}
          oncontextmenu={handlePreviewContextMenu}
          onscroll={handlePreviewScroll}
        >
          {@html parseMarkdown(note.content)}
        </div>
      {/if}

      {#if viewMode === 'reading'}
        <div class="reading-mode reading-theme-{readingTheme}" bind:this={readingModeContainer} onscroll={handleReadingScroll}>
          <div class="reading-progress-indicator" style="width: {readingProgress}%"></div>
          <div class="reading-theme-selector">
            <button
              class="theme-btn"
              class:active={readingTheme === 'default'}
              onclick={() => readingTheme = 'default'}
              title="Default"
            >
              <span class="theme-icon">◐</span>
            </button>
            <button
              class="theme-btn sepia"
              class:active={readingTheme === 'sepia'}
              onclick={() => readingTheme = 'sepia'}
              title="Sepia"
            >
              <span class="theme-icon">📜</span>
            </button>
            <button
              class="theme-btn warm"
              class:active={readingTheme === 'warm'}
              onclick={() => readingTheme = 'warm'}
              title="Warm"
            >
              <span class="theme-icon">🌅</span>
            </button>
            <button
              class="theme-btn night"
              class:active={readingTheme === 'night'}
              onclick={() => readingTheme = 'night'}
              title="Night"
            >
              <span class="theme-icon">Dark</span>
            </button>
          </div>
          <div class="reading-container">
            <article class="reading-content">
              <h1 class="reading-title">{note.title || 'Untitled'}</h1>
              <div class="reading-meta">
                <span class="reading-date">
                  {new Date(note.updated_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                <span class="reading-stats">
                  {wordCount} words · {advancedStats().readingTime} min read
                </span>
              </div>
              {#if advancedStats().totalTasks > 0}
                <div class="reading-progress">
                  <div class="reading-progress-bar">
                    <div class="reading-progress-fill" style="width: {advancedStats().taskProgress}%"></div>
                  </div>
                  <span class="reading-progress-text">
                    {advancedStats().completedTasks}/{advancedStats().totalTasks} tasks complete
                  </span>
                </div>
              {/if}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="reading-body"
                onclick={handlePreviewClick}
                onmouseover={handleLinkMouseEnter}
                onmouseout={handleLinkMouseLeave}
              >
                {@html parseMarkdown(note.content)}
              </div>
            </article>
          </div>
        </div>
      {/if}

      {#if viewMode === 'presentation'}
        <div class="presentation-mode">
          <div class="presentation-slide">
            {#if presentationSlides()[currentSlide]}
              <h1 class="slide-title">{presentationSlides()[currentSlide].title}</h1>
              {#if presentationSlides()[currentSlide].content}
                <div class="slide-content">
                  {@html parseMarkdown(presentationSlides()[currentSlide].content)}
                </div>
              {/if}
            {/if}
          </div>

          <div class="presentation-controls">
            <button
              class="pres-btn"
              onclick={prevSlide}
              disabled={currentSlide === 0}
            >
              ←
            </button>
            <span class="slide-counter">
              {currentSlide + 1} / {presentationSlides().length}
            </span>
            <button
              class="pres-btn"
              onclick={nextSlide}
              disabled={currentSlide === presentationSlides().length - 1}
            >
              →
            </button>
            <button
              class="pres-btn exit-btn"
              onclick={() => viewMode = 'edit'}
              title="Exit presentation (Esc)"
            >
              ✕
            </button>
          </div>

          <div class="presentation-progress">
            <div
              class="presentation-progress-bar"
              style="width: {((currentSlide + 1) / presentationSlides().length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>

    {#if backlinks().length > 0 && viewMode !== 'presentation'}
      <div class="backlinks-section">
        <button
          class="backlinks-header"
          onclick={() => showBacklinks = !showBacklinks}
        >
          <span class="backlinks-icon">Link</span>
          <span class="backlinks-title">Backlinks ({backlinks().length})</span>
          <span class="backlinks-toggle">{showBacklinks ? '▼' : '▶'}</span>
        </button>
        {#if showBacklinks}
          <div class="backlinks-list">
            {#each backlinks() as backlink}
              <button
                class="backlink-item"
                onclick={() => backlink.note && notesStore.selectNote(backlink.note.id)}
              >
                <div class="backlink-header">
                  <span class="backlink-title">{backlink.note?.title || 'Untitled'}</span>
                  {#if backlink.matchCount > 1}
                    <span class="backlink-count">{backlink.matchCount}×</span>
                  {/if}
                </div>
                <span class="backlink-context">{backlink.context}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if brokenLinks().length > 0 && viewMode !== 'presentation'}
      <div class="broken-links-section">
        <div class="broken-links-header">
          <span class="broken-icon"><AlertTriangle size={16} /></span>
          <span class="broken-title">{brokenLinks().length} broken link{brokenLinks().length > 1 ? 's' : ''}</span>
        </div>
        <div class="broken-links-list">
          {#each brokenLinks() as link}
            <button
              class="broken-link-item"
              onclick={() => createLinkedNote(link)}
              title="Click to create this note"
            >
              <span class="broken-link-name">[[{link}]]</span>
              <span class="broken-link-action">+ Create</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="editor-footer">
      <div class="footer-left">
        {#if isTyping}
          <span class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-text">Typing...</span>
          </span>
        {:else}
          <span class="save-status" class:saving={isSaving} class:modified={hasUnsavedChanges && !isSaving} class:just-saved={lastSavedAt && !isSaving && !hasUnsavedChanges && (Date.now() - lastSavedAt.getTime()) < 3000}>
            <span class="save-icon">
              {#if isSaving}
                <svg class="save-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.5-7.5l-2.8 2.8M8.3 15.7l-2.8 2.8m12 0l-2.8-2.8M8.3 8.3L5.5 5.5"/>
                </svg>
              {:else if hasUnsavedChanges}
                <span class="modified-dot"></span>
              {:else}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
              {/if}
            </span>
            <span class="save-text">{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Modified' : formatLastSaved()}</span>
          </span>
        {/if}
      </div>

      <div class="footer-center">
        {#if showWordGoal}
          <div class="word-goal-container">
            <div class="word-goal-header">
              <span class="goal-label">Goal: {wordCount} / {wordGoal}</span>
              <button class="goal-close" onclick={() => showWordGoal = false}><X size={14} /></button>
            </div>
            <div class="goal-progress-bar">
              <div
                class="goal-progress-fill"
                class:reached={goalReached}
                style:width="{goalProgress}%"
              ></div>
            </div>
            <div class="goal-input-row">
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                bind:value={wordGoal}
                class="goal-slider"
              />
              <input
                type="number"
                min="100"
                max="10000"
                bind:value={wordGoal}
                class="goal-number"
              />
            </div>
            {#if goalReached}
              <span class="goal-reached-badge">Goal reached!</span>
            {/if}
          </div>
        {:else}
          <div class="footer-stats">
            <span class="stat cursor-pos" title="Line : Column">
              Ln {cursorLine}, Col {cursorColumn}
            </span>
            <span class="stat-divider">|</span>
            <button class="stat-btn" onclick={() => showWordGoal = true} title="Set word goal">
              {wordCount} words
            </button>
            <span class="stat-divider">|</span>
            <button
              class="stat-btn char-limit-btn"
              class:warning={charLimitWarning}
              class:exceeded={charLimitExceeded}
              onclick={() => showCharLimit = !showCharLimit}
              title={charLimitEnabled ? `${charCount}/${charLimit} characters` : "Set character limit"}
            >
              {charCount.toLocaleString()} chars
              {#if charLimitEnabled && charLimit > 0}
                <span class="char-limit-indicator" class:warning={charLimitWarning} class:exceeded={charLimitExceeded}>
                  /{charLimit.toLocaleString()}
                </span>
              {/if}
            </button>
            <span class="stat-divider">|</span>
            <span class="stat" title="Reading time">{advancedStats().readingTime} min read</span>
            {#if advancedStats().totalTasks > 0}
              <span class="stat-divider">|</span>
              <div class="task-progress-mini" title="{advancedStats().completedTasks}/{advancedStats().totalTasks} tasks">
                <div class="task-bar-mini">
                  <div class="task-fill-mini" style="width: {advancedStats().taskProgress}%"></div>
                </div>
                <span class="task-text-mini">{advancedStats().taskProgress}%</span>
              </div>
            {/if}
            <span class="stat-divider">|</span>
            <button
              class="stat-btn typewriter-toggle"
              class:active={typewriterMode}
              onclick={() => typewriterMode = !typewriterMode}
              title="Typewriter mode - keeps cursor centered"
            >
              TW
            </button>
            <button
              class="stat-btn focus-toggle"
              class:active={focusParagraphMode}
              onclick={() => focusParagraphMode = !focusParagraphMode}
              title="Focus mode - highlight current paragraph"
            >
              ¶
            </button>
            <span class="stat-divider">|</span>
            <button
              class="stat-btn session-toggle"
              class:active={isSessionActive}
              onclick={toggleSession}
              title={isSessionActive ? 'Stop writing session' : 'Start writing session'}
            >
              {isSessionActive ? '⏱' : '▶'}
            </button>
            {#if isSessionActive}
              <span class="session-stats">
                +{sessionWordsWritten}w · {sessionDuration()} · {sessionWPM()} wpm
              </span>
            {/if}
            <span class="stat-divider">|</span>
            <button class="stat-btn" onclick={() => showAdvancedStats = !showAdvancedStats} title="More statistics">
              ...
            </button>
            <span class="stat-divider">|</span>
            <button class="stat-btn stats-btn" onclick={() => showWritingStats = true} title="Writing statistics">
              Stats
            </button>
            <button class="stat-btn calendar-btn" onclick={() => showCalendarView = true} title="Calendar view">
              Cal
            </button>
            <button class="stat-btn reminders-btn" onclick={() => showReminders = true} title="Reminders">
              Rem
              {#if getOverdueReminders().length > 0}
                <span class="reminder-badge">{getOverdueReminders().length}</span>
              {/if}
            </button>
            <button
              class="stat-btn outline-btn"
              class:active={showOutline}
              onclick={() => showOutline = !showOutline}
              title="Table of Contents"
              disabled={headings().length === 0}
            >
              Snip
              {#if headings().length > 0}
                <span class="outline-count">{headings().length}</span>
              {/if}
            </button>
          </div>

          {#if showOutline}
            <div class="outline-panel">
              <div class="outline-header">
                <span class="outline-title">Table of Contents</span>
                <button class="outline-close" onclick={() => showOutline = false}><X size={14} /></button>
              </div>
              <div class="outline-list">
                {#each headings() as heading, i}
                  <button
                    class="outline-item level-{heading.level}"
                    onclick={() => navigateToLine(heading.line)}
                  >
                    <span class="outline-marker">{'#'.repeat(heading.level)}</span>
                    <span class="outline-text">{heading.text}</span>
                    <span class="outline-line">L{heading.line}</span>
                  </button>
                {:else}
                  <div class="outline-empty">
                    No headings found. Use # for headings.
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if showCharLimit}
            <div class="char-limit-panel">
              <div class="char-limit-header">
                <span class="char-limit-title">Character Limit</span>
                <button class="char-limit-close" onclick={() => showCharLimit = false}><X size={14} /></button>
              </div>
              <label class="char-limit-toggle">
                <input type="checkbox" bind:checked={charLimitEnabled} />
                <span>Enable character limit</span>
              </label>
              {#if charLimitEnabled}
                <div class="char-limit-config">
                  <div class="char-limit-presets">
                    <button class="preset-btn" class:active={charLimit === 280} onclick={() => charLimit = 280}>Tweet (280)</button>
                    <button class="preset-btn" class:active={charLimit === 500} onclick={() => charLimit = 500}>Post (500)</button>
                    <button class="preset-btn" class:active={charLimit === 1000} onclick={() => charLimit = 1000}>1K</button>
                    <button class="preset-btn" class:active={charLimit === 5000} onclick={() => charLimit = 5000}>5K</button>
                    <button class="preset-btn" class:active={charLimit === 10000} onclick={() => charLimit = 10000}>10K</button>
                  </div>
                  <div class="char-limit-custom">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      bind:value={charLimit}
                      class="char-limit-input"
                      placeholder="Custom limit"
                    />
                    <span class="char-limit-unit">chars</span>
                  </div>
                  <div class="char-limit-progress">
                    <div class="char-limit-bar">
                      <div
                        class="char-limit-fill"
                        class:warning={charLimitWarning}
                        class:exceeded={charLimitExceeded}
                        style="width: {Math.min(charLimitProgress, 100)}%"
                      ></div>
                    </div>
                    <span class="char-limit-status" class:warning={charLimitWarning} class:exceeded={charLimitExceeded}>
                      {charCount.toLocaleString()} / {charLimit.toLocaleString()}
                      {#if charLimitExceeded}
                        <span class="over-limit">({(charCount - charLimit).toLocaleString()} over)</span>
                      {:else}
                        <span class="remaining">({(charLimit - charCount).toLocaleString()} remaining)</span>
                      {/if}
                    </span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if showAdvancedStats}
            <div class="advanced-stats-panel">
              <!-- Basic Stats -->
              <div class="stats-section">
                <div class="stats-section-title">Document</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().chars.toLocaleString()}</span>
                    <span class="stat-label">Characters</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().charsNoSpaces.toLocaleString()}</span>
                    <span class="stat-label">No spaces</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{wordCount.toLocaleString()}</span>
                    <span class="stat-label">Words</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().sentences}</span>
                    <span class="stat-label">Sentences</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().paragraphs}</span>
                    <span class="stat-label">Paragraphs</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{totalLines}</span>
                    <span class="stat-label">Lines</span>
                  </div>
                </div>
              </div>

              <!-- Time Stats -->
              <div class="stats-section">
                <div class="stats-section-title">Time</div>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().readingTime} min</span>
                    <span class="stat-label">Reading</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().speakingTime} min</span>
                    <span class="stat-label">Speaking</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{advancedStats().avgWordsPerSentence}</span>
                    <span class="stat-label">Words/sent</span>
                  </div>
                </div>
              </div>

              <!-- Readability -->
              <div class="stats-section">
                <div class="stats-section-title">Readability</div>
                <div class="readability-score">
                  <div class="readability-gauge">
                    <div
                      class="readability-fill"
                      style="width: {Math.min(100, Math.max(0, advancedStats().fleschScore))}%"
                      class:easy={advancedStats().fleschScore >= 60}
                      class:medium={advancedStats().fleschScore >= 30 && advancedStats().fleschScore < 60}
                      class:hard={advancedStats().fleschScore < 30}
                    ></div>
                  </div>
                  <div class="readability-info">
                    <span class="readability-level">{advancedStats().readabilityLevel}</span>
                    <span class="readability-number">Flesch: {advancedStats().fleschScore}</span>
                  </div>
                </div>
              </div>

              <!-- Markdown Elements -->
              <div class="stats-section">
                <div class="stats-section-title">Structure</div>
                <div class="stats-grid compact">
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().headings}</span>
                    <span class="stat-label">Headings</span>
                  </div>
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().links}</span>
                    <span class="stat-label">Links</span>
                  </div>
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().noteLinks}</span>
                    <span class="stat-label">Note links</span>
                  </div>
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().images}</span>
                    <span class="stat-label">Images</span>
                  </div>
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().codeBlocks}</span>
                    <span class="stat-label">Code</span>
                  </div>
                  <div class="stat-item mini">
                    <span class="stat-value">{advancedStats().lists}</span>
                    <span class="stat-label">Lists</span>
                  </div>
                </div>
              </div>

              <!-- Tasks -->
              {#if advancedStats().totalTasks > 0}
                <div class="stats-section">
                  <div class="stats-section-title">Tasks</div>
                  <div class="task-progress-detail">
                    <div class="task-info">
                      <span class="task-count">{advancedStats().completedTasks}/{advancedStats().totalTasks}</span>
                      <span class="task-percent">{advancedStats().taskProgress}%</span>
                    </div>
                    <div class="task-bar">
                      <div class="task-fill" style="width: {advancedStats().taskProgress}%"></div>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Top Words -->
              {#if advancedStats().topWords.length > 0}
                <div class="stats-section">
                  <div class="stats-section-title">Top Words</div>
                  <div class="top-words">
                    {#each advancedStats().topWords as item}
                      <span class="top-word">
                        {item.word}
                        <span class="word-count">{item.count}</span>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

      <div class="footer-right">
        <span class="meta" title="Last updated">
          {new Date(note.updated_at).toLocaleString()}
        </span>
      </div>
    </div>
  {:else}
    <div class="empty-editor">
      <div class="empty-content">
        <span class="empty-icon"><FileText size={48} /></span>
        <h3>No note selected</h3>
        <p>Select a note from the list or create a new one</p>
        <p class="shortcut-hint">Press <kbd>⌘N</kbd> to create a new note</p>
      </div>
    </div>
  {/if}
</div>

<!-- Context Menu -->
{#if showContextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="context-menu"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    role="menu"
    aria-label="Preview actions"
    onclick={(e) => e.stopPropagation()}
  >
    {#if selectedText}
      <button class="context-item" role="menuitem" onclick={contextCopyText}>
        <span class="context-icon">Copy</span>
        Copy selection
      </button>
      <button class="context-item" role="menuitem" onclick={contextSearchInNote}>
        <span class="context-icon">Find</span>
        Find in editor
      </button>
      <button class="context-item" role="menuitem" onclick={contextLinkSelection}>
        <span class="context-icon">Link</span>
        Make note link
      </button>
      <button class="context-item" role="menuitem" onclick={contextCreateNoteFromSelection}>
        <span class="context-icon">Note</span>
        Create note from selection
      </button>
      <button class="context-item" role="menuitem" onclick={contextDefineWord}>
        <span class="context-icon">Read</span>
        Define word
      </button>
      <hr class="context-divider" />
    {/if}
    <button class="context-item" role="menuitem" onclick={contextCopyAsMarkdown}>
      <span class="context-icon">Doc</span>
      Copy as Markdown
    </button>
    <button class="context-item" role="menuitem" onclick={contextCopyAll}>
      <span class="context-icon">TOC</span>
      Copy entire note
    </button>
    <hr class="context-divider" />
    <button class="context-item" role="menuitem" onclick={() => { viewMode = 'edit'; closeContextMenu(); }}>
      <span class="context-icon">Edit</span>
      Switch to edit mode
    </button>
    <button class="context-item" role="menuitem" onclick={() => { exportNote(); closeContextMenu(); }}>
      <span class="context-icon">Export</span>
      Export note
    </button>
  </div>
{/if}

<!-- Link Preview Tooltip -->
{#if showLinkPreview && linkPreviewNote}
  <div
    class="link-preview-tooltip"
    style="left: {linkPreviewPosition.x}px; top: {linkPreviewPosition.y}px;"
    onmouseenter={() => showLinkPreview = true}
    onmouseleave={handleLinkMouseLeave}
  >
    <div class="link-preview-header">
      <span class="link-preview-title">{linkPreviewNote.title || 'Untitled'}</span>
      <span class="link-preview-date">
        {new Date(linkPreviewNote.updated_at).toLocaleDateString()}
      </span>
    </div>
    <div class="link-preview-content">
      {linkPreviewNote.content.slice(0, 200)}{linkPreviewNote.content.length > 200 ? '...' : ''}
    </div>
    <div class="link-preview-hint">Click to open</div>
  </div>
{/if}

<!-- Dictionary Definition Modal -->
{#if showDefinitionModal}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="definition-modal-backdrop"
    onclick={closeDefinitionModal}
    onkeydown={(e) => e.key === 'Escape' && closeDefinitionModal()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="definition-title"
  >
    <div class="definition-modal" onclick={(e) => e.stopPropagation()}>
      <header class="definition-header">
        <h2 id="definition-title">
          <span class="def-icon">Read</span>
          Definition
        </h2>
        <button class="def-close-btn" onclick={closeDefinitionModal} aria-label="Close">
          ✕
        </button>
      </header>

      <div class="definition-content">
        {#if definitionLoading}
          <div class="def-loading">
            <div class="def-spinner"></div>
            <p>Looking up "{definitionWord}"...</p>
          </div>
        {:else if definitionError}
          <div class="def-error">
            <span class="def-error-icon">😕</span>
            <p>{definitionError}</p>
            <p class="def-error-hint">Try selecting a different word or check spelling.</p>
          </div>
        {:else if definitionData}
          <div class="def-word-header">
            <h3 class="def-word">{definitionData.word}</h3>
            {#if definitionData.phonetic || definitionData.phonetics?.find(p => p.text)}
              <span class="def-phonetic">
                {definitionData.phonetic || definitionData.phonetics?.find(p => p.text)?.text}
              </span>
            {/if}
            {#if definitionData.phonetics?.find(p => p.audio)}
              <button class="def-audio-btn" onclick={playPronunciation} title="Listen to pronunciation">
                Vol
              </button>
            {/if}
          </div>

          <div class="def-meanings">
            {#each definitionData.meanings as meaning}
              <div class="def-meaning">
                <span class="def-pos">{meaning.partOfSpeech}</span>
                <ol class="def-definitions">
                  {#each meaning.definitions.slice(0, 3) as def}
                    <li>
                      <p class="def-text">{def.definition}</p>
                      {#if def.example}
                        <p class="def-example">"{def.example}"</p>
                      {/if}
                      {#if def.synonyms && def.synonyms.length > 0}
                        <p class="def-synonyms">
                          <strong>Synonyms:</strong> {def.synonyms.slice(0, 5).join(', ')}
                        </p>
                      {/if}
                    </li>
                  {/each}
                </ol>
              </div>
            {/each}
          </div>

          {#if definitionData.sourceUrls && definitionData.sourceUrls.length > 0}
            <div class="def-source">
              <a href={definitionData.sourceUrls[0]} target="_blank" rel="noopener noreferrer">
                View on Wiktionary ↗
              </a>
            </div>
          {/if}
        {/if}
      </div>

      {#if definitionData && !definitionLoading}
        <footer class="definition-footer">
          <button class="def-btn-secondary" onclick={closeDefinitionModal}>
            Close
          </button>
          <button class="def-btn-primary" onclick={insertDefinitionToNote}>
            Add to Note
          </button>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<!-- Selection Toolbar (Quick Actions) -->
{#if showSelectionToolbar && viewMode === 'edit'}
  <div
    class="selection-toolbar"
    style="left: {selectionToolbarX}px; top: {selectionToolbarY}px;"
    role="toolbar"
    aria-label="Text formatting"
  >
    <button class="sel-btn" onclick={() => wrapSelection('**', '**')} title="Bold (Cmd+B)">
      <strong>B</strong>
    </button>
    <button class="sel-btn" onclick={() => wrapSelection('*', '*')} title="Italic (Cmd+I)">
      <em>I</em>
    </button>
    <button class="sel-btn" onclick={() => wrapSelection('~~', '~~')} title="Strikethrough">
      <s>S</s>
    </button>
    <button class="sel-btn" onclick={() => wrapSelection('`', '`')} title="Inline code">
      <code>&lt;/&gt;</code>
    </button>
    <span class="sel-divider"></span>
    <button class="sel-btn" onclick={makeLink} title="Link">
      Link
    </button>
    <button class="sel-btn" onclick={makeNoteLink} title="Note link [[...]]">
      📎
    </button>
    <span class="sel-divider"></span>
    <button class="sel-btn" onclick={() => wrapSelection('==', '==')} title="Highlight">
      🖍️
    </button>
    <button class="sel-btn" onclick={() => wrapSelection('> ', '')} title="Quote">
      "
    </button>
    <span class="sel-chars">{selectedTextLength} chars</span>
  </div>
{/if}

<ConfirmDialog
  bind:open={showDeleteConfirm}
  title="Delete Note"
  message="Are you sure you want to move this note to trash? You can restore it later from the trash."
  confirmText="Move to Trash"
  cancelText="Cancel"
  destructive={true}
  onConfirm={moveToTrash}
/>

<VersionHistoryModal
  bind:open={showVersionHistory}
  noteId={notesStore.selectedNoteId || ''}
/>

<PomodoroTimer bind:open={showPomodoro} />

<WritingStatsPanel bind:open={showWritingStats} />

<ExportPDFModal bind:open={showExportPDF} note={notesStore.selectedNote} />

<SnippetsManagerModal bind:open={showSnippetsManager} />

<FocusModeOverlay bind:open={showFocusMode} wordCount={wordCount} />

<ExportModal bind:open={showExportModal} note={notesStore.selectedNote} />

<CalendarView open={showCalendarView} onClose={() => showCalendarView = false} />

<RemindersModal open={showReminders} onClose={() => showReminders = false} noteId={notesStore.selectedNoteId || undefined} />

<style>
  .editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    min-width: 0;
    transition: all 0.3s ease;
  }

  /* Zen Mode Styles */
  .editor.zen-mode {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--bg-primary);
  }

  .editor.zen-mode .editor-toolbar,
  .editor.zen-mode .tags-row,
  .editor.zen-mode .backlinks-section,
  .editor.zen-mode .editor-footer {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .editor.zen-mode:hover .editor-toolbar,
  .editor.zen-mode:hover .editor-footer {
    opacity: 0.5;
    pointer-events: auto;
  }

  .editor.zen-mode .title-input {
    text-align: center;
    font-size: 32px;
    padding: 40px 24px 16px;
  }

  .editor.zen-mode .content-wrapper {
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
  }

  .editor.zen-mode .content-area {
    font-size: 18px;
    line-height: 1.8;
    padding: 24px 40px;
  }

  .editor.zen-mode .format-toolbar {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .editor.zen-mode .editor-pane:hover .format-toolbar {
    opacity: 1;
  }

  /* Zen mode exit hint */
  .editor.zen-mode::after {
    content: 'Press Esc to exit Zen mode';
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: var(--text-tertiary);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .editor.zen-mode:hover::after {
    opacity: 0.6;
  }

  /* Ambient Sound Panel */
  .ambient-panel {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1001;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    min-width: 200px;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ambient-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .ambient-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ambient-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 14px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
  }

  .ambient-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .ambient-sounds {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .ambient-sound-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ambient-sound-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .ambient-sound-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .ambient-sound-btn.active .sound-name {
    color: white;
  }

  .sound-icon {
    font-size: 24px;
  }

  .sound-name {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .ambient-volume {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .volume-icon {
    font-size: 14px;
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bg-secondary);
    border-radius: 2px;
    outline: none;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--accent);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .volume-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  /* Lo-fi Music Section */
  .lofi-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .lofi-header {
    margin-bottom: 12px;
  }

  .lofi-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .lofi-stations {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .lofi-station-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lofi-station-btn:hover {
    background: var(--bg-hover);
    border-color: #8b5cf6;
  }

  .lofi-station-btn.active {
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-color: #8b5cf6;
    color: white;
  }

  .lofi-station-btn.active .station-name {
    color: white;
  }

  .station-icon {
    font-size: 20px;
  }

  .station-name {
    font-size: 10px;
    color: var(--text-secondary);
  }

  .lofi-volume {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .lofi-playing {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1));
    border-radius: 8px;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  .playing-indicator {
    width: 8px;
    height: 8px;
    background: #8b5cf6;
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .playing-text {
    font-size: 11px;
    color: #8b5cf6;
    font-weight: 500;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
  }

  .notebook-select {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .toolbar-btn {
    position: relative;
    padding: 6px 10px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .toolbar-btn:hover {
    background: var(--bg-hover);
  }

  .toolbar-btn.active {
    background: var(--accent-light);
    border-color: var(--accent);
  }

  .backlink-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--accent);
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-btn.recording {
    background: #ef4444;
    border-color: #dc2626;
    animation: pulse-recording 1.5s ease-in-out infinite;
  }

  @keyframes pulse-recording {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Dictation styles */
  .dictation-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .dictation-settings {
    font-size: 8px;
    padding: 4px 6px;
    margin-left: -4px;
    border-radius: 0 6px 6px 0;
  }

  .dictation-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    width: 280px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .dictation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .dictation-title {
    font-weight: 600;
    font-size: 14px;
  }

  .dictation-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
  }

  .dictation-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dictation-language {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  .dictation-language label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .dictation-language select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
  }

  .dictation-tips {
    padding: 12px 16px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .dictation-tips p {
    margin: 0 0 8px;
  }

  .dictation-tips ul {
    margin: 0;
    padding-left: 16px;
  }

  .dictation-tips li {
    margin-bottom: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .dictation-indicator {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: rgba(239, 68, 68, 0.95);
    color: white;
    border-radius: 24px;
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
    z-index: 50;
    max-width: 80%;
  }

  .dictation-pulse {
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    animation: dictation-pulse 1s ease-in-out infinite;
  }

  @keyframes dictation-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.7;
    }
  }

  .dictation-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }

  .more-menu-container {
    position: relative;
  }

  .more-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 150px;
    z-index: 100;
    overflow: hidden;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    background: none;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--bg-hover);
  }

  .menu-item.danger {
    color: var(--error);
  }

  .menu-item.danger:hover {
    background: var(--error-light);
  }

  .menu-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .toggle-btn {
    padding: 6px 12px;
    background: none;
    border: none;
    border-right: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:last-child {
    border-right: none;
  }

  .toggle-btn:hover {
    background: var(--bg-hover);
  }

  .toggle-btn.active {
    background: var(--accent);
    color: white;
  }

  .toggle-btn.sync-toggle {
    font-size: 12px;
    margin-left: 4px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .toggle-btn.sync-toggle:not(.active) {
    opacity: 0.5;
  }

  /* Outline Panel */
  .outline-panel {
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    max-height: 300px;
    overflow-y: auto;
  }

  .outline-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .outline-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .outline-count {
    font-size: 10px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 10px;
    margin-left: auto;
    margin-right: 8px;
  }

  .outline-close {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .outline-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .outline-nav {
    padding: 8px 0;
  }

  .outline-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-size: 13px;
    transition: all 0.15s ease;
  }

  .outline-item:hover {
    background: var(--bg-hover);
  }

  .outline-item.level-1 {
    padding-left: 16px;
    font-weight: 600;
  }

  .outline-item.level-2 {
    padding-left: 28px;
    font-weight: 500;
  }

  .outline-item.level-3 {
    padding-left: 40px;
  }

  .outline-item.level-4 {
    padding-left: 52px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .outline-marker {
    font-size: 10px;
    color: var(--accent);
    font-family: var(--font-mono);
    min-width: 32px;
  }

  .outline-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .outline-number {
    font-size: 9px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-weight: 500;
  }

  .outline-line {
    font-size: 10px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .outline-item:hover .outline-line {
    opacity: 1;
  }

  .outline-item.active {
    background: var(--accent-light, rgba(59, 130, 246, 0.1));
    border-left: 2px solid var(--accent);
  }

  .outline-item.active .outline-number {
    background: var(--accent);
    color: white;
  }

  .outline-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
  }

  .outline-hint {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  /* Backlinks Panel */
  .backlinks-panel {
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    max-height: 280px;
    overflow-y: auto;
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .backlinks-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .backlinks-close {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .backlinks-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .backlinks-section {
    padding: 8px 0;
  }

  .backlinks-section:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .backlinks-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 16px 8px;
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .backlinks-section-icon {
    font-size: 10px;
    opacity: 0.7;
  }

  .backlinks-section-title {
    font-weight: 600;
  }

  .backlinks-count {
    font-size: 10px;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 10px;
    margin-left: auto;
  }

  .backlinks-list {
    display: flex;
    flex-direction: column;
  }

  .backlink-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .backlink-item:hover {
    background: var(--bg-hover);
  }

  .backlink-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .backlink-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .backlink-context {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .backlink-count {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 600;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .backlinks-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-tertiary);
  }

  .backlinks-empty p {
    margin: 0;
    font-size: 13px;
  }

  .backlinks-hint {
    font-size: 11px;
    margin-top: 4px;
    font-family: var(--font-mono);
  }

  .title-wrapper {
    display: flex;
    align-items: center;
    gap: 0;
    position: relative;
  }

  .title-wrapper.has-color {
    background: var(--note-bg);
    border-left: 4px solid var(--note-accent);
    margin: 0 16px;
    border-radius: 0 8px 8px 0;
  }

  .note-color-indicator {
    position: absolute;
    left: -4px;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 4px 0 0 4px;
  }

  .title-input {
    flex: 1;
    padding: 24px 24px 8px;
    border: none;
    background: none;
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary);
    outline: none;
  }

  .title-wrapper.has-color .title-input {
    padding-left: 20px;
  }

  .title-input::placeholder {
    color: var(--text-tertiary);
  }

  /* Color Picker */
  .color-picker-container {
    position: relative;
  }

  .color-btn {
    position: relative;
  }

  .color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--note-color, var(--text-tertiary));
    border: 2px solid var(--bg-primary);
    box-shadow: 0 0 0 1px var(--border);
  }

  .color-picker-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 100;
    min-width: 200px;
  }

  .color-picker-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-tertiary);
    margin-bottom: 10px;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  }

  .color-option {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: var(--color-bg);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .color-option:hover {
    transform: scale(1.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .color-option.selected {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent);
  }

  .color-option.selected::after {
    content: '✓';
    font-size: 10px;
    color: var(--color-accent);
    font-weight: 700;
  }

  .color-option .no-color {
    font-size: 10px;
    color: var(--text-tertiary);
    font-weight: 600;
  }

  .tags-row {
    padding: 0 24px 16px;
  }

  .content-wrapper {
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }

  .content-wrapper.split {
    gap: 1px;
    background: var(--border);
  }

  .content-wrapper.split > * {
    flex: 1;
    min-width: 0;
  }

  .content-wrapper.split-horizontal {
    flex-direction: column;
    gap: 1px;
    background: var(--border);
  }

  .content-wrapper.split-horizontal > * {
    flex: 1;
    min-height: 0;
  }

  .editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    position: relative;
  }

  .format-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .format-group {
    display: flex;
    gap: 2px;
  }

  .format-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .format-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .format-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border);
    color: var(--text-primary);
  }

  .format-btn:active {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }

  .format-toggle {
    margin-left: auto;
    padding: 4px 8px;
    background: none;
    border: none;
    font-size: 10px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
  }

  .format-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .format-show-btn {
    position: absolute;
    top: 8px;
    right: 16px;
    padding: 4px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
    z-index: 10;
    opacity: 0.6;
    transition: all 0.15s ease;
  }

  .format-show-btn:hover {
    opacity: 1;
    background: var(--bg-hover);
  }

  .textarea-container {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Focus Paragraph Mode */
  .textarea-container.focus-paragraph-mode .content-area {
    color: transparent;
    caret-color: var(--text-primary);
  }

  .focus-overlay {
    position: absolute;
    inset: 0;
    padding: 16px;
    pointer-events: none;
    font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
  }

  .focus-paragraph {
    margin-bottom: 1em;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .focus-paragraph.dimmed {
    opacity: 0.25;
    color: var(--text-tertiary);
  }

  .focus-paragraph.active {
    opacity: 1;
    color: var(--text-primary);
    background: var(--bg-hover);
    padding: 8px 12px;
    margin: -8px -12px 1em;
    border-radius: 6px;
    border-left: 3px solid var(--accent);
  }

  /* Drop Zone Overlay */
  .textarea-container.dragging-file {
    position: relative;
  }

  .textarea-container.dragging-file .content-area {
    opacity: 0.3;
  }

  .drop-zone-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-light, rgba(59, 130, 246, 0.1));
    border: 2px dashed var(--accent);
    border-radius: 12px;
    pointer-events: none;
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .drop-zone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px;
    background: var(--bg-primary);
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .drop-icon {
    font-size: 48px;
    animation: bounce 0.6s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .drop-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--accent);
  }

  .link-suggestions {
    position: absolute;
    bottom: 100%;
    left: 24px;
    right: 24px;
    max-width: 400px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 8px;
  }

  .link-suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .link-hint {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .link-suggestion-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    text-align: left;
  }

  .link-suggestion-item:last-child {
    border-bottom: none;
  }

  .link-suggestion-item:hover,
  .link-suggestion-item.selected {
    background: var(--bg-hover);
  }

  .link-suggestion-item.selected {
    background: var(--accent-light);
  }

  .suggestion-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .suggestion-preview {
    font-size: 12px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-no-results {
    padding: 16px 12px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  /* Emoji Suggestions */
  .emoji-suggestions {
    position: absolute;
    bottom: 100%;
    left: 24px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 200px;
    max-width: 280px;
    margin-bottom: 8px;
    overflow: hidden;
  }

  .emoji-suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .emoji-hint {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .emoji-suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease;
  }

  .emoji-suggestion-item:hover,
  .emoji-suggestion-item.selected {
    background: var(--bg-hover);
  }

  .emoji-preview {
    font-size: 20px;
    width: 28px;
    text-align: center;
  }

  .emoji-code {
    font-size: 13px;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  /* Snippet Suggestions */
  .snippet-suggestions {
    position: absolute;
    bottom: 100%;
    left: 24px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 260px;
    max-width: 320px;
    margin-bottom: 8px;
    overflow: hidden;
  }

  .snippet-suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    font-family: var(--font-mono);
  }

  .snippet-hint {
    font-size: 10px;
    color: var(--text-tertiary);
    font-weight: 400;
  }

  .snippet-suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.1s ease;
    border-bottom: 1px solid var(--border);
  }

  .snippet-suggestion-item:last-child {
    border-bottom: none;
  }

  .snippet-suggestion-item:hover,
  .snippet-suggestion-item.selected {
    background: var(--bg-hover);
  }

  .snippet-suggestion-item.selected {
    background: var(--accent-light);
  }

  .snippet-icon {
    font-size: 18px;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
  }

  .snippet-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .snippet-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .snippet-desc {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .backlinks-section {
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .backlinks-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 24px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
  }

  .backlinks-header:hover {
    background: var(--bg-hover);
  }

  .backlinks-icon {
    font-size: 14px;
  }

  .backlinks-title {
    flex: 1;
  }

  /* Broken Links Section */
  .broken-links-section {
    border-top: 1px solid var(--border);
    background: rgba(239, 68, 68, 0.05);
    padding: 12px 24px;
  }

  .broken-links-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .broken-icon {
    font-size: 14px;
  }

  .broken-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--warning);
  }

  .broken-links-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .broken-link-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--bg-primary);
    border: 1px dashed var(--warning);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .broken-link-item:hover {
    background: var(--bg-hover);
    border-style: solid;
    border-color: var(--accent);
  }

  .broken-link-name {
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .broken-link-action {
    color: var(--accent);
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .broken-link-item:hover .broken-link-action {
    opacity: 1;
  }

  .backlinks-toggle {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .backlinks-list {
    padding: 0 24px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .backlink-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .backlink-item:hover {
    border-color: var(--accent);
    background: var(--accent-light);
  }

  .backlink-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .backlink-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .backlink-count {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--accent);
    color: white;
    border-radius: 10px;
    font-weight: 600;
  }

  .backlink-context {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
    word-break: break-word;
  }

  .backlink-preview {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .content-area {
    flex: 1;
    padding: 0 24px;
    border: none;
    background: var(--bg-primary);
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
    outline: none;
    resize: none;
    font-family: var(--font-mono);
  }

  .content-area::placeholder {
    color: var(--text-tertiary);
  }

  .preview-area {
    flex: 1;
    padding: 0 24px;
    overflow-y: auto;
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.7;
  }

  /* Reading Mode */
  .reading-mode {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    background: var(--bg-secondary);
    padding: 48px 24px;
  }

  .reading-progress-indicator {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), #8b5cf6);
    z-index: 100;
    transition: width 0.1s ease-out;
  }

  .reading-container {
    width: 100%;
    max-width: 720px;
  }

  .reading-content {
    background: var(--bg-primary);
    border-radius: 16px;
    padding: 48px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  }

  .reading-title {
    font-size: 2.5em;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 16px;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .reading-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }

  .reading-date {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .reading-stats {
    font-size: 14px;
    color: var(--text-tertiary);
  }

  .reading-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .reading-progress-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-hover);
    border-radius: 4px;
    overflow: hidden;
  }

  .reading-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--success), #34d399);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .reading-progress-text {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .reading-body {
    font-size: 18px;
    line-height: 1.8;
    color: var(--text-primary);
  }

  .reading-body :global(h1) {
    font-size: 1.8em;
    font-weight: 700;
    margin: 1.5em 0 0.5em;
    color: var(--text-primary);
  }

  .reading-body :global(h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 1.2em 0 0.5em;
    color: var(--text-primary);
  }

  .reading-body :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 1em 0 0.5em;
    color: var(--text-primary);
  }

  .reading-body :global(p) {
    margin: 1em 0;
  }

  .reading-body :global(blockquote) {
    margin: 1.5em 0;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-left: 4px solid var(--accent);
    border-radius: 0 8px 8px 0;
    font-style: italic;
  }

  .reading-body :global(pre) {
    margin: 1.5em 0;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 10px;
    overflow-x: auto;
  }

  .reading-body :global(ul),
  .reading-body :global(ol) {
    margin: 1em 0;
    padding-left: 1.5em;
  }

  .reading-body :global(li) {
    margin: 0.5em 0;
  }

  .reading-body :global(img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 1.5em 0;
  }

  .reading-body :global(hr) {
    margin: 2em 0;
    border: none;
    border-top: 1px solid var(--border);
  }

  .reading-body :global(table) {
    width: 100%;
    margin: 1.5em 0;
    border-collapse: collapse;
  }

  .reading-body :global(th),
  .reading-body :global(td) {
    padding: 12px 16px;
    border: 1px solid var(--border);
    text-align: left;
  }

  .reading-body :global(th) {
    background: var(--bg-secondary);
    font-weight: 600;
  }

  /* Reading Theme Selector */
  .reading-theme-selector {
    position: fixed;
    top: 80px;
    right: 24px;
    display: flex;
    gap: 4px;
    background: var(--bg-primary);
    padding: 6px;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    z-index: 99;
  }

  .theme-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.6;
  }

  .theme-btn:hover {
    background: var(--bg-hover);
    opacity: 1;
  }

  .theme-btn.active {
    background: var(--bg-secondary);
    opacity: 1;
  }

  .theme-icon {
    font-size: 16px;
  }

  /* Reading Theme: Sepia */
  .reading-theme-sepia {
    background: #f4ecd8 !important;
  }

  .reading-theme-sepia .reading-content {
    background: #faf6eb;
    box-shadow: 0 2px 16px rgba(139, 109, 59, 0.1);
  }

  .reading-theme-sepia .reading-title,
  .reading-theme-sepia .reading-body,
  .reading-theme-sepia .reading-body :global(h1),
  .reading-theme-sepia .reading-body :global(h2),
  .reading-theme-sepia .reading-body :global(h3),
  .reading-theme-sepia .reading-body :global(p),
  .reading-theme-sepia .reading-body :global(li) {
    color: #5c4b32 !important;
  }

  .reading-theme-sepia .reading-date,
  .reading-theme-sepia .reading-stats,
  .reading-theme-sepia .reading-progress-text {
    color: #8b7355 !important;
  }

  .reading-theme-sepia .reading-meta {
    border-bottom-color: #ddd5c3;
  }

  .reading-theme-sepia .reading-body :global(blockquote) {
    background: #f0e8d8;
    border-left-color: #c4a86c;
  }

  .reading-theme-sepia .reading-body :global(pre),
  .reading-theme-sepia .reading-body :global(code) {
    background: #f0e8d8;
    color: #5c4b32;
  }

  .reading-theme-sepia .reading-progress {
    background: #f0e8d8;
  }

  .reading-theme-sepia .reading-progress-bar {
    background: #e0d8c8;
  }

  /* Reading Theme: Warm */
  .reading-theme-warm {
    background: #fff5eb !important;
  }

  .reading-theme-warm .reading-content {
    background: #fffaf5;
    box-shadow: 0 2px 16px rgba(255, 140, 60, 0.08);
  }

  .reading-theme-warm .reading-title,
  .reading-theme-warm .reading-body,
  .reading-theme-warm .reading-body :global(h1),
  .reading-theme-warm .reading-body :global(h2),
  .reading-theme-warm .reading-body :global(h3),
  .reading-theme-warm .reading-body :global(p),
  .reading-theme-warm .reading-body :global(li) {
    color: #4a3c2d !important;
  }

  .reading-theme-warm .reading-date,
  .reading-theme-warm .reading-stats,
  .reading-theme-warm .reading-progress-text {
    color: #8b7355 !important;
  }

  .reading-theme-warm .reading-meta {
    border-bottom-color: #f0e0d0;
  }

  .reading-theme-warm .reading-body :global(blockquote) {
    background: #fff0e5;
    border-left-color: #ff9966;
  }

  .reading-theme-warm .reading-body :global(pre),
  .reading-theme-warm .reading-body :global(code) {
    background: #fff0e5;
    color: #4a3c2d;
  }

  .reading-theme-warm .reading-progress {
    background: #fff0e5;
  }

  .reading-theme-warm .reading-progress-bar {
    background: #ffe8d8;
  }

  /* Reading Theme: Night */
  .reading-theme-night {
    background: #1a1a2e !important;
  }

  .reading-theme-night .reading-content {
    background: #16213e;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
  }

  .reading-theme-night .reading-title,
  .reading-theme-night .reading-body,
  .reading-theme-night .reading-body :global(h1),
  .reading-theme-night .reading-body :global(h2),
  .reading-theme-night .reading-body :global(h3),
  .reading-theme-night .reading-body :global(p),
  .reading-theme-night .reading-body :global(li) {
    color: #e0e0e0 !important;
  }

  .reading-theme-night .reading-date,
  .reading-theme-night .reading-stats,
  .reading-theme-night .reading-progress-text {
    color: #8899aa !important;
  }

  .reading-theme-night .reading-meta {
    border-bottom-color: #2a2a4e;
  }

  .reading-theme-night .reading-body :global(blockquote) {
    background: #1f2940;
    border-left-color: #4f8cff;
  }

  .reading-theme-night .reading-body :global(pre),
  .reading-theme-night .reading-body :global(code) {
    background: #1f2940;
    color: #e0e0e0;
  }

  .reading-theme-night .reading-body :global(a) {
    color: #6ea8fe;
  }

  .reading-theme-night .reading-progress {
    background: #1f2940;
  }

  .reading-theme-night .reading-progress-bar {
    background: #2a3a5e;
  }

  .reading-theme-night .reading-progress-indicator {
    background: linear-gradient(90deg, #4f8cff, #8b5cf6);
  }

  .reading-theme-night .reading-theme-selector {
    background: #16213e;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }

  .reading-theme-night .theme-btn:hover {
    background: #1f2940;
  }

  .reading-theme-night .theme-btn.active {
    background: #2a3a5e;
  }

  /* Presentation Mode */
  .editor.presentation-active {
    background: #0a0a0a;
  }

  .editor.presentation-active .editor-toolbar,
  .editor.presentation-active .editor-footer,
  .editor.presentation-active .backlinks-section {
    display: none;
  }

  .presentation-mode {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
    padding: 48px;
    position: relative;
    overflow: hidden;
  }

  .presentation-slide {
    max-width: 1000px;
    width: 100%;
    text-align: center;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .slide-title {
    font-size: 3.5em;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 48px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  }

  .slide-content {
    font-size: 1.5em;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.8;
    text-align: left;
    max-width: 800px;
    margin: 0 auto;
  }

  .slide-content :global(h1),
  .slide-content :global(h2),
  .slide-content :global(h3) {
    color: #ffffff;
  }

  .slide-content :global(p) {
    margin: 1em 0;
  }

  .slide-content :global(ul),
  .slide-content :global(ol) {
    margin: 1em 0;
    padding-left: 1.5em;
  }

  .slide-content :global(li) {
    margin: 0.75em 0;
  }

  .slide-content :global(code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    color: #a5d8ff;
  }

  .slide-content :global(pre) {
    background: rgba(0, 0, 0, 0.4);
    padding: 20px;
    border-radius: 12px;
    overflow-x: auto;
    text-align: left;
  }

  .slide-content :global(blockquote) {
    border-left: 4px solid #8b5cf6;
    padding-left: 24px;
    color: rgba(255, 255, 255, 0.8);
    font-style: italic;
    margin: 1.5em 0;
  }

  .slide-content :global(strong) {
    color: #ffffff;
    font-weight: 600;
  }

  .slide-content :global(a) {
    color: #8b5cf6;
  }

  .presentation-controls {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    padding: 12px 24px;
    border-radius: 40px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .pres-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: #ffffff;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pres-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .pres-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .pres-btn.exit-btn {
    background: rgba(255, 100, 100, 0.2);
  }

  .pres-btn.exit-btn:hover {
    background: rgba(255, 100, 100, 0.4);
  }

  .slide-counter {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    min-width: 60px;
    text-align: center;
  }

  .presentation-progress {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
  }

  .presentation-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #3b82f6);
    transition: width 0.3s ease;
  }

  .preview-area :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0.5em 0;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }

  .preview-area :global(h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 0.5em 0;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3em;
  }

  .preview-area :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.5em 0;
  }

  .preview-area :global(h4),
  .preview-area :global(h5),
  .preview-area :global(h6) {
    font-size: 1em;
    font-weight: 600;
    margin: 0.5em 0;
  }

  /* Sticky Headings */
  .preview-area :global(.sticky-heading) {
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 10;
    padding: 8px 0;
    margin-left: -16px;
    margin-right: -16px;
    padding-left: 16px;
    padding-right: 16px;
    border-bottom: 1px solid transparent;
    transition: all 0.2s ease;
  }

  .preview-area :global(.sticky-heading:hover) {
    background: var(--bg-secondary);
  }

  .preview-area :global(h1.sticky-heading) {
    top: 0;
    z-index: 16;
  }

  .preview-area :global(h2.sticky-heading) {
    top: 0;
    z-index: 15;
  }

  .preview-area :global(h3.sticky-heading) {
    top: 0;
    z-index: 14;
  }

  .preview-area :global(h4.sticky-heading),
  .preview-area :global(h5.sticky-heading),
  .preview-area :global(h6.sticky-heading) {
    top: 0;
    z-index: 13;
  }

  /* Add anchor link icon on hover */
  .preview-area :global(.sticky-heading::before) {
    content: '#';
    position: absolute;
    left: 0;
    opacity: 0;
    color: var(--text-tertiary);
    transition: opacity 0.15s ease;
    font-weight: 400;
  }

  .preview-area :global(.sticky-heading:hover::before) {
    opacity: 0.5;
  }

  .preview-area :global(.sticky-heading) {
    position: sticky;
    padding-left: 24px;
  }

  .preview-area :global(p) {
    margin: 0.5em 0;
  }

  .preview-area :global(code) {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .preview-area :global(pre) {
    background: var(--bg-tertiary);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }

  .preview-area :global(pre code) {
    background: none;
    padding: 0;
  }

  .preview-area :global(.code-block) {
    position: relative;
  }

  .preview-area :global(.code-block)::before {
    content: attr(class);
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
  }

  .preview-area :global(.hl-keyword) {
    color: #c678dd;
    font-weight: 500;
  }

  .preview-area :global(.hl-string) {
    color: #98c379;
  }

  .preview-area :global(.hl-number) {
    color: #d19a66;
  }

  .preview-area :global(.hl-comment) {
    color: #5c6370;
    font-style: italic;
  }

  .preview-area :global(.hl-function) {
    color: #61afef;
  }

  :global(.dark) .preview-area :global(.hl-keyword) {
    color: #c678dd;
  }

  :global(.dark) .preview-area :global(.hl-string) {
    color: #98c379;
  }

  :global(.dark) .preview-area :global(.hl-number) {
    color: #d19a66;
  }

  :global(.dark) .preview-area :global(.hl-comment) {
    color: #5c6370;
  }

  :global(.dark) .preview-area :global(.hl-function) {
    color: #61afef;
  }

  .preview-area :global(blockquote) {
    border-left: 4px solid var(--accent);
    padding-left: 16px;
    margin: 1em 0;
    color: var(--text-secondary);
  }

  .preview-area :global(ul),
  .preview-area :global(ol) {
    padding-left: 24px;
    margin: 0.5em 0;
  }

  .preview-area :global(li) {
    margin: 0.25em 0;
  }

  .preview-area :global(a) {
    color: var(--accent);
    text-decoration: none;
  }

  .preview-area :global(a:hover) {
    text-decoration: underline;
  }

  .preview-area :global(.note-link) {
    color: var(--accent);
    background: var(--accent-light);
    padding: 1px 4px;
    border-radius: 4px;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preview-area :global(.note-link:hover) {
    background: var(--accent);
    color: white;
  }

  .preview-area :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1.5em 0;
  }

  .preview-area :global(img) {
    max-width: 100%;
    border-radius: 8px;
  }

  .preview-area :global(del) {
    color: var(--text-tertiary);
  }

  .preview-area :global(.md-table) {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 14px;
  }

  .preview-area :global(.md-table th),
  .preview-area :global(.md-table td) {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }

  .preview-area :global(.md-table th) {
    background: var(--bg-secondary);
    font-weight: 600;
  }

  .preview-area :global(.md-table tr:nth-child(even)) {
    background: var(--bg-secondary);
  }

  .preview-area :global(.md-table tr:hover) {
    background: var(--bg-hover);
  }

  .preview-area :global(.task) {
    list-style: none;
    margin-left: -20px;
  }

  .preview-area :global(.task input) {
    margin-right: 8px;
  }

  .editor-footer {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .footer-left,
  .footer-right {
    flex: 1;
  }

  .footer-right {
    text-align: right;
  }

  .footer-stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .save-status {
    font-size: 11px;
    color: var(--success);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .save-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .save-icon svg {
    display: block;
  }

  .save-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .save-text {
    font-size: 10px;
    font-weight: 500;
  }

  .save-status.saving {
    color: var(--warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .save-status.just-saved {
    color: var(--accent);
    background: rgba(99, 102, 241, 0.15);
    animation: save-flash 0.5s ease;
  }

  .save-status.modified {
    color: var(--warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .modified-dot {
    width: 8px;
    height: 8px;
    background: var(--warning);
    border-radius: 50%;
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.9); }
  }

  @keyframes save-flash {
    0% { transform: scale(1.05); background: rgba(99, 102, 241, 0.25); }
    100% { transform: scale(1); background: rgba(99, 102, 241, 0.15); }
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--accent);
  }

  .typing-dot {
    width: 4px;
    height: 4px;
    background: var(--accent);
    border-radius: 50%;
    animation: typingBounce 1.4s ease-in-out infinite;
  }

  .typing-dot:nth-child(1) {
    animation-delay: 0s;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typingBounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .typing-text {
    margin-left: 4px;
    font-weight: 500;
  }

  .stat {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .stat-btn {
    font-size: 11px;
    color: var(--text-tertiary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .stat-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
  }

  .stat-btn.typewriter-toggle {
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .stat-btn.typewriter-toggle.active,
  .stat-btn.focus-toggle.active {
    background: var(--accent);
    color: white;
  }

  .stat-btn.focus-toggle {
    font-size: 14px;
    font-weight: 600;
  }

  .stat-btn.session-toggle {
    font-size: 12px;
  }

  .stat-btn.session-toggle.active {
    background: var(--success);
    color: white;
    animation: pulse-session 2s infinite;
  }

  .stat-btn.reminders-btn {
    position: relative;
  }

  .reminder-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    background: var(--error);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-badge 2s infinite;
  }

  @keyframes pulse-badge {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .stat-btn.outline-btn {
    position: relative;
  }

  .stat-btn.outline-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stat-btn.outline-btn.active {
    background: var(--accent);
    color: white;
  }

  .outline-count {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-tertiary);
    margin-left: 2px;
  }

  .stat-btn.outline-btn.active .outline-count {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Outline Panel */
  .outline-panel {
    position: absolute;
    bottom: 100%;
    right: 0;
    width: 300px;
    max-height: 400px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    margin-bottom: 8px;
    animation: slideUp 0.15s ease;
  }

  .outline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .outline-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .outline-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-tertiary);
    cursor: pointer;
    font-size: 14px;
  }

  .outline-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .outline-list {
    max-height: 340px;
    overflow-y: auto;
    padding: 8px;
  }

  .outline-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .outline-item:hover {
    background: var(--bg-hover);
  }

  .outline-item.level-1 { padding-left: 12px; }
  .outline-item.level-2 { padding-left: 24px; }
  .outline-item.level-3 { padding-left: 36px; }
  .outline-item.level-4 { padding-left: 48px; }
  .outline-item.level-5 { padding-left: 60px; }
  .outline-item.level-6 { padding-left: 72px; }

  .outline-marker {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--accent);
    opacity: 0.7;
    min-width: 28px;
  }

  .outline-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .outline-item.level-1 .outline-text {
    font-weight: 600;
  }

  .outline-item.level-2 .outline-text {
    font-weight: 500;
  }

  .outline-line {
    font-size: 10px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
  }

  .outline-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  @keyframes pulse-session {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .session-stats {
    font-size: 11px;
    color: var(--success);
    font-weight: 500;
    padding: 2px 8px;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 4px;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Task progress mini (in footer) */
  .task-progress-mini {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .task-bar-mini {
    width: 40px;
    height: 4px;
    background: var(--bg-hover);
    border-radius: 2px;
    overflow: hidden;
  }

  .task-fill-mini {
    height: 100%;
    background: var(--success);
    transition: width 0.3s ease;
  }

  .task-text-mini {
    font-size: 10px;
    color: var(--text-tertiary);
    min-width: 28px;
  }

  /* Advanced stats panel */
  .advanced-stats-panel {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    padding: 16px 24px;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-item.task-stat {
    grid-column: span 2;
  }

  .task-progress-detail {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 200px;
  }

  .task-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-hover);
    border-radius: 4px;
    overflow: hidden;
  }

  .task-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--success), #34d399);
    transition: width 0.3s ease;
    border-radius: 4px;
  }

  .stats-section {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .stats-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .stats-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-tertiary);
    margin-bottom: 10px;
  }

  .stats-grid.compact {
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }

  .stat-item.mini .stat-value {
    font-size: 14px;
  }

  .stat-item.mini .stat-label {
    font-size: 9px;
  }

  .readability-score {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .readability-gauge {
    height: 8px;
    background: var(--bg-hover);
    border-radius: 4px;
    overflow: hidden;
  }

  .readability-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .readability-fill.easy {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  .readability-fill.medium {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  .readability-fill.hard {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .readability-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .readability-level {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .readability-number {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .task-progress-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .task-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .task-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .task-percent {
    font-size: 12px;
    color: var(--success);
    font-weight: 500;
  }

  .top-words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .top-word {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-primary);
  }

  .top-word .word-count {
    font-size: 10px;
    color: var(--text-tertiary);
    padding: 1px 5px;
    background: var(--bg-hover);
    border-radius: 8px;
  }

  .cursor-pos {
    font-family: var(--font-mono);
    font-size: 11px;
    min-width: 85px;
  }

  .stat-divider {
    color: var(--border);
    font-size: 10px;
  }

  .footer-center {
    flex: 2;
    display: flex;
    justify-content: center;
  }

  .word-goal-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    min-width: 220px;
  }

  .word-goal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .goal-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .goal-close {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .goal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .goal-progress-bar {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
  }

  .goal-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .goal-progress-fill.reached {
    background: var(--success);
  }

  .goal-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .goal-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--bg-tertiary);
    border-radius: 2px;
    cursor: pointer;
  }

  .goal-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }

  .goal-number {
    width: 60px;
    padding: 4px 6px;
    font-size: 11px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    text-align: center;
  }

  .goal-reached-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--success);
    background: var(--success-light);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* Character Limit Styles */
  .char-limit-btn {
    transition: all 0.2s ease;
  }

  .char-limit-btn.warning {
    color: var(--warning) !important;
  }

  .char-limit-btn.exceeded {
    color: var(--error) !important;
  }

  .char-limit-indicator {
    font-size: 10px;
    opacity: 0.7;
  }

  .char-limit-indicator.warning {
    color: var(--warning);
    opacity: 1;
  }

  .char-limit-indicator.exceeded {
    color: var(--error);
    opacity: 1;
  }

  .char-limit-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    min-width: 280px;
  }

  .char-limit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .char-limit-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .char-limit-close {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .char-limit-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .char-limit-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .char-limit-toggle input[type="checkbox"] {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .char-limit-config {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .char-limit-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-btn {
    padding: 4px 10px;
    font-size: 11px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .preset-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .char-limit-custom {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .char-limit-input {
    flex: 1;
    padding: 6px 10px;
    font-size: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .char-limit-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .char-limit-unit {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .char-limit-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .char-limit-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }

  .char-limit-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: all 0.3s ease;
  }

  .char-limit-fill.warning {
    background: var(--warning);
  }

  .char-limit-fill.exceeded {
    background: var(--error);
  }

  .char-limit-status {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .char-limit-status.warning {
    color: var(--warning);
  }

  .char-limit-status.exceeded {
    color: var(--error);
  }

  .char-limit-status .over-limit {
    color: var(--error);
    font-weight: 500;
  }

  .char-limit-status .remaining {
    opacity: 0.7;
  }

  .meta {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .empty-editor {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
  }

  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 8px;
    opacity: 0.6;
  }

  .empty-content h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
  }

  .empty-content p {
    font-size: 14px;
    color: var(--text-tertiary);
    margin: 0;
  }

  .shortcut-hint {
    margin-top: 16px;
  }

  .shortcut-hint kbd {
    padding: 2px 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .editor-toolbar {
      padding: 8px 16px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .notebook-select {
      flex: 1;
      min-width: 120px;
    }

    .view-toggle {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .toolbar-actions {
      gap: 4px;
    }

    .title-input {
      padding: 16px 16px 8px;
      font-size: 22px;
    }

    .tags-row {
      padding: 0 16px 12px;
    }

    .content-area {
      padding: 0 16px;
      font-size: 16px;
    }

    .preview-area {
      padding: 0 16px;
    }

    .editor-footer {
      padding: 6px 16px;
      flex-direction: column;
      gap: 4px;
    }

    .footer-left, .footer-right {
      width: 100%;
      text-align: center;
    }

    .footer-center {
      width: 100%;
    }

    .backlinks-section {
      padding-bottom: 64px; /* Space for mobile nav */
    }
  }

  /* Context Menu Styles */
  .context-menu {
    position: fixed;
    z-index: 1100;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    min-width: 200px;
    padding: 6px 0;
    animation: contextMenuFadeIn 0.15s ease;
  }

  @keyframes contextMenuFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 14px;
    border: none;
    background: none;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .context-item:hover {
    background: var(--bg-hover);
  }

  .context-item:active {
    background: var(--accent-light);
  }

  .context-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
  }

  .context-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 6px 0;
  }

  /* Link Preview Tooltip */
  .link-preview-tooltip {
    position: fixed;
    z-index: 1100;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    width: 320px;
    max-height: 240px;
    overflow: hidden;
    animation: tooltipFadeIn 0.15s ease;
    pointer-events: auto;
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .link-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .link-preview-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .link-preview-date {
    font-size: 11px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .link-preview-content {
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
    max-height: 140px;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .link-preview-hint {
    padding: 8px 14px;
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    text-align: center;
  }

  /* Dictionary Definition Modal */
  .definition-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 24px;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .definition-modal {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .definition-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .definition-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .def-icon {
    font-size: 18px;
  }

  .def-close-btn {
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
    transition: all 0.15s;
  }

  .def-close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .definition-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .def-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 16px;
    color: var(--text-secondary);
  }

  .def-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .def-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 20px;
    gap: 8px;
  }

  .def-error-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .def-error p {
    margin: 0;
    color: var(--text-secondary);
  }

  .def-error-hint {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .def-word-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .def-word {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .def-phonetic {
    font-size: 14px;
    color: var(--text-secondary);
    font-style: italic;
  }

  .def-audio-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .def-audio-btn:hover {
    background: var(--accent);
    border-color: var(--accent);
  }

  .def-meanings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .def-meaning {
    border-left: 3px solid var(--accent);
    padding-left: 16px;
  }

  .def-pos {
    display: inline-block;
    padding: 2px 10px;
    background: var(--accent-light);
    color: var(--accent);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .def-definitions {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .def-definitions li {
    color: var(--text-secondary);
  }

  .def-text {
    margin: 0 0 4px;
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
  }

  .def-example {
    margin: 4px 0;
    font-size: 13px;
    font-style: italic;
    color: var(--text-tertiary);
  }

  .def-synonyms {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .def-synonyms strong {
    color: var(--text-primary);
  }

  .def-source {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .def-source a {
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
  }

  .def-source a:hover {
    text-decoration: underline;
  }

  .definition-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    border-radius: 0 0 12px 12px;
  }

  .def-btn-secondary {
    padding: 8px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .def-btn-secondary:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .def-btn-primary {
    padding: 8px 16px;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 0.15s;
  }

  .def-btn-primary:hover {
    filter: brightness(1.1);
  }

  /* Selection Toolbar (Quick Actions) */
  .selection-toolbar {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 1100;
    animation: toolbarPop 0.15s ease;
  }

  @keyframes toolbarPop {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .sel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.1s ease;
  }

  .sel-btn:hover {
    background: var(--bg-hover);
  }

  .sel-btn:active {
    transform: scale(0.95);
  }

  .sel-btn strong {
    font-weight: 700;
  }

  .sel-btn em {
    font-style: italic;
  }

  .sel-btn s {
    text-decoration: line-through;
  }

  .sel-btn code {
    font-family: var(--font-mono);
    font-size: 10px;
    background: none;
    padding: 0;
  }

  .sel-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .sel-chars {
    font-size: 10px;
    color: var(--text-tertiary);
    margin-left: 6px;
    padding: 2px 8px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  /* Find and Replace Styles */
  .find-replace-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    animation: slideDown 0.15s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .find-row,
  .replace-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .find-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .find-input:focus {
    border-color: var(--accent);
  }

  .match-count {
    font-size: 12px;
    color: var(--text-tertiary);
    min-width: 60px;
    text-align: center;
  }

  .find-btn {
    padding: 6px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .find-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .find-options {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .find-option {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .find-option input {
    display: none;
  }

  .find-option span {
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .find-option input:checked + span {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .find-close {
    margin-left: auto;
    padding: 4px 8px;
    background: none;
    border: none;
    font-size: 14px;
    color: var(--text-tertiary);
    cursor: pointer;
    border-radius: 4px;
  }

  .find-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Regex-specific styles */
  .find-input.error {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .find-replace-panel.has-error {
    border-bottom-color: rgba(239, 68, 68, 0.3);
  }

  .regex-error-badge {
    color: #ef4444;
    font-weight: 600;
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    cursor: help;
  }

  .regex-error-message {
    font-size: 11px;
    color: #ef4444;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .replace-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 6px 10px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 4px;
  }

  .preview-label {
    color: var(--text-tertiary);
    font-weight: 500;
  }

  .preview-text {
    color: #10b981;
    font-family: var(--font-mono);
    word-break: break-all;
  }

  .find-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .find-option.disabled span {
    cursor: not-allowed;
  }

  .find-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .find-btn:disabled:hover {
    background: var(--bg-primary);
    border-color: var(--border);
  }

  .regex-help-btn {
    min-width: 28px;
    font-weight: 600;
    font-size: 13px;
  }

  .regex-help-panel {
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .regex-help-title {
    font-weight: 600;
    font-size: 12px;
    color: var(--text-primary);
    margin-bottom: 10px;
  }

  .regex-help-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }

  .regex-help-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .regex-help-item code {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 5px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--accent);
  }

  .regex-help-item span {
    color: var(--text-secondary);
  }

  .regex-help-subtitle {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .regex-help-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .regex-example {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .regex-example:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .regex-example code {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent);
  }

  /* Search History Styles */
  .history-btn {
    font-size: 14px;
  }

  .history-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .search-history-panel {
    padding: 10px;
    background: var(--bg-tertiary);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .search-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .search-history-title {
    font-weight: 600;
    font-size: 12px;
    color: var(--text-primary);
  }

  .search-history-clear {
    padding: 3px 8px;
    font-size: 10px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .search-history-clear:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .search-history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .search-history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .search-history-item:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }

  .search-history-query {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .search-history-badge {
    font-size: 9px;
    padding: 2px 5px;
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .search-history-time {
    font-size: 10px;
    color: var(--text-tertiary);
    white-space: nowrap;
  }
</style>
