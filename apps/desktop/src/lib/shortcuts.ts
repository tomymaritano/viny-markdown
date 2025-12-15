/**
 * Keyboard shortcuts system for Viny
 */

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean; // Cmd on Mac
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  private getKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape and some shortcuts even in inputs
      if (e.key !== 'Escape' && !(e.metaKey || e.ctrlKey)) {
        return;
      }
    }

    const key = this.getKey(e);
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
    }
  }

  register(shortcut: Shortcut) {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.meta) parts.push('meta');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());

    const key = parts.join('+');
    this.shortcuts.set(key, shortcut);
  }

  unregister(key: string) {
    this.shortcuts.delete(key);
  }

  disable() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

export const shortcuts = new ShortcutManager();

// Platform detection
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
export const modKey = isMac ? 'meta' : 'ctrl';
export const modKeySymbol = isMac ? '⌘' : 'Ctrl';

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.meta) parts.push('⌘');
  if (shortcut.shift) parts.push('⇧');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(shortcut.key.toUpperCase());
  return parts.join(isMac ? '' : '+');
}
