<script lang="ts">
  import { notesStore } from '$lib/stores/notes.svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Goal state - persisted to localStorage
  let dailyGoal = $state(500);
  let goalEnabled = $state(true);

  // Load saved settings
  $effect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wordCountGoal');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          dailyGoal = data.dailyGoal || 500;
          goalEnabled = data.goalEnabled !== false;
        } catch {
          // Use defaults
        }
      }
    }
  });

  // Save settings when they change
  function saveSettings() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wordCountGoal', JSON.stringify({
        dailyGoal,
        goalEnabled,
      }));
    }
  }

  // Calculate today's word count from all notes edited today
  const todaysWordCount = $derived(() => {
    const today = new Date().toISOString().split('T')[0];
    let count = 0;

    for (const note of notesStore.allNotes) {
      if (note.status !== 'active') continue;

      const updatedDate = new Date(note.updatedAt).toISOString().split('T')[0];
      if (updatedDate === today) {
        count += note.content.trim().split(/\s+/).filter(Boolean).length;
      }
    }

    return count;
  });

  // Calculate progress percentage
  const progressPercent = $derived(() => {
    if (dailyGoal <= 0) return 0;
    return Math.min(100, Math.round((todaysWordCount() / dailyGoal) * 100));
  });

  // Check if goal is reached
  const goalReached = $derived(() => {
    return todaysWordCount() >= dailyGoal;
  });

  // Get motivational message based on progress
  const motivationMessage = $derived(() => {
    const percent = progressPercent();
    if (percent === 0) return "Start writing to begin your journey!";
    if (percent < 25) return "Great start! Keep going!";
    if (percent < 50) return "You're making progress!";
    if (percent < 75) return "Over halfway there!";
    if (percent < 100) return "Almost there, you can do it!";
    return "Goal reached! Amazing work!";
  });

  // Preset goals
  const presets = [
    { label: '250', value: 250 },
    { label: '500', value: 500 },
    { label: '750', value: 750 },
    { label: '1000', value: 1000 },
    { label: '1500', value: 1500 },
    { label: '2000', value: 2000 },
  ];

  function setGoal(value: number) {
    dailyGoal = value;
    saveSettings();
  }

  function toggleEnabled() {
    goalEnabled = !goalEnabled;
    saveSettings();
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

  function formatNumber(n: number): string {
    return n.toLocaleString();
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
        <h2>Daily Word Goal</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close"><X size={18} /></button>
      </header>

      <div class="modal-body">
        <!-- Progress Ring -->
        <div class="progress-container">
          <div class="progress-ring" class:completed={goalReached()}>
            <svg viewBox="0 0 100 100">
              <circle
                class="progress-bg"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke-width="8"
              />
              <circle
                class="progress-bar"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke-width="8"
                stroke-dasharray={`${progressPercent() * 2.83} 283`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div class="progress-content">
              <span class="progress-percent">{progressPercent()}%</span>
              <span class="progress-label">
                {formatNumber(todaysWordCount())} / {formatNumber(dailyGoal)}
              </span>
            </div>
          </div>
        </div>

        <!-- Motivation -->
        <p class="motivation" class:success={goalReached()}>
          {#if goalReached()}
            {motivationMessage()}
          {:else}
            {motivationMessage()}
          {/if}
        </p>

        <!-- Stats -->
        <div class="stats-row">
          <div class="stat">
            <span class="stat-value">{formatNumber(todaysWordCount())}</span>
            <span class="stat-label">Words Today</span>
          </div>
          <div class="stat">
            <span class="stat-value">{formatNumber(Math.max(0, dailyGoal - todaysWordCount()))}</span>
            <span class="stat-label">Remaining</span>
          </div>
        </div>

        <!-- Goal Settings -->
        <div class="settings-section">
          <div class="settings-header">
            <h3 class="settings-title">Goal Settings</h3>
            <button
              class="toggle-btn"
              class:active={goalEnabled}
              onclick={toggleEnabled}
              aria-label={goalEnabled ? 'Disable goal' : 'Enable goal'}
            >
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </button>
          </div>

          <div class="goal-presets">
            {#each presets as preset}
              <button
                class="preset-btn"
                class:active={dailyGoal === preset.value}
                onclick={() => setGoal(preset.value)}
                disabled={!goalEnabled}
              >
                {preset.label}
              </button>
            {/each}
          </div>

          <div class="custom-goal">
            <label for="custom-goal-input">Custom goal:</label>
            <input
              id="custom-goal-input"
              type="number"
              min="1"
              max="100000"
              bind:value={dailyGoal}
              onchange={saveSettings}
              disabled={!goalEnabled}
            />
            <span class="unit">words</span>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <span class="tip">Word count updates as you write</span>
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
    max-width: 380px;
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
    padding: 24px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .progress-container {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .progress-ring {
    position: relative;
    width: 160px;
    height: 160px;
  }

  .progress-ring svg {
    width: 100%;
    height: 100%;
  }

  .progress-bg {
    stroke: var(--bg-tertiary);
  }

  .progress-bar {
    stroke: var(--accent-color);
    transition: stroke-dasharray 0.5s ease;
    stroke-linecap: round;
  }

  .progress-ring.completed .progress-bar {
    stroke: #22c55e;
  }

  .progress-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .progress-percent {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .progress-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .motivation {
    text-align: center;
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 20px;
  }

  .motivation.success {
    color: #22c55e;
    font-weight: 500;
  }

  .stats-row {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat {
    flex: 1;
    text-align: center;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
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

  .settings-section {
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .settings-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toggle-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .toggle-track {
    display: block;
    width: 40px;
    height: 22px;
    background: var(--bg-tertiary);
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-btn.active .toggle-track {
    background: var(--accent-color);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle-btn.active .toggle-thumb {
    transform: translateX(18px);
  }

  .goal-presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .preset-btn {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover:not(:disabled) {
    border-color: var(--accent-color);
    background: var(--bg-hover);
  }

  .preset-btn.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .preset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .custom-goal {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .custom-goal label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .custom-goal input {
    width: 80px;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    text-align: center;
  }

  .custom-goal input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .custom-goal input:disabled {
    opacity: 0.5;
  }

  .custom-goal .unit {
    font-size: 13px;
    color: var(--text-muted);
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

  @media (max-width: 450px) {
    .modal {
      max-height: 100vh;
      border-radius: 0;
    }

    .progress-ring {
      width: 140px;
      height: 140px;
    }

    .progress-percent {
      font-size: 28px;
    }
  }
</style>
