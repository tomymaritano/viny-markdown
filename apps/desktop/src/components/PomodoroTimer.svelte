<script lang="ts">
  import { toast } from '$lib/toast';

  let { open = $bindable(false) } = $props();

  // Timer states
  type TimerMode = 'work' | 'shortBreak' | 'longBreak';

  let mode = $state<TimerMode>('work');
  let isRunning = $state(false);
  let timeLeft = $state(25 * 60); // 25 minutes in seconds
  let completedPomodoros = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Settings
  let workDuration = $state(25);
  let shortBreakDuration = $state(5);
  let longBreakDuration = $state(15);
  let pomodorosUntilLongBreak = $state(4);
  let showSettings = $state(false);
  let autoStartBreaks = $state(true);
  let autoStartWork = $state(false);
  let soundEnabled = $state(true);

  // Load settings from localStorage
  $effect(() => {
    try {
      const stored = localStorage.getItem('viny-pomodoro-settings');
      if (stored) {
        const settings = JSON.parse(stored);
        workDuration = settings.workDuration ?? 25;
        shortBreakDuration = settings.shortBreakDuration ?? 5;
        longBreakDuration = settings.longBreakDuration ?? 15;
        pomodorosUntilLongBreak = settings.pomodorosUntilLongBreak ?? 4;
        autoStartBreaks = settings.autoStartBreaks ?? true;
        autoStartWork = settings.autoStartWork ?? false;
        soundEnabled = settings.soundEnabled ?? true;
      }
    } catch {}
  });

  function saveSettings() {
    localStorage.setItem('viny-pomodoro-settings', JSON.stringify({
      workDuration,
      shortBreakDuration,
      longBreakDuration,
      pomodorosUntilLongBreak,
      autoStartBreaks,
      autoStartWork,
      soundEnabled,
    }));
  }

  function getDurationForMode(m: TimerMode): number {
    switch (m) {
      case 'work': return workDuration * 60;
      case 'shortBreak': return shortBreakDuration * 60;
      case 'longBreak': return longBreakDuration * 60;
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function playNotificationSound() {
    if (!soundEnabled) return;

    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.5);
      }, 200);
    } catch {}
  }

  function startTimer() {
    if (isRunning) return;

    isRunning = true;
    intervalId = setInterval(() => {
      timeLeft--;

      if (timeLeft <= 0) {
        completeSession();
      }
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function resetTimer() {
    pauseTimer();
    timeLeft = getDurationForMode(mode);
  }

  function completeSession() {
    pauseTimer();
    playNotificationSound();

    if (mode === 'work') {
      completedPomodoros++;
      toast.success(`Pomodoro #${completedPomodoros} completed! Time for a break.`);

      // Determine break type
      if (completedPomodoros % pomodorosUntilLongBreak === 0) {
        setMode('longBreak');
      } else {
        setMode('shortBreak');
      }

      if (autoStartBreaks) {
        setTimeout(startTimer, 1000);
      }
    } else {
      toast.success('Break finished! Ready to focus?');
      setMode('work');

      if (autoStartWork) {
        setTimeout(startTimer, 1000);
      }
    }
  }

  function setMode(newMode: TimerMode) {
    pauseTimer();
    mode = newMode;
    timeLeft = getDurationForMode(newMode);
  }

  function skipSession() {
    if (mode === 'work') {
      setMode('shortBreak');
    } else {
      setMode('work');
    }
  }

  // Progress percentage
  const progress = $derived(() => {
    const total = getDurationForMode(mode);
    return ((total - timeLeft) / total) * 100;
  });

  // Cleanup on unmount
  $effect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  });

  // Update document title when timer is running
  $effect(() => {
    if (isRunning) {
      document.title = `${formatTime(timeLeft)} - ${mode === 'work' ? 'Focus' : 'Break'} | Viny`;
    }
  });

  function handleClose() {
    open = false;
  }
</script>

{#if open}
  <div class="pomodoro-panel">
    <div class="panel-header">
      <h3>Pomodoro Timer</h3>
      <div class="header-actions">
        <button
          class="settings-btn"
          class:active={showSettings}
          onclick={() => showSettings = !showSettings}
          title="Settings"
        >
          ⚙️
        </button>
        <button class="close-btn" onclick={handleClose}>✕</button>
      </div>
    </div>

    {#if showSettings}
      <div class="settings-panel">
        <div class="setting-row">
          <label>Work duration</label>
          <div class="setting-input">
            <input type="number" min="1" max="60" bind:value={workDuration} onchange={saveSettings} />
            <span>min</span>
          </div>
        </div>
        <div class="setting-row">
          <label>Short break</label>
          <div class="setting-input">
            <input type="number" min="1" max="30" bind:value={shortBreakDuration} onchange={saveSettings} />
            <span>min</span>
          </div>
        </div>
        <div class="setting-row">
          <label>Long break</label>
          <div class="setting-input">
            <input type="number" min="1" max="60" bind:value={longBreakDuration} onchange={saveSettings} />
            <span>min</span>
          </div>
        </div>
        <div class="setting-row">
          <label>Long break after</label>
          <div class="setting-input">
            <input type="number" min="1" max="10" bind:value={pomodorosUntilLongBreak} onchange={saveSettings} />
            <span>pomodoros</span>
          </div>
        </div>
        <div class="setting-row">
          <label>Auto-start breaks</label>
          <input type="checkbox" bind:checked={autoStartBreaks} onchange={saveSettings} />
        </div>
        <div class="setting-row">
          <label>Auto-start work</label>
          <input type="checkbox" bind:checked={autoStartWork} onchange={saveSettings} />
        </div>
        <div class="setting-row">
          <label>Sound notifications</label>
          <input type="checkbox" bind:checked={soundEnabled} onchange={saveSettings} />
        </div>
      </div>
    {:else}
      <div class="timer-content">
        <div class="mode-tabs">
          <button
            class="mode-tab"
            class:active={mode === 'work'}
            onclick={() => setMode('work')}
          >
            Focus
          </button>
          <button
            class="mode-tab"
            class:active={mode === 'shortBreak'}
            onclick={() => setMode('shortBreak')}
          >
            Short Break
          </button>
          <button
            class="mode-tab"
            class:active={mode === 'longBreak'}
            onclick={() => setMode('longBreak')}
          >
            Long Break
          </button>
        </div>

        <div class="timer-display" class:work={mode === 'work'} class:break={mode !== 'work'}>
          <svg class="progress-ring" viewBox="0 0 120 120">
            <circle
              class="progress-bg"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke-width="6"
            />
            <circle
              class="progress-bar"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke-width="6"
              stroke-dasharray={2 * Math.PI * 54}
              stroke-dashoffset={2 * Math.PI * 54 * (1 - progress() / 100)}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div class="time-text">
            <span class="time">{formatTime(timeLeft)}</span>
            <span class="mode-label">
              {mode === 'work' ? 'Focus Time' : mode === 'shortBreak' ? 'Short Break' : 'Long Break'}
            </span>
          </div>
        </div>

        <div class="timer-controls">
          {#if isRunning}
            <button class="control-btn pause" onclick={pauseTimer}>
              ⏸️ Pause
            </button>
          {:else}
            <button class="control-btn start" onclick={startTimer}>
              ▶️ Start
            </button>
          {/if}
          <button class="control-btn reset" onclick={resetTimer} title="Reset timer">
            🔄
          </button>
          <button class="control-btn skip" onclick={skipSession} title="Skip to next session">
            ⏭️
          </button>
        </div>

        <div class="pomodoro-count">
          <span class="count-label">Completed today:</span>
          <div class="count-dots">
            {#each Array(pomodorosUntilLongBreak) as _, i}
              <span
                class="dot"
                class:filled={i < (completedPomodoros % pomodorosUntilLongBreak) || (completedPomodoros > 0 && completedPomodoros % pomodorosUntilLongBreak === 0 && i < pomodorosUntilLongBreak)}
              ></span>
            {/each}
          </div>
          <span class="count-number">{completedPomodoros} 🍅</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .pomodoro-panel {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1001;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 300px;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .settings-btn, .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    border-radius: 6px;
    color: var(--text-tertiary);
  }

  .settings-btn:hover, .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .settings-btn.active {
    background: var(--accent);
    color: white;
  }

  .timer-content {
    padding: 20px;
  }

  .mode-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 20px;
    background: var(--bg-secondary);
    padding: 4px;
    border-radius: 8px;
  }

  .mode-tab {
    flex: 1;
    padding: 8px;
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .mode-tab:hover {
    color: var(--text-primary);
  }

  .mode-tab.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .timer-display {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .progress-ring {
    width: 180px;
    height: 180px;
  }

  .progress-bg {
    stroke: var(--bg-secondary);
  }

  .progress-bar {
    stroke: var(--accent);
    transition: stroke-dashoffset 0.5s ease;
  }

  .timer-display.work .progress-bar {
    stroke: #ef4444;
  }

  .timer-display.break .progress-bar {
    stroke: #22c55e;
  }

  .time-text {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .time {
    font-size: 42px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: -1px;
  }

  .mode-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .timer-controls {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 20px;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .control-btn.start {
    background: var(--accent);
    color: white;
  }

  .control-btn.start:hover {
    opacity: 0.9;
  }

  .control-btn.pause {
    background: var(--warning);
    color: white;
  }

  .control-btn.reset, .control-btn.skip {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    padding: 10px 12px;
  }

  .control-btn.reset:hover, .control-btn.skip:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .pomodoro-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .count-label {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .count-dots {
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    transition: all 0.2s ease;
  }

  .dot.filled {
    background: #ef4444;
    border-color: #ef4444;
  }

  .count-number {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Settings Panel */
  .settings-panel {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setting-row label {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .setting-input {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .setting-input input[type="number"] {
    width: 50px;
    padding: 6px 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    text-align: center;
    color: var(--text-primary);
  }

  .setting-input input[type="number"]:focus {
    outline: none;
    border-color: var(--accent);
  }

  .setting-input span {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .setting-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--accent);
  }
</style>
