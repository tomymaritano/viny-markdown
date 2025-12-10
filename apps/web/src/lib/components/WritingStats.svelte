<script lang="ts">
  import { onMount } from 'svelte';
  import { notesStore } from '$lib/stores/notes.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Stats data structure
  interface DailyStats {
    date: string; // YYYY-MM-DD
    wordCount: number;
    notesEdited: number;
    notesCreated: number;
  }

  let stats = $state<DailyStats[]>([]);
  let isLoading = $state(true);

  // Load stats from store
  onMount(() => {
    stats = notesStore.getWritingStats();
    isLoading = false;
  });

  // Refresh stats when modal opens
  $effect(() => {
    if (open) {
      stats = notesStore.getWritingStats();
    }
  });

  // Get today's date in YYYY-MM-DD format
  function getDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  // Calculate total words across all notes
  const totalWords = $derived(() => {
    return notesStore.allNotes.reduce((sum, note) => {
      return sum + note.content.split(/\s+/).filter(Boolean).length;
    }, 0);
  });

  // Calculate stats for the last 52 weeks (364 days)
  const contributionData = $derived(() => {
    const today = new Date();
    const data: { date: string; level: number; words: number }[] = [];

    // Get max words for scaling
    const maxWords = Math.max(...stats.map(s => s.wordCount), 1);

    for (let i = 363; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);

      const dayStat = stats.find(s => s.date === dateStr);
      const words = dayStat?.wordCount || 0;

      // Calculate level (0-4) based on word count
      let level = 0;
      if (words > 0) {
        const percentage = words / maxWords;
        if (percentage > 0.75) level = 4;
        else if (percentage > 0.5) level = 3;
        else if (percentage > 0.25) level = 2;
        else level = 1;
      }

      data.push({ date: dateStr, level, words });
    }

    return data;
  });

  // Calculate current streak
  const currentStreak = $derived(() => {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getDateString(date);

      const dayStat = stats.find(s => s.date === dateStr);
      if (dayStat && dayStat.wordCount > 0) {
        streak++;
      } else if (i > 0) {
        // Allow missing today
        break;
      }
    }

    return streak;
  });

  // Calculate longest streak
  const longestStreak = $derived(() => {
    let maxStreak = 0;
    let currentRun = 0;

    const sortedStats = [...stats].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < sortedStats.length; i++) {
      if (sortedStats[i].wordCount > 0) {
        currentRun++;
        // Check if consecutive day
        if (i > 0) {
          const prevDate = new Date(sortedStats[i - 1].date);
          const currDate = new Date(sortedStats[i].date);
          const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            currentRun = 1;
          }
        }
        maxStreak = Math.max(maxStreak, currentRun);
      } else {
        currentRun = 0;
      }
    }

    return maxStreak;
  });

  // Calculate average daily words (last 30 days)
  const avgDailyWords = $derived(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = getDateString(thirtyDaysAgo);

    const recentStats = stats.filter(s => s.date >= thirtyDaysAgoStr);
    if (recentStats.length === 0) return 0;

    const total = recentStats.reduce((sum, s) => sum + s.wordCount, 0);
    return Math.round(total / 30);
  });

  // Get words written today
  const todayWords = $derived(() => {
    const today = getDateString();
    return stats.find(s => s.date === today)?.wordCount || 0;
  });

  // Group contribution data by weeks for display
  const weeks = $derived(() => {
    const result: { date: string; level: number; words: number }[][] = [];
    for (let i = 0; i < contributionData().length; i += 7) {
      result.push(contributionData().slice(i, i + 7));
    }
    return result;
  });

  // Month labels for the graph
  const monthLabels = $derived(() => {
    const labels: { label: string; index: number }[] = [];
    let lastMonth = -1;

    contributionData().forEach((day, index) => {
      const month = new Date(day.date).getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: new Date(day.date).toLocaleDateString('en-US', { month: 'short' }),
          index: Math.floor(index / 7),
        });
        lastMonth = month;
      }
    });

    return labels;
  });

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

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="stats-title"
    tabindex="-1"
  >
    <div class="modal">
      <header class="modal-header">
        <h2 id="stats-title">Writing Statistics</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close">
          x
        </button>
      </header>

      <div class="modal-body">
        {#if isLoading}
          <div class="loading">Loading stats...</div>
        {:else}
          <!-- Stats Cards -->
          <div class="stats-cards">
            <div class="stat-card">
              <span class="stat-value">{formatNumber(totalWords())}</span>
              <span class="stat-label">Total Words</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{formatNumber(todayWords())}</span>
              <span class="stat-label">Today</span>
            </div>
            <div class="stat-card highlight">
              <span class="stat-value">{currentStreak()}</span>
              <span class="stat-label">Day Streak</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{longestStreak()}</span>
              <span class="stat-label">Best Streak</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{avgDailyWords()}</span>
              <span class="stat-label">Avg/Day (30d)</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">{notesStore.allNotes.length}</span>
              <span class="stat-label">Total Notes</span>
            </div>
          </div>

          <!-- Contribution Graph -->
          <div class="contribution-section">
            <h3>Writing Activity</h3>
            <div class="contribution-graph">
              <div class="month-labels">
                {#each monthLabels() as { label, index }}
                  <span class="month-label" style="left: {index * 14 + 4}px">{label}</span>
                {/each}
              </div>
              <div class="graph-container">
                <div class="day-labels">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>
                <div class="weeks">
                  {#each weeks() as week}
                    <div class="week">
                      {#each week as day}
                        <div
                          class="day level-{day.level}"
                          title="{day.words} words on {day.date}"
                        ></div>
                      {/each}
                    </div>
                  {/each}
                </div>
              </div>
              <div class="legend">
                <span class="legend-label">Less</span>
                <div class="day level-0"></div>
                <div class="day level-1"></div>
                <div class="day level-2"></div>
                <div class="day level-3"></div>
                <div class="day level-4"></div>
                <span class="legend-label">More</span>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="recent-section">
            <h3>Recent Activity</h3>
            <div class="recent-list">
              {#each stats.slice(-7).reverse() as day}
                <div class="recent-item">
                  <span class="recent-date">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span class="recent-words">{day.wordCount} words</span>
                  {#if day.notesCreated > 0}
                    <span class="recent-badge">+{day.notesCreated} new</span>
                  {/if}
                </div>
              {:else}
                <p class="no-data">No writing activity recorded yet. Start writing to see your stats!</p>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <footer class="modal-footer">
        <span class="tip">Stats are saved locally and update as you write</span>
      </footer>
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
    max-width: 700px;
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
    font-size: 16px;
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
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-secondary);
  }

  /* Stats Cards */
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    text-align: center;
  }

  .stat-card.highlight {
    background: var(--accent-color);
    color: white;
  }

  .stat-card.highlight .stat-label {
    color: rgba(255, 255, 255, 0.8);
  }

  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-card.highlight .stat-value {
    color: white;
  }

  .stat-label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Contribution Graph */
  .contribution-section {
    margin-bottom: 24px;
  }

  .contribution-section h3,
  .recent-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px;
  }

  .contribution-graph {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 16px;
  }

  .month-labels {
    position: relative;
    height: 16px;
    margin-bottom: 4px;
    margin-left: 32px;
  }

  .month-label {
    position: absolute;
    font-size: 10px;
    color: var(--text-muted);
  }

  .graph-container {
    display: flex;
    gap: 4px;
  }

  .day-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 28px;
    font-size: 10px;
    color: var(--text-muted);
    padding: 4px 0;
  }

  .weeks {
    display: flex;
    gap: 3px;
    overflow-x: auto;
  }

  .week {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .day {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: var(--bg-tertiary);
  }

  .day.level-1 {
    background: rgba(74, 158, 255, 0.3);
  }

  .day.level-2 {
    background: rgba(74, 158, 255, 0.5);
  }

  .day.level-3 {
    background: rgba(74, 158, 255, 0.7);
  }

  .day.level-4 {
    background: var(--accent-color);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .legend-label {
    font-size: 10px;
    color: var(--text-muted);
  }

  .legend .day {
    width: 10px;
    height: 10px;
  }

  /* Recent Activity */
  .recent-list {
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow: hidden;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-light);
  }

  .recent-item:last-child {
    border-bottom: none;
  }

  .recent-date {
    font-size: 13px;
    color: var(--text-primary);
    flex: 1;
  }

  .recent-words {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .recent-badge {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--accent-color);
    color: white;
    border-radius: var(--radius-sm);
  }

  .no-data {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    text-align: center;
  }

  .tip {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* Mobile */
  @media (max-width: 600px) {
    .stats-cards {
      grid-template-columns: repeat(2, 1fr);
    }

    .modal {
      max-height: 100vh;
      border-radius: 0;
    }
  }
</style>
