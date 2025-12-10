<script lang="ts">
  import { onDestroy } from 'svelte';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  // Timer settings (in minutes)
  const WORK_DURATION = 25;
  const SHORT_BREAK = 5;
  const LONG_BREAK = 15;
  const POMODOROS_FOR_LONG_BREAK = 4;

  // Timer state
  type TimerMode = 'work' | 'shortBreak' | 'longBreak';
  let mode = $state<TimerMode>('work');
  let timeLeft = $state(WORK_DURATION * 60); // in seconds
  let isRunning = $state(false);
  let completedPomodoros = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Notification permission
  let notificationPermission = $state<NotificationPermission>('default');

  // Request notification permission on mount
  $effect(() => {
    if (open && typeof Notification !== 'undefined') {
      notificationPermission = Notification.permission;
    }
  });

  async function requestNotificationPermission() {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      notificationPermission = permission;
    }
  }

  function getDurationForMode(timerMode: TimerMode): number {
    switch (timerMode) {
      case 'work':
        return WORK_DURATION * 60;
      case 'shortBreak':
        return SHORT_BREAK * 60;
      case 'longBreak':
        return LONG_BREAK * 60;
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    if (intervalId) return;

    isRunning = true;
    intervalId = setInterval(() => {
      timeLeft--;

      if (timeLeft <= 0) {
        completeSession();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
  }

  function resetTimer() {
    pauseTimer();
    timeLeft = getDurationForMode(mode);
  }

  function completeSession() {
    pauseTimer();

    // Play sound
    playNotificationSound();

    // Show notification
    showNotification();

    if (mode === 'work') {
      completedPomodoros++;

      // Determine next break type
      if (completedPomodoros % POMODOROS_FOR_LONG_BREAK === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      // After break, start new work session
      switchMode('work');
    }
  }

  function switchMode(newMode: TimerMode) {
    pauseTimer();
    mode = newMode;
    timeLeft = getDurationForMode(newMode);
  }

  function skipToNext() {
    if (mode === 'work') {
      completedPomodoros++;
      if (completedPomodoros % POMODOROS_FOR_LONG_BREAK === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      switchMode('work');
    }
  }

  function playNotificationSound() {
    // Create a simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);

      // Second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        osc2.connect(gainNode);
        osc2.frequency.value = 800;
        osc2.type = 'sine';
        osc2.start();
        osc2.stop(audioContext.currentTime + 0.2);
      }, 300);
    } catch {
      // Audio not available
    }
  }

  function showNotification() {
    if (notificationPermission !== 'granted') return;

    const title = mode === 'work' ? 'Pomodoro Complete!' : 'Break Over!';
    const body =
      mode === 'work'
        ? `Great work! Time for a ${completedPomodoros % POMODOROS_FOR_LONG_BREAK === 0 ? 'long' : 'short'} break.`
        : 'Ready to get back to work?';

    new Notification(title, {
      body,
      icon: '/favicon.png',
      tag: 'focus-timer',
    });
  }

  function getModeLabel(timerMode: TimerMode): string {
    switch (timerMode) {
      case 'work':
        return 'Focus';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
    }
  }

  function getModeEmoji(timerMode: TimerMode): string {
    switch (timerMode) {
      case 'work':
        return '🎯';
      case 'shortBreak':
        return '☕';
      case 'longBreak':
        return '🌴';
    }
  }

  // Progress percentage
  const progress = $derived(
    ((getDurationForMode(mode) - timeLeft) / getDurationForMode(mode)) * 100
  );

  // Cleanup on unmount
  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.code === 'Space' && !event.target?.toString().includes('Input')) {
      event.preventDefault();
      isRunning ? pauseTimer() : startTimer();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="timer-overlay" onclick={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="timer-panel">
      <header class="panel-header">
        <h3 class="panel-title">Focus Timer</h3>
        <button class="close-btn" onclick={onClose}><X size={18} /></button>
      </header>

      <div class="timer-content">
        <!-- Mode selector -->
        <div class="mode-tabs">
          <button
            class="mode-tab"
            class:active={mode === 'work'}
            onclick={() => switchMode('work')}
          >
            🎯 Focus
          </button>
          <button
            class="mode-tab"
            class:active={mode === 'shortBreak'}
            onclick={() => switchMode('shortBreak')}
          >
            ☕ Short
          </button>
          <button
            class="mode-tab"
            class:active={mode === 'longBreak'}
            onclick={() => switchMode('longBreak')}
          >
            🌴 Long
          </button>
        </div>

        <!-- Timer display -->
        <div class="timer-display">
          <div class="timer-circle">
            <svg class="progress-ring" viewBox="0 0 120 120">
              <circle
                class="progress-bg"
                cx="60"
                cy="60"
                r="54"
                stroke-width="8"
                fill="none"
              />
              <circle
                class="progress-bar"
                class:work={mode === 'work'}
                class:break={mode !== 'work'}
                cx="60"
                cy="60"
                r="54"
                stroke-width="8"
                fill="none"
                stroke-dasharray={2 * Math.PI * 54}
                stroke-dashoffset={2 * Math.PI * 54 * (1 - progress / 100)}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div class="timer-text">
              <span class="mode-emoji">{getModeEmoji(mode)}</span>
              <span class="time">{formatTime(timeLeft)}</span>
              <span class="mode-label">{getModeLabel(mode)}</span>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="timer-controls">
          {#if isRunning}
            <button class="control-btn pause" onclick={pauseTimer}>
              ⏸ Pause
            </button>
          {:else}
            <button class="control-btn start" onclick={startTimer}>
              ▶ Start
            </button>
          {/if}
          <button class="control-btn secondary" onclick={resetTimer}>
            ↺ Reset
          </button>
          <button class="control-btn secondary" onclick={skipToNext}>
            ⏭ Skip
          </button>
        </div>

        <!-- Stats -->
        <div class="timer-stats">
          <div class="stat">
            <span class="stat-value">{completedPomodoros}</span>
            <span class="stat-label">Pomodoros</span>
          </div>
          <div class="stat">
            <span class="stat-value">{completedPomodoros * WORK_DURATION}</span>
            <span class="stat-label">Focus minutes</span>
          </div>
        </div>

        <!-- Notification permission -->
        {#if notificationPermission === 'default'}
          <button class="notification-btn" onclick={requestNotificationPermission}>
            🔔 Enable notifications
          </button>
        {:else if notificationPermission === 'denied'}
          <span class="notification-status denied">Notifications blocked</span>
        {:else}
          <span class="notification-status granted">🔔 Notifications enabled</span>
        {/if}
      </div>

      <footer class="panel-footer">
        <span class="help-text">Space to start/pause · Esc to close</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .timer-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .timer-panel {
    width: 100%;
    max-width: 360px;
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .panel-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .timer-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .mode-tabs {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }

  .mode-tab {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-tab:hover {
    color: var(--text-primary);
  }

  .mode-tab.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .timer-display {
    position: relative;
    width: 200px;
    height: 200px;
  }

  .timer-circle {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-bg {
    stroke: var(--bg-tertiary);
  }

  .progress-bar {
    transition: stroke-dashoffset 0.5s ease;
  }

  .progress-bar.work {
    stroke: var(--accent-color);
  }

  .progress-bar.break {
    stroke: #10b981;
  }

  .timer-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .mode-emoji {
    font-size: 24px;
  }

  .time {
    font-size: 36px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
    letter-spacing: 2px;
  }

  .mode-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .timer-controls {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .control-btn.start {
    background: var(--accent-color);
    color: white;
  }

  .control-btn.start:hover {
    background: var(--accent-hover);
  }

  .control-btn.pause {
    background: #f59e0b;
    color: white;
  }

  .control-btn.pause:hover {
    background: #d97706;
  }

  .control-btn.secondary {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .control-btn.secondary:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .timer-stats {
    display: flex;
    gap: 32px;
    padding: 16px 0;
    border-top: 1px solid var(--border-light);
    width: 100%;
    justify-content: center;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .notification-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .notification-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .notification-status {
    font-size: 11px;
    color: var(--text-muted);
  }

  .notification-status.granted {
    color: #10b981;
  }

  .notification-status.denied {
    color: #ef4444;
  }

  .panel-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    text-align: center;
  }

  .help-text {
    font-size: 11px;
    color: var(--text-muted);
  }
</style>
