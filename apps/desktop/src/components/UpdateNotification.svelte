<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, RefreshCw, X, Sparkles } from '@lucide/svelte';
  import { checkForUpdates, downloadAndInstall, restartApp, type UpdateInfo } from '$lib/updater';

  let show = $state(false);
  let updateInfo = $state<UpdateInfo | null>(null);
  let downloading = $state(false);
  let progress = $state(0);
  let downloaded = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    // Check for updates on startup (with a small delay)
    setTimeout(async () => {
      const update = await checkForUpdates();
      if (update) {
        updateInfo = update;
        show = true;
      }
    }, 3000);
  });

  async function handleDownload() {
    downloading = true;
    error = null;
    progress = 0;

    const success = await downloadAndInstall((p) => {
      progress = p;
    });

    downloading = false;

    if (success) {
      downloaded = true;
    } else {
      error = 'Failed to download update. Please try again.';
    }
  }

  async function handleRestart() {
    await restartApp();
  }

  function dismiss() {
    show = false;
  }
</script>

{#if show && updateInfo}
  <div class="update-notification">
    <div class="update-icon">
      <Sparkles size={20} />
    </div>

    <div class="update-content">
      <div class="update-header">
        <span class="update-title">Update Available</span>
        <span class="update-version">v{updateInfo.version}</span>
      </div>

      {#if updateInfo.body}
        <p class="update-body">{updateInfo.body}</p>
      {/if}

      {#if error}
        <p class="update-error">{error}</p>
      {/if}

      {#if downloading}
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {progress}%"></div>
          </div>
          <span class="progress-text">{Math.round(progress)}%</span>
        </div>
      {/if}
    </div>

    <div class="update-actions">
      {#if downloaded}
        <button class="update-btn primary" onclick={handleRestart}>
          <RefreshCw size={14} />
          Restart Now
        </button>
      {:else if downloading}
        <button class="update-btn" disabled>
          <Download size={14} />
          Downloading...
        </button>
      {:else}
        <button class="update-btn primary" onclick={handleDownload}>
          <Download size={14} />
          Update
        </button>
      {/if}

      {#if !downloaded}
        <button class="update-btn dismiss" onclick={dismiss} title="Remind me later">
          <X size={14} />
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .update-notification {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: var(--bg-primary);
    border: 1px solid var(--accent);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 360px;
    z-index: 1100;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .update-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    border-radius: 10px;
    color: white;
    flex-shrink: 0;
  }

  .update-content {
    flex: 1;
    min-width: 0;
  }

  .update-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .update-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
  }

  .update-version {
    font-size: 12px;
    color: var(--accent);
    font-weight: 500;
    padding: 2px 6px;
    background: var(--accent-light);
    border-radius: 4px;
  }

  .update-body {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .update-error {
    font-size: 12px;
    color: var(--error);
    margin: 8px 0 0 0;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: 11px;
    color: var(--text-tertiary);
    min-width: 36px;
    text-align: right;
  }

  .update-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .update-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .update-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .update-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .update-btn.primary {
    background: var(--accent);
    color: white;
  }

  .update-btn.primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .update-btn.dismiss {
    padding: 8px;
    background: transparent;
    color: var(--text-tertiary);
  }

  .update-btn.dismiss:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .update-notification {
      bottom: 80px;
      right: 16px;
      left: 16px;
      max-width: none;
    }
  }
</style>
