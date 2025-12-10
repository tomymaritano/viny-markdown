<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { Note } from '@viny/domain';

  interface Props {
    currentNote: Note;
    backlinks: Note[];
    forwardLinks: Note[];
    onNavigate: (noteId: string) => void;
    onClose: () => void;
  }

  let { currentNote, backlinks, forwardLinks, onNavigate, onClose }: Props = $props();

  // Graph dimensions
  const width = 400;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const nodeRadius = 8;
  const centralRadius = 12;
  const orbitRadiusBacklinks = 90;
  const orbitRadiusForward = 90;

  // Calculate node positions
  interface NodePosition {
    id: string;
    title: string;
    x: number;
    y: number;
    type: 'current' | 'backlink' | 'forward';
  }

  const nodes = $derived.by(() => {
    const result: NodePosition[] = [];

    // Central node (current note)
    result.push({
      id: currentNote.id,
      title: currentNote.title || 'Untitled',
      x: centerX,
      y: centerY,
      type: 'current',
    });

    // Backlinks (incoming) - positioned on the left
    backlinks.forEach((note, i) => {
      const count = backlinks.length;
      const angleSpread = Math.PI * 0.8; // 144 degrees spread
      const startAngle = Math.PI - angleSpread / 2;
      const angle = count === 1 ? Math.PI : startAngle + (angleSpread * i) / Math.max(count - 1, 1);

      result.push({
        id: note.id,
        title: note.title || 'Untitled',
        x: centerX + Math.cos(angle) * orbitRadiusBacklinks,
        y: centerY + Math.sin(angle) * orbitRadiusBacklinks,
        type: 'backlink',
      });
    });

    // Forward links (outgoing) - positioned on the right
    forwardLinks.forEach((note, i) => {
      const count = forwardLinks.length;
      const angleSpread = Math.PI * 0.8; // 144 degrees spread
      const startAngle = -angleSpread / 2;
      const angle = count === 1 ? 0 : startAngle + (angleSpread * i) / Math.max(count - 1, 1);

      result.push({
        id: note.id,
        title: note.title || 'Untitled',
        x: centerX + Math.cos(angle) * orbitRadiusForward,
        y: centerY + Math.sin(angle) * orbitRadiusForward,
        type: 'forward',
      });
    });

    return result;
  });

  // Generate edges
  interface Edge {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'incoming' | 'outgoing';
  }

  const edges = $derived.by(() => {
    const result: Edge[] = [];
    const central = nodes.find((n) => n.type === 'current');
    if (!central) return result;

    // Edges from backlinks to center
    nodes
      .filter((n) => n.type === 'backlink')
      .forEach((node) => {
        result.push({
          x1: node.x,
          y1: node.y,
          x2: central.x,
          y2: central.y,
          type: 'incoming',
        });
      });

    // Edges from center to forward links
    nodes
      .filter((n) => n.type === 'forward')
      .forEach((node) => {
        result.push({
          x1: central.x,
          y1: central.y,
          x2: node.x,
          y2: node.y,
          type: 'outgoing',
        });
      });

    return result;
  });

  let hoveredNode = $state<string | null>(null);

  function handleNodeClick(nodeId: string) {
    if (nodeId !== currentNote.id) {
      onNavigate(nodeId);
    }
  }

  function truncateTitle(title: string, maxLen: number = 15): string {
    return title.length > maxLen ? title.slice(0, maxLen) + '...' : title;
  }
</script>

<div class="mini-graph-container">
  <div class="graph-header">
    <span class="graph-title">Note Connections</span>
    <button class="close-btn" onclick={onClose}><X size={18} /></button>
  </div>

  <div class="graph-legend">
    <span class="legend-item">
      <span class="legend-dot incoming"></span> Links to this
    </span>
    <span class="legend-item">
      <span class="legend-dot outgoing"></span> This links to
    </span>
  </div>

  <svg {width} {height} class="graph-svg">
    <defs>
      <!-- Arrow markers -->
      <marker
        id="arrow-incoming"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-incoming)" />
      </marker>
      <marker
        id="arrow-outgoing"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-outgoing)" />
      </marker>
    </defs>

    <!-- Edges -->
    {#each edges as edge}
      <line
        x1={edge.x1}
        y1={edge.y1}
        x2={edge.x2}
        y2={edge.y2}
        class="edge {edge.type}"
        marker-end="url(#arrow-{edge.type})"
      />
    {/each}

    <!-- Nodes -->
    {#each nodes as node}
      <g
        class="node-group"
        class:current={node.type === 'current'}
        class:backlink={node.type === 'backlink'}
        class:forward={node.type === 'forward'}
        class:hovered={hoveredNode === node.id}
        transform="translate({node.x}, {node.y})"
        onmouseenter={() => hoveredNode = node.id}
        onmouseleave={() => hoveredNode = null}
        onclick={() => handleNodeClick(node.id)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && handleNodeClick(node.id)}
      >
        <circle
          r={node.type === 'current' ? centralRadius : nodeRadius}
          class="node-circle"
        />
        <text
          y={node.type === 'current' ? centralRadius + 14 : nodeRadius + 12}
          class="node-label"
        >
          {truncateTitle(node.title)}
        </text>
      </g>
    {/each}
  </svg>

  {#if backlinks.length === 0 && forwardLinks.length === 0}
    <div class="no-connections">
      No connections yet. Use [[wiki-links]] to connect notes.
    </div>
  {/if}
</div>

<style>
  .mini-graph-container {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    --color-incoming: #10b981;
    --color-outgoing: #6366f1;
    --color-current: var(--accent-color);
  }

  .graph-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .graph-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .graph-legend {
    display: flex;
    gap: 16px;
    padding: 8px 12px;
    font-size: 11px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-light);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .legend-dot.incoming {
    background: var(--color-incoming);
  }

  .legend-dot.outgoing {
    background: var(--color-outgoing);
  }

  .graph-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .edge {
    stroke-width: 1.5;
    fill: none;
  }

  .edge.incoming {
    stroke: var(--color-incoming);
    opacity: 0.6;
  }

  .edge.outgoing {
    stroke: var(--color-outgoing);
    opacity: 0.6;
  }

  .node-group {
    cursor: pointer;
  }

  .node-group.current {
    cursor: default;
  }

  .node-circle {
    fill: var(--bg-tertiary);
    stroke-width: 2;
    transition: all 0.15s ease;
  }

  .node-group.current .node-circle {
    fill: var(--color-current);
    stroke: var(--color-current);
  }

  .node-group.backlink .node-circle {
    stroke: var(--color-incoming);
  }

  .node-group.forward .node-circle {
    stroke: var(--color-outgoing);
  }

  .node-group.hovered .node-circle {
    transform: scale(1.2);
  }

  .node-group.hovered.backlink .node-circle {
    fill: var(--color-incoming);
  }

  .node-group.hovered.forward .node-circle {
    fill: var(--color-outgoing);
  }

  .node-label {
    font-size: 10px;
    text-anchor: middle;
    fill: var(--text-secondary);
    pointer-events: none;
  }

  .node-group.current .node-label {
    font-weight: 600;
    fill: var(--text-primary);
  }

  .node-group.hovered .node-label {
    fill: var(--text-primary);
  }

  .no-connections {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
