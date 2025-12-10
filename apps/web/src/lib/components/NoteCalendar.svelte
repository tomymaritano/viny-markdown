<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let currentDate = $state(new Date());
  let selectedDate = $state<string | null>(null);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get notes grouped by date
  const notesByDate = $derived(() => {
    const map = new Map<string, number>();
    for (const note of notesStore.allNotes) {
      if (note.status === 'active') {
        const date = new Date(note.createdAt).toISOString().split('T')[0];
        map.set(date, (map.get(date) || 0) + 1);
      }
    }
    return map;
  });

  // Get notes for selected date
  const selectedDateNotes = $derived(() => {
    if (!selectedDate) return [];
    return notesStore.allNotes
      .filter(note => {
        if (note.status !== 'active') return false;
        const noteDate = new Date(note.createdAt).toISOString().split('T')[0];
        return noteDate === selectedDate;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  // Calendar grid calculation
  const calendarDays = $derived(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date | null; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null, dateStr: '', isCurrentMonth: false, isToday: false });
    }

    // Add days of the month
    const today = new Date().toISOString().split('T')[0];
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === today,
      });
    }

    return days;
  });

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    selectedDate = null;
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    selectedDate = null;
  }

  function goToToday() {
    currentDate = new Date();
    const today = new Date().toISOString().split('T')[0];
    selectedDate = notesByDate().has(today) ? today : null;
  }

  function selectDay(dateStr: string) {
    if (notesByDate().has(dateStr)) {
      selectedDate = selectedDate === dateStr ? null : dateStr;
    }
  }

  function openNote(noteId: string) {
    notesStore.selectNote(noteId);
    notesStore.setViewingTrash(false);
    onClose();
  }

  function formatSelectedDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2>Note Calendar</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        <div class="calendar-container">
          <!-- Navigation -->
          <div class="calendar-nav">
            <button class="nav-btn" onclick={prevMonth} title="Previous month">
              ←
            </button>
            <div class="nav-title">
              <span class="month-year">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              <button class="today-btn" onclick={goToToday}>Today</button>
            </div>
            <button class="nav-btn" onclick={nextMonth} title="Next month">
              →
            </button>
          </div>

          <!-- Calendar Grid -->
          <div class="calendar-grid">
            <!-- Week day headers -->
            {#each weekDays as day}
              <div class="weekday-header">{day}</div>
            {/each}

            <!-- Calendar days -->
            {#each calendarDays() as day}
              {#if day.date}
                {@const noteCount = notesByDate().get(day.dateStr) || 0}
                <button
                  class="calendar-day"
                  class:today={day.isToday}
                  class:has-notes={noteCount > 0}
                  class:selected={selectedDate === day.dateStr}
                  onclick={() => selectDay(day.dateStr)}
                  disabled={noteCount === 0}
                >
                  <span class="day-number">{day.date.getDate()}</span>
                  {#if noteCount > 0}
                    <span class="note-indicator" title="{noteCount} note{noteCount > 1 ? 's' : ''}">
                      {noteCount > 9 ? '9+' : noteCount}
                    </span>
                  {/if}
                </button>
              {:else}
                <div class="calendar-day empty"></div>
              {/if}
            {/each}
          </div>

          <!-- Selected Date Notes -->
          {#if selectedDate && selectedDateNotes().length > 0}
            <div class="selected-notes">
              <h3 class="selected-date">{formatSelectedDate(selectedDate)}</h3>
              <div class="notes-list">
                {#each selectedDateNotes() as note (note.id)}
                  <button class="note-item" onclick={() => openNote(note.id)}>
                    <span class="note-title">{note.title || 'Untitled'}</span>
                    <span class="note-time">
                      {new Date(note.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Stats -->
        <div class="calendar-stats">
          <div class="stat">
            <span class="stat-value">{notesStore.allNotes.filter(n => n.status === 'active').length}</span>
            <span class="stat-label">Total Notes</span>
          </div>
          <div class="stat">
            <span class="stat-value">{notesByDate().size}</span>
            <span class="stat-label">Days with Notes</span>
          </div>
        </div>
      </div>
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
    padding: 20px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--bg-tertiary);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .close-btn:hover {
    background: var(--bg-hover);
  }

  .modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .calendar-container {
    margin-bottom: 16px;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .nav-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }

  .nav-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .month-year {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .today-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .today-btn:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .weekday-header {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    padding: 8px 0;
    text-transform: uppercase;
  }

  .calendar-day {
    aspect-ratio: 1;
    border: 1px solid transparent;
    border-radius: 8px;
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.15s;
    padding: 4px;
  }

  .calendar-day.empty {
    background: transparent;
    cursor: default;
  }

  .calendar-day:not(.empty):not(:disabled):hover {
    background: var(--bg-hover);
    border-color: var(--border-color);
  }

  .calendar-day:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .calendar-day.today {
    border-color: var(--accent-color);
    font-weight: 600;
  }

  .calendar-day.has-notes {
    background: rgba(74, 158, 255, 0.1);
    opacity: 1;
  }

  .calendar-day.has-notes:hover {
    background: rgba(74, 158, 255, 0.2);
  }

  .calendar-day.selected {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  .calendar-day.selected .note-indicator {
    background: white;
    color: var(--accent-color);
  }

  .day-number {
    font-size: 13px;
    color: var(--text-primary);
  }

  .calendar-day.selected .day-number {
    color: white;
  }

  .note-indicator {
    position: absolute;
    bottom: 3px;
    right: 3px;
    font-size: 9px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    background: var(--accent-color);
    color: white;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  .selected-notes {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .selected-date {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .note-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .note-item:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .note-title {
    font-size: 13px;
    color: var(--text-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-time {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-left: 12px;
  }

  .calendar-stats {
    display: flex;
    gap: 16px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .stat {
    flex: 1;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  @media (max-width: 450px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .calendar-day {
      font-size: 12px;
    }

    .note-indicator {
      font-size: 8px;
      min-width: 12px;
      height: 12px;
    }
  }
</style>
