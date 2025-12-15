/**
 * Customizable keyboard shortcuts system
 * Allows users to customize keyboard shortcuts with persistence
 */

export interface ShortcutBinding {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultKeys: ShortcutKeys;
  customKeys?: ShortcutKeys;
}

export interface ShortcutKeys {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const SHORTCUTS_KEY = 'viny-custom-shortcuts';

// Default shortcut definitions
export const defaultShortcuts: ShortcutBinding[] = [
  // Notes
  { id: 'new-note', name: 'New Note', description: 'Create a new note', category: 'Notes', defaultKeys: { key: 'n', meta: true } },
  { id: 'new-from-template', name: 'New from Template', description: 'Create note from template', category: 'Notes', defaultKeys: { key: 'n', meta: true, shift: true } },
  { id: 'duplicate-note', name: 'Duplicate Note', description: 'Duplicate current note', category: 'Notes', defaultKeys: { key: 'd', meta: true } },
  { id: 'delete-note', name: 'Delete Note', description: 'Delete current note', category: 'Notes', defaultKeys: { key: 'Backspace', meta: true } },
  { id: 'toggle-pin', name: 'Toggle Pin', description: 'Pin or unpin current note', category: 'Notes', defaultKeys: { key: 'p', meta: true, shift: true } },
  { id: 'copy-note', name: 'Copy to Clipboard', description: 'Copy note content', category: 'Notes', defaultKeys: { key: 'c', meta: true, shift: true } },

  // Navigation
  { id: 'command-palette', name: 'Command Palette', description: 'Open command palette', category: 'Navigation', defaultKeys: { key: 'k', meta: true } },
  { id: 'quick-search', name: 'Quick Search', description: 'Search notes', category: 'Navigation', defaultKeys: { key: 'p', meta: true } },
  { id: 'global-search', name: 'Global Search', description: 'Search all content', category: 'Navigation', defaultKeys: { key: 'f', meta: true, shift: true } },
  { id: 'note-graph', name: 'Note Graph', description: 'Open note graph view', category: 'Navigation', defaultKeys: { key: 'g', meta: true, shift: true } },
  { id: 'go-back', name: 'Go Back', description: 'Navigate to previous note', category: 'Navigation', defaultKeys: { key: '[', meta: true } },
  { id: 'go-forward', name: 'Go Forward', description: 'Navigate to next note', category: 'Navigation', defaultKeys: { key: ']', meta: true } },

  // View
  { id: 'toggle-focus', name: 'Toggle Focus Mode', description: 'Enter/exit focus mode', category: 'View', defaultKeys: { key: '\\', meta: true } },
  { id: 'toggle-dark-mode', name: 'Toggle Dark Mode', description: 'Switch theme', category: 'View', defaultKeys: { key: 'd', meta: true, shift: true } },
  { id: 'toggle-view-mode', name: 'Toggle View Mode', description: 'Switch edit/preview', category: 'View', defaultKeys: { key: 'e', meta: true } },
  { id: 'toggle-sidebar', name: 'Toggle Sidebar', description: 'Show/hide sidebar', category: 'View', defaultKeys: { key: 'b', meta: true } },

  // Editor
  { id: 'find-replace', name: 'Find & Replace', description: 'Search in current note', category: 'Editor', defaultKeys: { key: 'f', meta: true } },
  { id: 'save-note', name: 'Save Note', description: 'Save current note', category: 'Editor', defaultKeys: { key: 's', meta: true } },
  { id: 'bold', name: 'Bold', description: 'Make text bold', category: 'Editor', defaultKeys: { key: 'b', meta: true } },
  { id: 'italic', name: 'Italic', description: 'Make text italic', category: 'Editor', defaultKeys: { key: 'i', meta: true } },

  // App
  { id: 'settings', name: 'Settings', description: 'Open settings', category: 'App', defaultKeys: { key: ',', meta: true } },
  { id: 'shortcuts-help', name: 'Keyboard Shortcuts', description: 'Show shortcuts help', category: 'App', defaultKeys: { key: '/', meta: true } },
  { id: 'writing-stats', name: 'Writing Stats', description: 'Show writing statistics', category: 'App', defaultKeys: { key: 'y', meta: true } },
  { id: 'pomodoro', name: 'Pomodoro Timer', description: 'Open pomodoro timer', category: 'App', defaultKeys: { key: 't', meta: true, shift: true } },
];

// Load custom shortcuts from localStorage
function loadCustomShortcuts(): Record<string, ShortcutKeys> {
  try {
    const stored = localStorage.getItem(SHORTCUTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save custom shortcuts to localStorage
function saveCustomShortcuts(shortcuts: Record<string, ShortcutKeys>): void {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
}

// Get all shortcuts with custom overrides applied
export function getShortcuts(): ShortcutBinding[] {
  const customKeys = loadCustomShortcuts();
  return defaultShortcuts.map(shortcut => ({
    ...shortcut,
    customKeys: customKeys[shortcut.id],
  }));
}

// Get effective keys for a shortcut (custom or default)
export function getEffectiveKeys(shortcut: ShortcutBinding): ShortcutKeys {
  return shortcut.customKeys || shortcut.defaultKeys;
}

// Set custom keys for a shortcut
export function setCustomKeys(shortcutId: string, keys: ShortcutKeys): void {
  const customKeys = loadCustomShortcuts();
  customKeys[shortcutId] = keys;
  saveCustomShortcuts(customKeys);
}

// Reset a shortcut to default
export function resetShortcut(shortcutId: string): void {
  const customKeys = loadCustomShortcuts();
  delete customKeys[shortcutId];
  saveCustomShortcuts(customKeys);
}

// Reset all shortcuts to defaults
export function resetAllShortcuts(): void {
  localStorage.removeItem(SHORTCUTS_KEY);
}

// Check if a shortcut has been customized
export function isCustomized(shortcutId: string): boolean {
  const customKeys = loadCustomShortcuts();
  return shortcutId in customKeys;
}

// Format shortcut keys for display
export function formatKeys(keys: ShortcutKeys, isMac: boolean): string {
  const parts: string[] = [];
  if (keys.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (keys.meta) parts.push(isMac ? '⌘' : 'Ctrl');
  if (keys.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (keys.shift) parts.push(isMac ? '⇧' : 'Shift');

  // Format key name
  let keyName = keys.key.toUpperCase();
  if (keyName === 'BACKSPACE') keyName = isMac ? '⌫' : 'Backspace';
  if (keyName === 'DELETE') keyName = isMac ? '⌦' : 'Del';
  if (keyName === 'ENTER') keyName = isMac ? '↵' : 'Enter';
  if (keyName === 'ESCAPE') keyName = 'Esc';
  if (keyName === 'ARROWUP') keyName = '↑';
  if (keyName === 'ARROWDOWN') keyName = '↓';
  if (keyName === 'ARROWLEFT') keyName = '←';
  if (keyName === 'ARROWRIGHT') keyName = '→';
  if (keyName === ' ') keyName = 'Space';

  parts.push(keyName);
  return parts.join(isMac ? '' : '+');
}

// Parse a key string back to ShortcutKeys
export function parseKeyEvent(e: KeyboardEvent): ShortcutKeys {
  return {
    key: e.key,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

// Check if two shortcut keys are equal
export function keysEqual(a: ShortcutKeys, b: ShortcutKeys): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.ctrl === !!b.ctrl &&
    !!a.meta === !!b.meta &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

// Check if a key combination matches a shortcut
export function matchesShortcut(e: KeyboardEvent, keys: ShortcutKeys): boolean {
  return (
    e.key.toLowerCase() === keys.key.toLowerCase() &&
    e.ctrlKey === !!keys.ctrl &&
    e.metaKey === !!keys.meta &&
    e.shiftKey === !!keys.shift &&
    e.altKey === !!keys.alt
  );
}

// Get shortcut by ID
export function getShortcutById(id: string): ShortcutBinding | undefined {
  return getShortcuts().find(s => s.id === id);
}

// Check for conflicting shortcuts
export function findConflict(keys: ShortcutKeys, excludeId?: string): ShortcutBinding | undefined {
  const shortcuts = getShortcuts();
  return shortcuts.find(s => {
    if (s.id === excludeId) return false;
    const effectiveKeys = getEffectiveKeys(s);
    return keysEqual(effectiveKeys, keys);
  });
}

// Get shortcuts grouped by category
export function getShortcutsByCategory(): Record<string, ShortcutBinding[]> {
  const shortcuts = getShortcuts();
  const grouped: Record<string, ShortcutBinding[]> = {};

  for (const shortcut of shortcuts) {
    if (!grouped[shortcut.category]) {
      grouped[shortcut.category] = [];
    }
    grouped[shortcut.category].push(shortcut);
  }

  return grouped;
}
