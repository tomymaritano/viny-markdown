/**
 * Note color management
 * Stores note colors in localStorage since backend doesn't support it
 */

export interface NoteColor {
  id: string;
  name: string;
  bg: string;
  border: string;
  text: string;
  accent: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { id: 'none', name: 'Default', bg: 'transparent', border: 'var(--border)', text: 'var(--text-primary)', accent: 'var(--accent)' },
  { id: 'red', name: 'Red', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', text: '#dc2626', accent: '#ef4444' },
  { id: 'orange', name: 'Orange', bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.3)', text: '#ea580c', accent: '#f97316' },
  { id: 'amber', name: 'Amber', bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', text: '#d97706', accent: '#f59e0b' },
  { id: 'yellow', name: 'Yellow', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.3)', text: '#ca8a04', accent: '#eab308' },
  { id: 'lime', name: 'Lime', bg: 'rgba(132, 204, 22, 0.08)', border: 'rgba(132, 204, 22, 0.3)', text: '#65a30d', accent: '#84cc16' },
  { id: 'green', name: 'Green', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.3)', text: '#16a34a', accent: '#22c55e' },
  { id: 'teal', name: 'Teal', bg: 'rgba(20, 184, 166, 0.08)', border: 'rgba(20, 184, 166, 0.3)', text: '#0d9488', accent: '#14b8a6' },
  { id: 'cyan', name: 'Cyan', bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.3)', text: '#0891b2', accent: '#06b6d4' },
  { id: 'blue', name: 'Blue', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', text: '#2563eb', accent: '#3b82f6' },
  { id: 'indigo', name: 'Indigo', bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.3)', text: '#4f46e5', accent: '#6366f1' },
  { id: 'violet', name: 'Violet', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', text: '#7c3aed', accent: '#8b5cf6' },
  { id: 'purple', name: 'Purple', bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.3)', text: '#9333ea', accent: '#a855f7' },
  { id: 'fuchsia', name: 'Fuchsia', bg: 'rgba(217, 70, 239, 0.08)', border: 'rgba(217, 70, 239, 0.3)', text: '#c026d3', accent: '#d946ef' },
  { id: 'pink', name: 'Pink', bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)', text: '#db2777', accent: '#ec4899' },
  { id: 'rose', name: 'Rose', bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.3)', text: '#e11d48', accent: '#f43f5e' },
];

const STORAGE_KEY = 'viny-note-colors';

function loadColors(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveColors(colors: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

export function getNoteColor(noteId: string): NoteColor {
  const colors = loadColors();
  const colorId = colors[noteId] || 'none';
  return NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
}

export function setNoteColor(noteId: string, colorId: string): void {
  const colors = loadColors();
  if (colorId === 'none') {
    delete colors[noteId];
  } else {
    colors[noteId] = colorId;
  }
  saveColors(colors);
}

export function getNoteColorId(noteId: string): string {
  const colors = loadColors();
  return colors[noteId] || 'none';
}

export function getColorById(colorId: string): NoteColor {
  return NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];
}

export function getAllNoteColors(): Record<string, string> {
  return loadColors();
}
