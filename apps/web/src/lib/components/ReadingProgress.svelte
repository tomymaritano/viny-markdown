<script lang="ts">
  interface Props {
    container: HTMLElement | null;
  }

  let { container }: Props = $props();
  let progress = $state(0);

  function updateProgress() {
    if (!container) return;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    if (scrollHeight > 0) {
      progress = Math.round((scrollTop / scrollHeight) * 100);
    } else {
      progress = 100;
    }
  }

  $effect(() => {
    if (!container) return;
    container.addEventListener('scroll', updateProgress);
    updateProgress();
    return () => {
      container?.removeEventListener('scroll', updateProgress);
    };
  });
</script>

<div class="reading-progress" title="{progress}% read">
  <div class="progress-bar">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>
  <span class="progress-text">{progress}%</span>
</div>

<style>
  .reading-progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
    min-width: 80px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: 2px;
    transition: width 0.1s ease;
  }

  .progress-text {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 32px;
    text-align: right;
  }
</style>
