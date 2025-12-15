<script lang="ts">
  import { notesStore } from '$lib/stores';
  import { toast } from '$lib/toast';
  import {
    getReminders,
    getRemindersByNoteId,
    getUpcomingReminders,
    getOverdueReminders,
    getTodayReminders,
    createReminder,
    deleteReminder,
    completeReminder,
    formatReminderTime,
    formatFullDateTime,
    REMINDER_PRESETS,
    setNoteTitleCache,
    type ReminderUI,
  } from '$lib/reminders';
  import { onMount } from 'svelte';

  // Alias for component compatibility
  type Reminder = ReminderUI;

  interface Props {
    open: boolean;
    onClose: () => void;
    noteId?: string;
  }

  let { open, onClose, noteId }: Props = $props();

  let viewMode = $state<'all' | 'today' | 'upcoming' | 'overdue'>('upcoming');
  let showAddForm = $state(false);
  let reminderMessage = $state('');
  let customDate = $state('');
  let customTime = $state('');
  let reminders = $state<Reminder[]>([]);
  let overdueCount = $state(0);
  let todayCount = $state(0);
  let loading = $state(false);

  // Populate note title cache from notes store
  $effect(() => {
    for (const note of notesStore.notes) {
      setNoteTitleCache(note.id, note.title || 'Untitled');
    }
  });

  async function loadReminders() {
    loading = true;
    try {
      if (noteId) {
        reminders = await getRemindersByNoteId(noteId);
      } else {
        switch (viewMode) {
          case 'today':
            reminders = await getTodayReminders();
            break;
          case 'upcoming':
            reminders = await getUpcomingReminders(30);
            break;
          case 'overdue':
            reminders = await getOverdueReminders();
            break;
          default:
            reminders = await getReminders();
        }
      }

      // Update counts
      const overdue = await getOverdueReminders();
      const today = await getTodayReminders();
      overdueCount = overdue.length;
      todayCount = today.length;
    } catch (error) {
      console.error('Failed to load reminders:', error);
      toast.error('Failed to load reminders');
    } finally {
      loading = false;
    }
  }

  // Load reminders when modal opens or view changes
  $effect(() => {
    if (open) {
      loadReminders();
    }
  });

  $effect(() => {
    viewMode;
    if (open) {
      loadReminders();
    }
  });

  function close() {
    showAddForm = false;
    reminderMessage = '';
    customDate = '';
    customTime = '';
    onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showAddForm) {
        showAddForm = false;
      } else {
        close();
      }
    }
  }

  async function handlePresetClick(preset: typeof REMINDER_PRESETS[0]) {
    const note = noteId ? notesStore.notes.find(n => n.id === noteId) : notesStore.selectedNote;
    if (!note) {
      toast.error('Please select a note first');
      return;
    }

    try {
      await createReminder(note.id, note.title || 'Untitled', preset.getDate(), reminderMessage);
      await loadReminders();
      showAddForm = false;
      reminderMessage = '';
      toast.success(`Reminder set for ${preset.label.toLowerCase()}`);
    } catch (error) {
      toast.error('Failed to create reminder');
    }
  }

  async function handleCustomReminder() {
    if (!customDate) {
      toast.error('Please select a date');
      return;
    }

    const note = noteId ? notesStore.notes.find(n => n.id === noteId) : notesStore.selectedNote;
    if (!note) {
      toast.error('Please select a note first');
      return;
    }

    const dateTime = customTime
      ? new Date(`${customDate}T${customTime}`)
      : new Date(`${customDate}T09:00`);

    if (dateTime <= new Date()) {
      toast.error('Please select a future date and time');
      return;
    }

    try {
      await createReminder(note.id, note.title || 'Untitled', dateTime, reminderMessage);
      await loadReminders();
      showAddForm = false;
      reminderMessage = '';
      customDate = '';
      customTime = '';
      toast.success('Reminder created');
    } catch (error) {
      toast.error('Failed to create reminder');
    }
  }

  async function handleComplete(reminder: Reminder) {
    try {
      await completeReminder(reminder.id);
      await loadReminders();
      toast.success('Reminder completed');
    } catch (error) {
      toast.error('Failed to complete reminder');
    }
  }

  async function handleDelete(reminder: Reminder) {
    try {
      await deleteReminder(reminder.id);
      await loadReminders();
      toast.info('Reminder deleted');
    } catch (error) {
      toast.error('Failed to delete reminder');
    }
  }

  function handleNoteClick(reminder: Reminder) {
    notesStore.selectNote(reminder.noteId);
    close();
  }

  function getMinDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  function isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
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
    aria-labelledby="reminders-title"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="reminders-title">
          {noteId ? 'Note Reminders' : 'All Reminders'}
        </h2>
        <button class="close-btn" onclick={close} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      {#if !noteId}
        <div class="view-tabs">
          <button
            class="tab-btn"
            class:active={viewMode === 'upcoming'}
            onclick={() => viewMode = 'upcoming'}
          >
            Upcoming
          </button>
          <button
            class="tab-btn"
            class:active={viewMode === 'today'}
            onclick={() => viewMode = 'today'}
          >
            Today
            {#if todayCount > 0}
              <span class="tab-badge">{todayCount}</span>
            {/if}
          </button>
          <button
            class="tab-btn"
            class:active={viewMode === 'overdue'}
            onclick={() => viewMode = 'overdue'}
          >
            Overdue
            {#if overdueCount > 0}
              <span class="tab-badge danger">{overdueCount}</span>
            {/if}
          </button>
          <button
            class="tab-btn"
            class:active={viewMode === 'all'}
            onclick={() => viewMode = 'all'}
          >
            All
          </button>
        </div>
      {/if}

      <div class="modal-content">
        {#if showAddForm}
          <div class="add-reminder-form">
            <div class="form-header">
              <h3>Add Reminder</h3>
              <button class="cancel-btn" onclick={() => showAddForm = false}>Cancel</button>
            </div>

            <div class="form-field">
              <label for="reminder-message">Message (optional)</label>
              <input
                id="reminder-message"
                type="text"
                bind:value={reminderMessage}
                placeholder="What should you remember?"
                class="message-input"
              />
            </div>

            <div class="presets-section">
              <span class="section-label">Quick options</span>
              <div class="presets-grid">
                {#each REMINDER_PRESETS as preset}
                  <button class="preset-btn" onclick={() => handlePresetClick(preset)}>
                    {preset.label}
                  </button>
                {/each}
              </div>
            </div>

            <div class="custom-section">
              <span class="section-label">Custom date & time</span>
              <div class="custom-inputs">
                <input
                  type="date"
                  bind:value={customDate}
                  min={getMinDate()}
                  class="date-input"
                />
                <input
                  type="time"
                  bind:value={customTime}
                  class="time-input"
                />
                <button
                  class="set-custom-btn"
                  onclick={handleCustomReminder}
                  disabled={!customDate}
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        {:else}
          <button class="add-reminder-btn" onclick={() => showAddForm = true}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Reminder
          </button>

          <div class="reminders-list">
            {#each reminders as reminder (reminder.id)}
              <div
                class="reminder-item"
                class:overdue={isOverdue(reminder.dueDate)}
                class:completed={reminder.completed}
              >
                <button
                  class="complete-btn"
                  onclick={() => handleComplete(reminder)}
                  title="Mark as complete"
                  disabled={reminder.completed}
                >
                  {#if reminder.completed}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  {:else}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  {/if}
                </button>

                <div class="reminder-content">
                  <button class="note-link" onclick={() => handleNoteClick(reminder)}>
                    {reminder.noteTitle}
                  </button>
                  {#if reminder.message}
                    <p class="reminder-message">{reminder.message}</p>
                  {/if}
                  <span class="reminder-time" class:overdue={isOverdue(reminder.dueDate)}>
                    {formatReminderTime(reminder.dueDate)}
                    <span class="full-time">({formatFullDateTime(reminder.dueDate)})</span>
                  </span>
                </div>

                <button
                  class="delete-btn"
                  onclick={() => handleDelete(reminder)}
                  title="Delete reminder"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            {:else}
              <div class="empty-state">
                <span class="empty-icon">🔔</span>
                <p>No reminders {viewMode === 'overdue' ? 'overdue' : viewMode === 'today' ? 'for today' : 'yet'}</p>
                <button class="add-first-btn" onclick={() => showAddForm = true}>
                  Add your first reminder
                </button>
              </div>
            {/each}
          </div>
        {/if}
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
    max-width: 500px;
    max-height: 80vh;
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

  .view-tabs {
    display: flex;
    padding: 12px 20px 0;
    gap: 4px;
    border-bottom: 1px solid var(--border);
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    font-size: 13px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: -1px;
  }

  .tab-btn:hover {
    color: var(--text-primary);
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-badge {
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 600;
    background: var(--accent);
    color: white;
    border-radius: 10px;
  }

  .tab-badge.danger {
    background: var(--error);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .add-reminder-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    font-size: 14px;
    font-weight: 500;
    background: var(--bg-secondary);
    border: 2px dashed var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 16px;
  }

  .add-reminder-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-light);
  }

  /* Add Reminder Form */
  .add-reminder-form {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .form-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .cancel-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: var(--bg-hover);
  }

  .form-field {
    margin-bottom: 16px;
  }

  .form-field label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .message-input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
  }

  .message-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .presets-section,
  .custom-section {
    margin-bottom: 16px;
  }

  .section-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .preset-btn {
    padding: 10px 12px;
    font-size: 13px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .preset-btn:hover {
    border-color: var(--accent);
    background: var(--accent-light);
  }

  .custom-inputs {
    display: flex;
    gap: 8px;
  }

  .date-input,
  .time-input {
    flex: 1;
    padding: 10px 12px;
    font-size: 13px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
  }

  .date-input:focus,
  .time-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .set-custom-btn {
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .set-custom-btn:hover:not(:disabled) {
    background: var(--accent-dark);
  }

  .set-custom-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Reminders List */
  .reminders-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reminder-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--accent);
    transition: all 0.15s ease;
  }

  .reminder-item.overdue {
    border-left-color: var(--error);
    background: rgba(239, 68, 68, 0.05);
  }

  .reminder-item.completed {
    opacity: 0.5;
    border-left-color: var(--success);
  }

  .complete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .complete-btn:hover:not(:disabled) {
    color: var(--success);
  }

  .complete-btn:disabled {
    color: var(--success);
    cursor: default;
  }

  .reminder-content {
    flex: 1;
    min-width: 0;
  }

  .note-link {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    margin-bottom: 4px;
  }

  .note-link:hover {
    color: var(--accent);
    text-decoration: underline;
  }

  .reminder-message {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 4px 0;
  }

  .reminder-time {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .reminder-time.overdue {
    color: var(--error);
    font-weight: 500;
  }

  .full-time {
    opacity: 0.7;
    margin-left: 4px;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--text-tertiary);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .reminder-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: var(--error-light);
    color: var(--error);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
  }

  .add-first-btn {
    padding: 10px 20px;
    font-size: 13px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .add-first-btn:hover {
    background: var(--accent-dark);
  }

  @media (max-width: 480px) {
    .presets-grid {
      grid-template-columns: 1fr;
    }

    .custom-inputs {
      flex-direction: column;
    }
  }
</style>
