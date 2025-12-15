<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let {
    open = $bindable(false),
    wordCount = 0,
    onSessionEnd = (stats: SessionStats) => {},
  } = $props<{
    open?: boolean;
    wordCount?: number;
    onSessionEnd?: (stats: SessionStats) => void;
  }>();

  export interface SessionStats {
    duration: number; // in seconds
    wordsWritten: number;
    wordsPerMinute: number;
    startTime: Date;
    endTime: Date;
  }

  // Timer state
  let timerMode = $state<'countdown' | 'stopwatch'>('countdown');
  let countdownMinutes = $state(25);
  let timeRemaining = $state(25 * 60); // Initial value, synced via $effect
  let elapsedTime = $state(0);
  let isRunning = $state(false);
  let isPaused = $state(false);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Sync timeRemaining when countdownMinutes changes (while not running)
  $effect(() => {
    if (!isRunning && !isPaused) {
      timeRemaining = countdownMinutes * 60;
    }
  });

  // Session state
  let sessionStartTime = $state<Date | null>(null);
  let startWordCount = $state(0);
  let sessionCompleted = $state(false);

  // Settings
  let showTimer = $state(true);
  let showWordCount = $state(true);
  let showProgress = $state(true);
  let targetWords = $state(500);
  let playSound = $state(true);

  const presetTimes = [5, 10, 15, 25, 30, 45, 60];

  const wordsWritten = $derived(Math.max(0, wordCount - startWordCount));
  const wordsPerMinute = $derived(() => {
    if (elapsedTime < 60) return 0;
    return Math.round((wordsWritten / elapsedTime) * 60);
  });
  const progressPercent = $derived(targetWords > 0 ? Math.min(100, Math.round((wordsWritten / targetWords) * 100)) : 0);

  const formattedTime = $derived(() => {
    const seconds = timerMode === 'countdown' ? timeRemaining : elapsedTime;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  const formattedElapsed = $derived(() => {
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  });

  function startTimer() {
    if (isRunning) return;

    isRunning = true;
    isPaused = false;
    sessionStartTime = new Date();
    startWordCount = wordCount;

    if (timerMode === 'countdown') {
      timeRemaining = countdownMinutes * 60;
    }

    timerInterval = setInterval(() => {
      elapsedTime++;

      if (timerMode === 'countdown') {
        timeRemaining--;
        if (timeRemaining <= 0) {
          completeSession();
        }
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!isRunning) return;
    isPaused = true;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resumeTimer() {
    if (!isPaused) return;
    isPaused = false;
    timerInterval = setInterval(() => {
      elapsedTime++;

      if (timerMode === 'countdown') {
        timeRemaining--;
        if (timeRemaining <= 0) {
          completeSession();
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (isRunning && sessionStartTime) {
      const stats: SessionStats = {
        duration: elapsedTime,
        wordsWritten: wordsWritten,
        wordsPerMinute: wordsPerMinute(),
        startTime: sessionStartTime,
        endTime: new Date(),
      };
      onSessionEnd(stats);
    }

    isRunning = false;
    isPaused = false;
    elapsedTime = 0;
    timeRemaining = countdownMinutes * 60;
    sessionStartTime = null;
    sessionCompleted = false;
  }

  function completeSession() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    sessionCompleted = true;
    isPaused = true;

    if (playSound) {
      playCompletionSound();
    }
  }

  function playCompletionSound() {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Audio not supported
    }
  }

  function setCountdown(minutes: number) {
    countdownMinutes = minutes;
    timeRemaining = minutes * 60;
  }

  function close() {
    if (isRunning) {
      stopTimer();
    }
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      if (!isRunning) {
        startTimer();
      } else if (isPaused) {
        resumeTimer();
      } else {
        pauseTimer();
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });
</script>

{#if open}
  <div class="focus-overlay">
    <div class="focus-header">
      <h2>Focus Mode</h2>
      <button class="close-btn" onclick={close} title="Exit focus mode (Esc)">
        Exit
      </button>
    </div>

    <div class="focus-content">
      <!-- Timer Section -->
      {#if showTimer}
        <div class="timer-section">
          {#if !isRunning}
            <div class="timer-setup">
              <div class="mode-toggle">
                <button
                  class="mode-btn"
                  class:active={timerMode === 'countdown'}
                  onclick={() => timerMode = 'countdown'}
                >
                  Countdown
                </button>
                <button
                  class="mode-btn"
                  class:active={timerMode === 'stopwatch'}
                  onclick={() => timerMode = 'stopwatch'}
                >
                  Stopwatch
                </button>
              </div>

              {#if timerMode === 'countdown'}
                <div class="preset-times">
                  {#each presetTimes as time}
                    <button
                      class="preset-btn"
                      class:active={countdownMinutes === time}
                      onclick={() => setCountdown(time)}
                    >
                      {time}m
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <div class="timer-display" class:running={isRunning} class:completed={sessionCompleted}>
            <span class="time">{formattedTime()}</span>
            {#if isRunning && timerMode === 'countdown'}
              <span class="elapsed">Elapsed: {formattedElapsed()}</span>
            {/if}
          </div>

          <div class="timer-controls">
            {#if !isRunning}
              <button class="control-btn start" onclick={startTimer}>
                Start Session
              </button>
            {:else if sessionCompleted}
              <button class="control-btn complete" onclick={stopTimer}>
                Complete & Save
              </button>
            {:else if isPaused}
              <button class="control-btn resume" onclick={resumeTimer}>
                Resume
              </button>
              <button class="control-btn stop" onclick={stopTimer}>
                End Session
              </button>
            {:else}
              <button class="control-btn pause" onclick={pauseTimer}>
                Pause
              </button>
              <button class="control-btn stop" onclick={stopTimer}>
                End Session
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Stats Section -->
      {#if isRunning || sessionCompleted}
        <div class="stats-section">
          {#if showWordCount}
            <div class="stat-item">
              <span class="stat-value">{wordsWritten}</span>
              <span class="stat-label">Words written</span>
            </div>
          {/if}

          <div class="stat-item">
            <span class="stat-value">{wordsPerMinute()}</span>
            <span class="stat-label">Words/min</span>
          </div>

          {#if showProgress && targetWords > 0}
            <div class="stat-item progress-stat">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {progressPercent}%"></div>
              </div>
              <span class="stat-label">{progressPercent}% of {targetWords} words</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Settings Section -->
      {#if !isRunning}
        <div class="settings-section">
          <h3>Session Settings</h3>
          <div class="settings-grid">
            <label class="setting-item">
              <input type="checkbox" bind:checked={showTimer} />
              <span>Show timer</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" bind:checked={showWordCount} />
              <span>Show word count</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" bind:checked={showProgress} />
              <span>Show progress</span>
            </label>
            <label class="setting-item">
              <input type="checkbox" bind:checked={playSound} />
              <span>Play sound on complete</span>
            </label>
          </div>

          <div class="target-setting">
            <label>
              Word target:
              <input
                type="number"
                min="0"
                max="10000"
                step="100"
                bind:value={targetWords}
              />
            </label>
          </div>
        </div>
      {/if}

      <!-- Session Complete -->
      {#if sessionCompleted}
        <div class="session-complete">
          <div class="complete-icon">🎉</div>
          <h3>Session Complete!</h3>
          <p>Great work! You wrote {wordsWritten} words in {formattedElapsed()}.</p>
        </div>
      {/if}
    </div>

    <div class="focus-footer">
      <span class="hint">Press Ctrl+Space to start/pause | Esc to exit</span>
    </div>
  </div>
{/if}

<style>
  .focus-overlay {
    position: fixed;
    top: 60px;
    right: 20px;
    width: 320px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 100;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 100px);
    overflow: hidden;
  }

  .focus-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .focus-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .focus-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }

  /* Timer Section */
  .timer-section {
    margin-bottom: 24px;
  }

  .timer-setup {
    margin-bottom: 16px;
  }

  .mode-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .mode-btn {
    flex: 1;
    padding: 8px 12px;
    font-size: 13px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-btn:hover {
    background: var(--bg-hover);
  }

  .mode-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .preset-times {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-btn {
    padding: 6px 12px;
    font-size: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .preset-btn:hover {
    background: var(--bg-hover);
  }

  .preset-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .timer-display {
    text-align: center;
    padding: 24px;
    background: var(--bg-secondary);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .timer-display.running {
    background: linear-gradient(135deg, var(--accent-light, rgba(59, 130, 246, 0.1)), var(--bg-secondary));
  }

  .timer-display.completed {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), var(--bg-secondary));
  }

  .time {
    display: block;
    font-size: 48px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-primary);
    letter-spacing: 2px;
  }

  .elapsed {
    display: block;
    font-size: 12px;
    color: var(--text-tertiary);
    margin-top: 8px;
  }

  .timer-controls {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    flex: 1;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn.start {
    background: var(--accent);
    color: white;
  }

  .control-btn.start:hover {
    opacity: 0.9;
  }

  .control-btn.pause {
    background: #f59e0b;
    color: white;
  }

  .control-btn.resume {
    background: #22c55e;
    color: white;
  }

  .control-btn.stop {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .control-btn.stop:hover {
    background: var(--bg-hover);
  }

  .control-btn.complete {
    background: #22c55e;
    color: white;
  }

  /* Stats Section */
  .stats-section {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-item {
    background: var(--bg-secondary);
    padding: 16px;
    border-radius: 12px;
    text-align: center;
  }

  .stat-item.progress-stat {
    grid-column: span 2;
  }

  .stat-value {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .progress-bar {
    height: 8px;
    background: var(--bg-primary);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Settings Section */
  .settings-section {
    border-top: 1px solid var(--border);
    padding-top: 20px;
  }

  .settings-section h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .setting-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .target-setting {
    background: var(--bg-secondary);
    padding: 12px;
    border-radius: 8px;
  }

  .target-setting label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .target-setting input[type="number"] {
    width: 80px;
    padding: 6px 10px;
    font-size: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    text-align: right;
  }

  .target-setting input[type="number"]:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* Session Complete */
  .session-complete {
    text-align: center;
    padding: 24px;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), var(--bg-secondary));
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .complete-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .session-complete h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: #22c55e;
  }

  .session-complete p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Footer */
  .focus-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .hint {
    font-size: 11px;
    color: var(--text-tertiary);
  }
</style>
