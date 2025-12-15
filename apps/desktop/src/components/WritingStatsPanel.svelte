<script lang="ts">
  import {
    getTodayStats,
    getWeekStats,
    getCurrentStreak,
    getLongestStreak,
    getTotalStats,
    getWritingGoals,
    setWritingGoals,
    getDayName,
    getWeeklyProgress,
    getMonthlyStats,
    type WritingGoals,
  } from '$lib/writingStats';

  let { open = $bindable(false) } = $props();

  let activeTab = $state<'today' | 'week' | 'month' | 'goals'>('today');

  const todayStats = $derived(getTodayStats());
  const weekStats = $derived(getWeekStats());
  const weeklyProgress = $derived(getWeeklyProgress());
  const monthlyStats = $derived(getMonthlyStats());
  const currentStreak = $derived(getCurrentStreak());
  const longestStreak = $derived(getLongestStreak());
  const totalStats = $derived(getTotalStats());
  const goals = $derived(getWritingGoals());

  const todayProgress = $derived(
    goals.dailyWordGoal > 0 ? Math.min(100, Math.round((todayStats.wordsWritten / goals.dailyWordGoal) * 100)) : 0
  );

  const maxWordsInWeek = $derived(Math.max(...weekStats.map(d => d.wordsWritten), 1));

  // Goals editing
  let editingGoals = $state(false);
  let editDailyWords = $state(500);
  let editDailyMinutes = $state(30);
  let editWeeklyWords = $state(3500);
  let editWeeklyNotes = $state(10);
  let editWeeklyStreak = $state(5);

  function startEditGoals() {
    editDailyWords = goals.dailyWordGoal;
    editDailyMinutes = goals.dailyMinutesGoal;
    editWeeklyWords = goals.weeklyWordGoal;
    editWeeklyNotes = goals.weeklyNotesGoal;
    editWeeklyStreak = goals.weeklyStreakGoal;
    editingGoals = true;
  }

  function saveGoals() {
    setWritingGoals({
      dailyWordGoal: editDailyWords,
      dailyMinutesGoal: editDailyMinutes,
      weeklyWordGoal: editWeeklyWords,
      weeklyNotesGoal: editWeeklyNotes,
      weeklyStreakGoal: editWeeklyStreak,
    });
    editingGoals = false;
  }

  function close() {
    open = false;
    editingGoals = false;
  }

  function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="stats-title"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2 id="stats-title">Writing Statistics</h2>
        <button class="close-btn" onclick={close} aria-label="Close">✕</button>
      </header>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" class:active={activeTab === 'today'} onclick={() => activeTab = 'today'}>
          Today
        </button>
        <button class="tab" class:active={activeTab === 'week'} onclick={() => activeTab = 'week'}>
          Week
        </button>
        <button class="tab" class:active={activeTab === 'month'} onclick={() => activeTab = 'month'}>
          Month
        </button>
        <button class="tab" class:active={activeTab === 'goals'} onclick={() => activeTab = 'goals'}>
          Goals
        </button>
      </div>

      <div class="modal-content">
        {#if activeTab === 'today'}
          <!-- Today's Progress -->
          <section class="today-section">
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 100 100">
                <circle class="progress-bg" cx="50" cy="50" r="42" />
                <circle
                  class="progress-fill"
                  cx="50"
                  cy="50"
                  r="42"
                  style="stroke-dasharray: {2 * Math.PI * 42}; stroke-dashoffset: {2 * Math.PI * 42 * (1 - todayProgress / 100)}"
                />
              </svg>
              <div class="progress-text">
                <span class="progress-value">{todayStats.wordsWritten}</span>
                <span class="progress-label">words</span>
              </div>
            </div>
            <div class="goal-info">
              {todayProgress}% of {goals.dailyWordGoal} word goal
            </div>
          </section>

          <!-- Quick Stats -->
          <section class="quick-stats">
            <div class="stat-card">
              <span class="stat-icon">🔥</span>
              <span class="stat-value">{currentStreak}</span>
              <span class="stat-label">Day Streak</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🏆</span>
              <span class="stat-value">{longestStreak}</span>
              <span class="stat-label">Best Streak</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">⏱️</span>
              <span class="stat-value">{formatMinutes(todayStats.minutesActive)}</span>
              <span class="stat-label">Time Today</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">📝</span>
              <span class="stat-value">{todayStats.notesEdited}</span>
              <span class="stat-label">Notes Edited</span>
            </div>
          </section>

          <!-- All Time Stats -->
          <section class="alltime-section">
            <h3>All Time</h3>
            <div class="alltime-grid">
              <div class="alltime-stat">
                <span class="alltime-value">{totalStats.totalWords.toLocaleString()}</span>
                <span class="alltime-label">Total Words</span>
              </div>
              <div class="alltime-stat">
                <span class="alltime-value">{formatMinutes(totalStats.totalMinutes)}</span>
                <span class="alltime-label">Total Time</span>
              </div>
              <div class="alltime-stat">
                <span class="alltime-value">{totalStats.totalDays}</span>
                <span class="alltime-label">Active Days</span>
              </div>
            </div>
          </section>

        {:else if activeTab === 'week'}
          <!-- Weekly Progress -->
          <section class="week-progress">
            <div class="week-header">
              <span class="week-title">Week {weeklyProgress.weekNumber}</span>
              <span class="week-dates">{formatDate(weeklyProgress.weekStart)} - {formatDate(weeklyProgress.weekEnd)}</span>
            </div>

            <div class="progress-goals">
              <div class="progress-goal-item">
                <div class="goal-header">
                  <span class="goal-title">Words Written</span>
                  <span class="goal-numbers">{weeklyProgress.wordsWritten.toLocaleString()} / {weeklyProgress.wordsGoal.toLocaleString()}</span>
                </div>
                <div class="goal-progress-bar">
                  <div class="goal-progress-fill" style="width: {weeklyProgress.wordsProgress}%"></div>
                </div>
              </div>

              <div class="progress-goal-item">
                <div class="goal-header">
                  <span class="goal-title">Notes Edited</span>
                  <span class="goal-numbers">{weeklyProgress.notesEdited} / {weeklyProgress.notesGoal}</span>
                </div>
                <div class="goal-progress-bar">
                  <div class="goal-progress-fill notes" style="width: {weeklyProgress.notesProgress}%"></div>
                </div>
              </div>

              <div class="progress-goal-item">
                <div class="goal-header">
                  <span class="goal-title">Days Active</span>
                  <span class="goal-numbers">{weeklyProgress.daysActive} / {weeklyProgress.streakGoal}</span>
                </div>
                <div class="goal-progress-bar">
                  <div class="goal-progress-fill streak" style="width: {weeklyProgress.streakProgress}%"></div>
                </div>
              </div>
            </div>
          </section>

          <!-- Weekly Chart -->
          <section class="week-section">
            <h3>Daily Breakdown</h3>
            <div class="week-chart">
              {#each weekStats as day}
                <div class="day-column">
                  <div class="day-bar-container">
                    <div
                      class="day-bar"
                      class:active={day.wordsWritten > 0}
                      style="height: {(day.wordsWritten / maxWordsInWeek) * 100}%"
                    ></div>
                  </div>
                  <span class="day-label">{getDayName(day.date)}</span>
                  <span class="day-words">{day.wordsWritten > 0 ? day.wordsWritten : '-'}</span>
                </div>
              {/each}
            </div>
          </section>

        {:else if activeTab === 'month'}
          <!-- Monthly Stats -->
          <section class="month-section">
            <div class="month-header">
              <span class="month-title">{monthlyStats.month} {monthlyStats.year}</span>
            </div>

            <div class="month-stats-grid">
              <div class="month-stat">
                <span class="month-stat-value">{monthlyStats.totalWords.toLocaleString()}</span>
                <span class="month-stat-label">Words Written</span>
              </div>
              <div class="month-stat">
                <span class="month-stat-value">{monthlyStats.totalNotes}</span>
                <span class="month-stat-label">Notes Edited</span>
              </div>
              <div class="month-stat">
                <span class="month-stat-value">{monthlyStats.daysActive}</span>
                <span class="month-stat-label">Days Active</span>
              </div>
              <div class="month-stat">
                <span class="month-stat-value">{monthlyStats.avgWordsPerDay}</span>
                <span class="month-stat-label">Avg/Day</span>
              </div>
            </div>

            {#if monthlyStats.bestDay}
              <div class="best-day">
                <span class="best-day-icon">🏆</span>
                <div class="best-day-info">
                  <span class="best-day-title">Best Day</span>
                  <span class="best-day-value">{monthlyStats.bestDay.words} words on {formatDate(monthlyStats.bestDay.date)}</span>
                </div>
              </div>
            {/if}

            <div class="time-stat">
              <span class="time-icon">⏱️</span>
              <span class="time-value">{formatMinutes(monthlyStats.totalMinutes)} total writing time</span>
            </div>
          </section>

        {:else if activeTab === 'goals'}
          <!-- Goals Settings -->
          <section class="goals-section">
            {#if editingGoals}
              <div class="goals-edit">
                <h3>Daily Goals</h3>
                <div class="goal-input-group">
                  <label>
                    <span>Word Goal</span>
                    <input type="number" min="0" max="10000" step="100" bind:value={editDailyWords} />
                  </label>
                  <label>
                    <span>Minutes Goal</span>
                    <input type="number" min="0" max="480" step="5" bind:value={editDailyMinutes} />
                  </label>
                </div>

                <h3>Weekly Goals</h3>
                <div class="goal-input-group">
                  <label>
                    <span>Word Goal</span>
                    <input type="number" min="0" max="50000" step="500" bind:value={editWeeklyWords} />
                  </label>
                  <label>
                    <span>Notes Edited</span>
                    <input type="number" min="0" max="100" step="1" bind:value={editWeeklyNotes} />
                  </label>
                  <label>
                    <span>Days Active</span>
                    <input type="number" min="1" max="7" step="1" bind:value={editWeeklyStreak} />
                  </label>
                </div>

                <div class="goals-actions">
                  <button class="cancel-btn" onclick={() => editingGoals = false}>Cancel</button>
                  <button class="save-btn" onclick={saveGoals}>Save Goals</button>
                </div>
              </div>
            {:else}
              <div class="goals-display">
                <h3>Daily Goals</h3>
                <div class="goal-display-grid">
                  <div class="goal-display-item">
                    <span class="goal-display-value">{goals.dailyWordGoal}</span>
                    <span class="goal-display-label">words/day</span>
                  </div>
                  <div class="goal-display-item">
                    <span class="goal-display-value">{goals.dailyMinutesGoal}</span>
                    <span class="goal-display-label">minutes/day</span>
                  </div>
                </div>

                <h3>Weekly Goals</h3>
                <div class="goal-display-grid three-col">
                  <div class="goal-display-item">
                    <span class="goal-display-value">{goals.weeklyWordGoal.toLocaleString()}</span>
                    <span class="goal-display-label">words/week</span>
                  </div>
                  <div class="goal-display-item">
                    <span class="goal-display-value">{goals.weeklyNotesGoal}</span>
                    <span class="goal-display-label">notes/week</span>
                  </div>
                  <div class="goal-display-item">
                    <span class="goal-display-value">{goals.weeklyStreakGoal}</span>
                    <span class="goal-display-label">days/week</span>
                  </div>
                </div>

                <button class="edit-goals-btn" onclick={startEditGoals}>
                  Edit Goals
                </button>
              </div>
            {/if}
          </section>
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
    padding: 24px;
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
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
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Tabs */
  .tabs {
    display: flex;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    flex: 1;
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  section {
    margin-bottom: 28px;
  }

  section:last-child {
    margin-bottom: 0;
  }

  section h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 0 0 12px;
    letter-spacing: 0.5px;
  }

  /* Today's Progress */
  .today-section {
    text-align: center;
  }

  .progress-ring-container {
    position: relative;
    width: 140px;
    height: 140px;
    margin: 0 auto 12px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .progress-bg {
    fill: none;
    stroke: var(--bg-tertiary);
    stroke-width: 8;
  }

  .progress-fill {
    fill: none;
    stroke: var(--accent);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.5s ease;
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }

  .progress-value {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }

  .progress-label {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .goal-info {
    font-size: 13px;
    color: var(--text-secondary);
  }

  /* Quick Stats */
  .quick-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .stat-icon {
    font-size: 18px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-tertiary);
    text-align: center;
  }

  /* Weekly Progress */
  .week-progress {
    margin-bottom: 24px;
  }

  .week-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .week-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .week-dates {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .progress-goals {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .progress-goal-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .goal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .goal-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .goal-numbers {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .goal-progress-bar {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }

  .goal-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .goal-progress-fill.notes {
    background: #22c55e;
  }

  .goal-progress-fill.streak {
    background: #f59e0b;
  }

  /* Weekly Chart */
  .week-chart {
    display: flex;
    gap: 8px;
    height: 120px;
    padding: 10px 0;
  }

  .day-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .day-bar-container {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .day-bar {
    width: 80%;
    min-height: 4px;
    background: var(--bg-tertiary);
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
  }

  .day-bar.active {
    background: linear-gradient(180deg, var(--accent), #8b5cf6);
  }

  .day-label {
    font-size: 10px;
    color: var(--text-tertiary);
    font-weight: 500;
  }

  .day-words {
    font-size: 10px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  /* Monthly Stats */
  .month-header {
    margin-bottom: 16px;
  }

  .month-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .month-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  .month-stat {
    text-align: center;
    padding: 14px 8px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .month-stat-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .month-stat-label {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .best-day {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), var(--bg-secondary));
    border-radius: 10px;
    margin-bottom: 12px;
  }

  .best-day-icon {
    font-size: 24px;
  }

  .best-day-info {
    display: flex;
    flex-direction: column;
  }

  .best-day-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .best-day-value {
    font-size: 14px;
    color: var(--text-primary);
  }

  .time-stat {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .time-icon {
    font-size: 18px;
  }

  .time-value {
    font-size: 13px;
    color: var(--text-secondary);
  }

  /* All Time */
  .alltime-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .alltime-stat {
    text-align: center;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .alltime-value {
    display: block;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .alltime-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  /* Goals */
  .goals-display h3,
  .goals-edit h3 {
    margin-top: 16px;
  }

  .goals-display h3:first-child,
  .goals-edit h3:first-child {
    margin-top: 0;
  }

  .goal-display-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 8px;
  }

  .goal-display-grid.three-col {
    grid-template-columns: repeat(3, 1fr);
  }

  .goal-display-item {
    text-align: center;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
  }

  .goal-display-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .goal-display-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .edit-goals-btn {
    width: 100%;
    padding: 12px;
    margin-top: 20px;
    font-size: 14px;
    font-weight: 500;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .edit-goals-btn:hover {
    opacity: 0.9;
  }

  .goal-input-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .goal-input-group label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .goal-input-group label span {
    font-size: 13px;
    color: var(--text-primary);
  }

  .goal-input-group input {
    width: 100px;
    padding: 8px 12px;
    font-size: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    text-align: right;
  }

  .goal-input-group input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .goals-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .cancel-btn {
    flex: 1;
    padding: 12px;
    font-size: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: var(--bg-hover);
  }

  .save-btn {
    flex: 1;
    padding: 12px;
    font-size: 14px;
    font-weight: 500;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
  }

  .save-btn:hover {
    opacity: 0.9;
  }
</style>
