<script lang="ts">
  import { onMount } from 'svelte';

  let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
  let showPrompt = $state(false);
  let isInstalled = $state(false);

  // BeforeInstallPromptEvent type
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }

  onMount(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      isInstalled = true;
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('viny-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      showPrompt = true;
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      isInstalled = true;
      showPrompt = false;
      deferredPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  });

  async function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      showPrompt = false;
    }

    deferredPrompt = null;
  }

  function handleDismiss() {
    showPrompt = false;
    localStorage.setItem('viny-install-dismissed', Date.now().toString());
  }
</script>

{#if showPrompt && !isInstalled}
  <div class="install-prompt">
    <div class="install-content">
      <span class="install-icon">📱</span>
      <div class="install-text">
        <strong>Install Viny</strong>
        <span>Get quick access from your home screen</span>
      </div>
    </div>
    <div class="install-actions">
      <button class="dismiss-btn" onclick={handleDismiss}>
        Not now
      </button>
      <button class="install-btn" onclick={handleInstall}>
        Install
      </button>
    </div>
  </div>
{/if}

<style>
  .install-prompt {
    position: fixed;
    bottom: 16px;
    left: 16px;
    right: 16px;
    max-width: 400px;
    margin: 0 auto;
    padding: 12px 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    z-index: 9999;
    animation: slideUp 0.3s ease;
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

  .install-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .install-icon {
    font-size: 24px;
  }

  .install-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .install-text strong {
    font-size: 14px;
    color: var(--text-primary);
  }

  .install-text span {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .install-actions {
    display: flex;
    gap: 8px;
  }

  .dismiss-btn {
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
  }

  .dismiss-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .install-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: var(--accent-color);
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .install-btn:hover {
    background: var(--accent-hover);
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .install-prompt {
      flex-direction: column;
      align-items: stretch;
      left: 8px;
      right: 8px;
      bottom: 8px;
    }

    .install-content {
      justify-content: center;
      text-align: center;
    }

    .install-text {
      align-items: center;
    }

    .install-actions {
      justify-content: center;
    }
  }
</style>
