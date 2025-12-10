<script lang="ts">
  import '../app.css';
  import { browser, dev } from '$app/environment';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';

  let { children } = $props();
  let showUpdate = $state(false);
  let waitingWorker: ServiceWorker | null = null;

  // Register service worker for PWA offline support
  $effect(() => {
    if (browser && !dev && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then((registration) => {
        console.log('SW registered:', registration.scope);

        // Listen for new service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // New worker installed and waiting, show notification
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker = newWorker;
                showUpdate = true;
              }
            });
          }
        });

        // Check for updates every 5 minutes
        setInterval(() => registration.update(), 5 * 60 * 1000);
      }).catch((error) => {
        console.log('SW registration failed:', error);
      });

      // Reload page when new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  });

  function handleUpdate() {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }
</script>

{@render children()}
<UpdateNotification bind:show={showUpdate} onupdate={handleUpdate} />
