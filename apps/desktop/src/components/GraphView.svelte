<script lang="ts">
  import { onMount } from 'svelte';
  import { notesStore } from '$lib/stores';
  import { extractNoteLinks } from '$lib/markdown';

  let { open = $bindable(false) } = $props();

  interface GraphNode {
    id: string;
    title: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    links: number;
  }

  interface GraphLink {
    source: string;
    target: string;
  }

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationFrame: number;

  let nodes = $state<GraphNode[]>([]);
  let links = $state<GraphLink[]>([]);
  let hoveredNode = $state<GraphNode | null>(null);
  let selectedNode = $state<GraphNode | null>(null);
  let isDragging = $state(false);
  let draggedNode = $state<GraphNode | null>(null);

  let width = $state(800);
  let height = $state(600);
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);

  // Physics parameters
  const REPULSION = 5000;
  const ATTRACTION = 0.02;
  const DAMPING = 0.9;
  const CENTER_GRAVITY = 0.01;

  function buildGraph() {
    const allNotes = notesStore.allNotes;
    const nodeMap = new Map<string, GraphNode>();
    const linkSet = new Set<string>();

    // Create nodes for each note
    allNotes.forEach((note, i) => {
      const angle = (i / allNotes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      nodeMap.set(note.title.toLowerCase(), {
        id: note.id,
        title: note.title || 'Untitled',
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        links: 0,
      });
    });

    // Create links based on [[note links]]
    const newLinks: GraphLink[] = [];
    allNotes.forEach((note) => {
      const noteLinks = extractNoteLinks(note.content);
      noteLinks.forEach((linkTitle) => {
        const targetNode = nodeMap.get(linkTitle.toLowerCase());
        if (targetNode) {
          const linkKey = [note.id, targetNode.id].sort().join('-');
          if (!linkSet.has(linkKey)) {
            linkSet.add(linkKey);
            newLinks.push({ source: note.id, target: targetNode.id });

            const sourceNode = Array.from(nodeMap.values()).find(n => n.id === note.id);
            if (sourceNode) sourceNode.links++;
            targetNode.links++;
          }
        }
      });
    });

    nodes = Array.from(nodeMap.values());
    links = newLinks;
  }

  function simulate() {
    if (!open) return;

    // Apply forces
    nodes.forEach((node) => {
      // Center gravity
      node.vx += (width / 2 - node.x) * CENTER_GRAVITY;
      node.vy += (height / 2 - node.y) * CENTER_GRAVITY;

      // Repulsion from other nodes
      nodes.forEach((other) => {
        if (node.id === other.id) return;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (distance * distance);
        node.vx += (dx / distance) * force;
        node.vy += (dy / distance) * force;
      });
    });

    // Attraction along links
    links.forEach((link) => {
      const source = nodes.find((n) => n.id === link.source);
      const target = nodes.find((n) => n.id === link.target);
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const force = ATTRACTION;

      source.vx += dx * force;
      source.vy += dy * force;
      target.vx -= dx * force;
      target.vy -= dy * force;
    });

    // Update positions
    nodes.forEach((node) => {
      if (node === draggedNode && isDragging) return;

      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;

      // Keep in bounds
      node.x = Math.max(50, Math.min(width - 50, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    });

    draw();
    animationFrame = requestAnimationFrame(simulate);
  }

  function draw() {
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw links
    ctx.strokeStyle = 'var(--border)';
    ctx.lineWidth = 1;
    links.forEach((link) => {
      const source = nodes.find((n) => n.id === link.source);
      const target = nodes.find((n) => n.id === link.target);
      if (!source || !target) return;

      ctx!.beginPath();
      ctx!.moveTo(source.x, source.y);
      ctx!.lineTo(target.x, target.y);

      // Highlight if connected to hovered/selected node
      if (
        hoveredNode &&
        (source.id === hoveredNode.id || target.id === hoveredNode.id)
      ) {
        ctx!.strokeStyle = '#3b82f6';
        ctx!.lineWidth = 2;
      } else if (
        selectedNode &&
        (source.id === selectedNode.id || target.id === selectedNode.id)
      ) {
        ctx!.strokeStyle = '#8b5cf6';
        ctx!.lineWidth = 2;
      } else {
        ctx!.strokeStyle = getComputedStyle(document.documentElement)
          .getPropertyValue('--border')
          .trim() || '#374151';
        ctx!.lineWidth = 1;
      }
      ctx!.stroke();
    });

    // Draw nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const nodeSize = 8 + Math.min(node.links * 2, 12);

      // Node circle
      ctx!.beginPath();
      ctx!.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);

      if (isSelected) {
        ctx!.fillStyle = '#8b5cf6';
      } else if (isHovered) {
        ctx!.fillStyle = '#3b82f6';
      } else if (node.links > 0) {
        ctx!.fillStyle = '#60a5fa';
      } else {
        ctx!.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue('--text-tertiary')
          .trim() || '#6b7280';
      }
      ctx!.fill();

      // Node label
      if (isHovered || isSelected || zoom > 0.8) {
        ctx!.font = `${isHovered || isSelected ? '13px' : '11px'} -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'top';
        ctx!.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue('--text-primary')
          .trim() || '#f3f4f6';

        const label = node.title.length > 20 ? node.title.slice(0, 17) + '...' : node.title;
        ctx!.fillText(label, node.x, node.y + nodeSize + 4);
      }
    });

    ctx.restore();
  }

  function getNodeAtPosition(x: number, y: number): GraphNode | null {
    const scaledX = (x - panX) / zoom;
    const scaledY = (y - panY) / zoom;

    for (const node of nodes) {
      const nodeSize = 8 + Math.min(node.links * 2, 12);
      const dx = scaledX - node.x;
      const dy = scaledY - node.y;
      if (dx * dx + dy * dy < nodeSize * nodeSize) {
        return node;
      }
    }
    return null;
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && draggedNode) {
      draggedNode.x = (x - panX) / zoom;
      draggedNode.y = (y - panY) / zoom;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
    } else {
      hoveredNode = getNodeAtPosition(x, y);
      canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
    }
  }

  function handleMouseDown(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = getNodeAtPosition(x, y);
    if (node) {
      isDragging = true;
      draggedNode = node;
      selectedNode = node;
    }
  }

  function handleMouseUp() {
    isDragging = false;
    draggedNode = null;
  }

  function handleDoubleClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = getNodeAtPosition(x, y);
    if (node) {
      notesStore.selectNote(node.id);
      open = false;
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.3, Math.min(3, zoom * delta));
  }

  function close() {
    open = false;
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    buildGraph();
  }

  $effect(() => {
    if (open && canvas) {
      ctx = canvas.getContext('2d');
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;

      buildGraph();
      simulate();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  });

  onMount(() => {
    const handleResize = () => {
      if (canvas) {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h2>Note Graph</h2>
        <div class="header-actions">
          <span class="stats">
            {nodes.length} notes, {links.length} links
          </span>
          <button class="reset-btn" onclick={resetView} title="Reset view">
            Reset
          </button>
          <button class="close-btn" onclick={close} aria-label="Close">x</button>
        </div>
      </header>

      <div class="graph-container">
        <canvas
          bind:this={canvas}
          onmousemove={handleMouseMove}
          onmousedown={handleMouseDown}
          onmouseup={handleMouseUp}
          onmouseleave={handleMouseUp}
          ondblclick={handleDoubleClick}
          onwheel={handleWheel}
        ></canvas>

        {#if selectedNode}
          <div class="node-info">
            <h4>{selectedNode.title}</h4>
            <p>{selectedNode.links} connections</p>
            <button class="goto-btn" onclick={() => { notesStore.selectNote(selectedNode!.id); open = false; }}>
              Open Note
            </button>
          </div>
        {/if}

        <div class="zoom-controls">
          <button onclick={() => zoom = Math.min(3, zoom * 1.2)}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onclick={() => zoom = Math.max(0.3, zoom * 0.8)}>-</button>
        </div>
      </div>

      <div class="modal-footer">
        <span class="tip">
          Scroll to zoom | Drag nodes | Double-click to open note
        </span>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
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
    max-width: 900px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stats {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .reset-btn {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .reset-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
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

  .graph-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  canvas {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary);
  }

  .node-info {
    position: absolute;
    bottom: 16px;
    left: 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .node-info h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--text-primary);
  }

  .node-info p {
    font-size: 12px;
    color: var(--text-tertiary);
    margin: 0 0 12px;
  }

  .goto-btn {
    width: 100%;
    padding: 8px;
    background: var(--accent);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .goto-btn:hover {
    opacity: 0.9;
  }

  .zoom-controls {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
  }

  .zoom-controls button {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: none;
    border-radius: 4px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .zoom-controls button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .zoom-controls span {
    font-size: 11px;
    color: var(--text-tertiary);
    min-width: 40px;
    text-align: center;
  }

  .modal-footer {
    padding: 12px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
  }

  .tip {
    font-size: 12px;
    color: var(--text-tertiary);
  }
</style>
