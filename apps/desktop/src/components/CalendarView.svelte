<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { getNoteColor } from '$lib/noteColors';
  import type { Note } from '$lib/bindings';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let currentDate = $state(new Date());
  let viewMode = $state<'month' | 'week'>('month');
  let selectedDate = $state<string | null>(null);

  const currentMonth = $derived(() => currentDate.getMonth());
  const currentYear = $derived(() => currentDate.getFullYear());

  const monthName = $derived(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  // Get notes grouped by date
  const notesByDate = $derived(() => {
    const grouped: Record<string, Note[]> = {};
    for (const note of notesStore.notes) {
      const dateStr = note.updated_at.split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(note);
    }
    return grouped;
  });

  // Get notes created on each date
  const notesByCreatedDate = $derived(() => {
    const grouped: Record<string, Note[]> = {};
    for (const note of notesStore.notes) {
      const dateStr = note.created_at.split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(note);
    }
    return grouped;
  });

  // Calendar days for current month view
  const calendarDays = $derived(() => {
    const year = currentYear();
    const month = currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }> = [];

    // Previous month days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date,
        dateStr: formatDateStr(date),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    const today = new Date();
    const todayStr = formatDateStr(today);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateStr(date);
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        dateStr: formatDateStr(date),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  });

  // Week view days
  const weekDays = $derived(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const days: Array<{ date: Date; dateStr: string; isToday: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = formatDateStr(date);
      days.push({
        date,
        dateStr,
        isToday: dateStr === formatDateStr(today),
      });
    }
    return days;
  });

  // Notes for selected date
  const selectedDateNotes = $derived(() => {
    if (!selectedDate) return [];
    return notesByDate()[selectedDate] || [];
  });

  function formatDateStr(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function prevMonth() {
    currentDate = new Date(currentYear(), currentMonth() - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentYear(), currentMonth() + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
    selectedDate = formatDateStr(new Date());
  }

  function selectDate(dateStr: string) {
    selectedDate = selectedDate === dateStr ? null : dateStr;
  }

  function selectNote(noteId: string) {
    notesStore.selectNote(noteId);
    onClose();
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function formatFullDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function close() {
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="calendar-title"
    tabindex="-1"
  >
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="calendar-title">Calendar View</h2>
        <div class="header-actions">
          <div class="view-toggle">
            <button
              class="toggle-btn"
              class:active={viewMode === 'month'}
              onclick={() => viewMode = 'month'}
            >
              Month
            </button>
            <button
              class="toggle-btn"
              class:active={viewMode === 'week'}
              onclick={() => viewMode = 'week'}
            >
              Week
            </button>
          </div>
          <button class="close-btn" onclick={close} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <div class="calendar-content">
        <div class="calendar-nav">
          <button class="nav-btn" onclick={prevMonth} aria-label="Previous month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div class="month-display">
            <span class="month-name">{monthName()}</span>
            <button class="today-btn" onclick={goToToday}>Today</button>
          </div>
          <button class="nav-btn" onclick={nextMonth} aria-label="Next month">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div class="calendar-grid-wrapper">
          {#if viewMode === 'month'}
            <div class="calendar-grid">
              <div class="weekday-header">
                {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
                  <div class="weekday">{day}</div>
                {/each}
              </div>
              <div class="days-grid">
                {#each calendarDays() as day}
                  {@const dayNotes = notesByDate()[day.dateStr] || []}
                  {@const noteCount = dayNotes.length}
                  <button
                    class="day-cell"
                    class:other-month={!day.isCurrentMonth}
                    class:today={day.isToday}
                    class:selected={selectedDate === day.dateStr}
                    class:has-notes={noteCount > 0}
                    onclick={() => selectDate(day.dateStr)}
                  >
                    <span class="day-number">{day.date.getDate()}</span>
                    {#if noteCount > 0}
                      <div class="note-dots">
                        {#each dayNotes.slice(0, 3) as note}
                          {@const noteColor = getNoteColor(note.id)}
                          <span
                            class="note-dot"
                            style="background: {noteColor.id !== 'none' ? noteColor.accent : 'var(--accent)'}"
                          ></span>
                        {/each}
                        {#if noteCount > 3}
                          <span class="more-dots">+{noteCount - 3}</span>
                        {/if}
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="week-view">
              <div class="week-header">
                {#each weekDays() as day}
                  <div class="week-day-header" class:today={day.isToday}>
                    <span class="week-day-name">{formatDayName(day.date)}</span>
                    <span class="week-day-number">{day.date.getDate()}</span>
                  </div>
                {/each}
              </div>
              <div class="week-content">
                {#each weekDays() as day}
                  {@const dayNotes = notesByDate()[day.dateStr] || []}
                  <div class="week-day-column" class:today={day.isToday}>
                    {#each dayNotes as note}
                      {@const noteColor = getNoteColor(note.id)}
                      <button
                        class="week-note-item"
                        style="border-left-color: {noteColor.id !== 'none' ? noteColor.accent : 'var(--accent)'}"
                        onclick={() => selectNote(note.id)}
                      >
                        <span class="week-note-title">{note.title || 'Untitled'}</span>
                        <span class="week-note-time">{formatTime(note.updated_at)}</span>
                      </button>
                    {/each}
                    {#if dayNotes.length === 0}
                      <div class="week-empty">No notes</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        {#if selectedDate && viewMode === 'month'}
          <div class="selected-date-panel">
            <div class="selected-date-header">
              <h3>{formatFullDate(selectedDate)}</h3>
              <span class="note-count">{selectedDateNotes().length} notes</span>
            </div>
            <div class="selected-date-notes">
              {#each selectedDateNotes() as note}
                {@const noteColor = getNoteColor(note.id)}
                <button
                  class="selected-note-item"
                  style="border-left-color: {noteColor.id !== 'none' ? noteColor.accent : 'var(--accent)'}"
                  onclick={() => selectNote(note.id)}
                >
                  <div class="selected-note-info">
                    <span class="selected-note-title">{note.title || 'Untitled'}</span>
                    <span class="selected-note-preview">
                      {note.content.slice(0, 100).replace(/[#*`]/g, '')}...
                    </span>
                  </div>
                  <span class="selected-note-time">{formatTime(note.updated_at)}</span>
                </button>
              {:else}
                <div class="no-notes">No notes for this date</div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="calendar-stats">
          <div class="stat-item">
            <span class="stat-value">{notesStore.notes.length}</span>
            <span class="stat-label">Total notes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{Object.keys(notesByDate()).length}</span>
            <span class="stat-label">Days with activity</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{notesByDate()[formatDateStr(new Date())]?.length || 0}</span>
            <span class="stat-label">Today's notes</span>
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
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 900px;
    max-height: 85vh;
    overflow: hidden;
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

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-secondary);
    border-radius: 6px;
    padding: 2px;
  }

  .toggle-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn.active {
    background: var(--accent);
    color: white;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .calendar-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .month-display {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .month-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 180px;
    text-align: center;
  }

  .today-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .today-btn:hover {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .calendar-grid-wrapper {
    flex: 1;
    min-height: 0;
  }

  .calendar-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .weekday-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .weekday {
    text-align: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    padding: 8px 0;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 4px;
    background: var(--bg-secondary);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 60px;
  }

  .day-cell:hover {
    background: var(--bg-hover);
  }

  .day-cell.other-month {
    opacity: 0.4;
  }

  .day-cell.today {
    background: var(--accent-light);
    border-color: var(--accent);
  }

  .day-cell.selected {
    background: var(--accent);
    color: white;
  }

  .day-cell.selected .day-number {
    color: white;
  }

  .day-cell.has-notes:not(.selected) {
    background: var(--bg-tertiary);
  }

  .day-number {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .note-dots {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .note-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .more-dots {
    font-size: 9px;
    color: var(--text-tertiary);
  }

  .day-cell.selected .more-dots {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Week View */
  .week-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 400px;
  }

  .week-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .week-day-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .week-day-header.today {
    background: var(--accent-light);
  }

  .week-day-name {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .week-day-number {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .week-day-header.today .week-day-number {
    color: var(--accent);
  }

  .week-content {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    flex: 1;
    min-height: 0;
  }

  .week-day-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow-y: auto;
  }

  .week-day-column.today {
    background: var(--accent-light);
  }

  .week-note-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: var(--bg-primary);
    border: none;
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .week-note-item:hover {
    background: var(--bg-hover);
  }

  .week-note-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .week-note-time {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .week-empty {
    font-size: 11px;
    color: var(--text-tertiary);
    text-align: center;
    padding: 16px 4px;
  }

  /* Selected Date Panel */
  .selected-date-panel {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    animation: fadeIn 0.15s ease;
  }

  .selected-date-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .selected-date-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .note-count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .selected-date-notes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .selected-note-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-primary);
    border: none;
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .selected-note-item:hover {
    background: var(--bg-hover);
  }

  .selected-note-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .selected-note-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .selected-note-preview {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .selected-note-time {
    font-size: 11px;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .no-notes {
    text-align: center;
    padding: 24px;
    color: var(--text-tertiary);
    font-size: 13px;
  }

  /* Stats */
  .calendar-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media (max-width: 768px) {
    .modal {
      width: 95%;
      max-height: 90vh;
    }

    .week-view {
      height: 300px;
    }

    .calendar-stats {
      gap: 16px;
    }

    .stat-value {
      font-size: 20px;
    }
  }
</style>
