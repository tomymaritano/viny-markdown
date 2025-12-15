/**
 * Note reminders system
 * Uses Tauri backend for persistence and native notifications
 */

import { invoke } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export interface Reminder {
  id: string;
  note_id: string;
  message: string;
  due_date: string;
  completed: boolean;
  notified: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// For compatibility with UI that uses noteId/noteTitle
export interface ReminderUI extends Reminder {
  noteId: string;
  noteTitle: string;
  dueDate: string;
}

interface CreateReminderInput {
  note_id: string;
  message?: string;
  due_date: string;
}

interface UpdateReminderInput {
  message?: string;
  due_date?: string;
  completed?: boolean;
  notified?: boolean;
}

// Cache for note titles
let noteTitleCache: Map<string, string> = new Map();

export function setNoteTitleCache(noteId: string, title: string): void {
  noteTitleCache.set(noteId, title);
}

function toReminderUI(r: Reminder): ReminderUI {
  return {
    ...r,
    noteId: r.note_id,
    noteTitle: noteTitleCache.get(r.note_id) || 'Untitled',
    dueDate: r.due_date,
  };
}

export async function getReminders(): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('list_reminders');
  return reminders.map(toReminderUI).sort((a, b) =>
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
}

export async function getRemindersByNoteId(noteId: string): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('get_reminders_by_note', { noteId });
  return reminders.map(toReminderUI).sort((a, b) =>
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
}

export async function getUpcomingReminders(days: number = 7): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('get_upcoming_reminders', { days });
  return reminders.map(toReminderUI);
}

export async function getOverdueReminders(): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('get_overdue_reminders');
  return reminders.map(toReminderUI);
}

export async function getTodayReminders(): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('get_today_reminders');
  return reminders.map(toReminderUI);
}

export async function getDueReminders(): Promise<ReminderUI[]> {
  const reminders = await invoke<Reminder[]>('get_due_reminders');
  return reminders.map(toReminderUI);
}

export async function createReminder(
  noteId: string,
  noteTitle: string,
  dueDate: Date,
  message: string = ''
): Promise<ReminderUI> {
  // Cache the note title
  setNoteTitleCache(noteId, noteTitle);

  const input: CreateReminderInput = {
    note_id: noteId,
    message,
    due_date: dueDate.toISOString(),
  };

  const reminder = await invoke<Reminder>('create_reminder', { input });
  return toReminderUI(reminder);
}

export async function updateReminder(
  id: string,
  updates: Partial<Pick<ReminderUI, 'dueDate' | 'message' | 'completed' | 'notified'>>
): Promise<ReminderUI | null> {
  const input: UpdateReminderInput = {};

  if (updates.dueDate !== undefined) {
    input.due_date = typeof updates.dueDate === 'string'
      ? updates.dueDate
      : (updates.dueDate as Date).toISOString();
  }
  if (updates.message !== undefined) input.message = updates.message;
  if (updates.completed !== undefined) input.completed = updates.completed;
  if (updates.notified !== undefined) input.notified = updates.notified;

  try {
    const reminder = await invoke<Reminder>('update_reminder', { id, input });
    return toReminderUI(reminder);
  } catch {
    return null;
  }
}

export async function deleteReminder(id: string): Promise<boolean> {
  try {
    await invoke('delete_reminder', { id, hard: false });
    return true;
  } catch {
    return false;
  }
}

export async function completeReminder(id: string): Promise<ReminderUI | null> {
  try {
    const reminder = await invoke<Reminder>('complete_reminder', { id });
    return toReminderUI(reminder);
  } catch {
    return null;
  }
}

export async function markAsNotified(id: string): Promise<ReminderUI | null> {
  try {
    const reminder = await invoke<Reminder>('mark_reminder_notified', { id });
    return toReminderUI(reminder);
  } catch {
    return null;
  }
}

export async function deleteNoteReminders(noteId: string): Promise<void> {
  await invoke('delete_note_reminders', { noteId });
}

export function formatReminderTime(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diff / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diff / (1000 * 60));

  if (diff < 0) {
    // Overdue
    const absDays = Math.abs(diffDays);
    const absHours = Math.abs(diffHours);
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes < 60) return `${absMinutes}m overdue`;
    if (absHours < 24) return `${absHours}h overdue`;
    if (absDays === 1) return 'Yesterday';
    return `${absDays}d overdue`;
  }

  // Upcoming
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDateTime(dueDate: string): string {
  const date = new Date(dueDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Quick reminder presets
export interface ReminderPreset {
  label: string;
  getDate: () => Date;
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  {
    label: 'In 15 minutes',
    getDate: () => {
      const d = new Date();
      d.setMinutes(d.getMinutes() + 15);
      return d;
    },
  },
  {
    label: 'In 1 hour',
    getDate: () => {
      const d = new Date();
      d.setHours(d.getHours() + 1);
      return d;
    },
  },
  {
    label: 'In 3 hours',
    getDate: () => {
      const d = new Date();
      d.setHours(d.getHours() + 3);
      return d;
    },
  },
  {
    label: 'Tomorrow morning',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Tomorrow evening',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next Monday',
    getDate: () => {
      const d = new Date();
      const day = d.getDay();
      const daysUntilMonday = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next week',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

// Check for due reminders (call periodically)
export async function checkDueReminders(): Promise<ReminderUI[]> {
  return getDueReminders();
}

// Request notification permission (native)
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    return permissionGranted;
  } catch {
    return false;
  }
}

// Show a native notification
export async function showReminderNotification(reminder: ReminderUI): Promise<void> {
  try {
    const permissionGranted = await isPermissionGranted();
    if (!permissionGranted) return;

    sendNotification({
      title: `Reminder: ${reminder.noteTitle}`,
      body: reminder.message || 'Time to check this note!',
    });

    // Mark as notified
    await markAsNotified(reminder.id);
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// Start reminder checking interval
let checkInterval: ReturnType<typeof setInterval> | null = null;

export async function startReminderChecker(
  onDueReminder: (reminder: ReminderUI) => void,
  intervalMs: number = 60000 // Check every minute
): Promise<void> {
  // Request permission first
  await requestNotificationPermission();

  // Clear existing interval
  if (checkInterval) {
    clearInterval(checkInterval);
  }

  // Check immediately
  const checkReminders = async () => {
    try {
      const dueReminders = await getDueReminders();
      for (const reminder of dueReminders) {
        await showReminderNotification(reminder);
        onDueReminder(reminder);
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  };

  await checkReminders();

  // Set up periodic checking
  checkInterval = setInterval(checkReminders, intervalMs);
}

export function stopReminderChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
