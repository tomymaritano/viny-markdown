<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { notesStore } from '$lib/stores/notes.svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import { X } from 'lucide-svelte';
  import * as d3Force from 'd3-force';
  import * as d3Zoom from 'd3-zoom';
  import * as d3Selection from 'd3-selection';
  import * as d3Drag from 'd3-drag';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let simulation: d3Force.Simulation<any, any> | null = null;

  // Graph state
  let hoveredNodeId = $state<string | null>(null);
  let searchQuery = $state('');

  // Get notebook colors
  function getNotebookColor(notebookId: string | null): string {
    if (!notebookId) return 'var(--accent-color)';
    const notebook = appStore.notebooks.find((nb) => nb.id === notebookId);
    return notebook?.color || 'var(--accent-color)';
  }

  // Node radius based on connections
  function getNodeRadius(connectionCount: number): number {
    return Math.min(6 + connectionCount * 2, 20);
  }

  // Filter nodes by search
  const filteredNodes = $derived.by(() => {
    const { nodes } = notesStore.getGraphData();
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter((n) => n.title.toLowerCase().includes(query));
  });

  function initGraph() {
    if (!svgElement || !containerElement || !open) return;

    // Clear previous
    d3Selection.select(svgElement).selectAll('*').remove();
    if (simulation) {
      simulation.stop();
      simulation = null;
    }

    const { nodes, edges } = notesStore.getGraphData();
    if (nodes.length === 0) return;

    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    // Create node data with x, y
    interface GraphNodeDatum extends d3Force.SimulationNodeDatum {
      id: string;
      title: string;
      notebookId: string | null;
      connectionCount: number;
    }

    const nodeData: GraphNodeDatum[] = nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // Create edge data with source/target references
    interface GraphEdgeDatum extends d3Force.SimulationLinkDatum<GraphNodeDatum> {
      source: string | GraphNodeDatum;
      target: string | GraphNodeDatum;
    }

    const edgeData: GraphEdgeDatum[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    // Create SVG groups
    const svg = d3Selection.select(svgElement);
    const g = svg.append('g').attr('class', 'graph-container');

    // Create edges
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edgeData)
      .join('line')
      .attr('stroke', 'var(--border-color)')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1);

    // Create nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer');

    // Node circles
    node
      .append('circle')
      .attr('r', (d) => getNodeRadius(d.connectionCount))
      .attr('fill', (d) => getNotebookColor(d.notebookId))
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 2);

    // Node labels
    node
      .append('text')
      .text((d) => d.title.length > 20 ? d.title.slice(0, 20) + '...' : d.title)
      .attr('x', 0)
      .attr('y', (d) => getNodeRadius(d.connectionCount) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none');

    // Hover effects
    node
      .on('mouseenter', function (event, d) {
        hoveredNodeId = d.id;
        d3Selection.select(this).select('circle').attr('stroke', 'var(--accent-color)').attr('stroke-width', 3);
        // Highlight connected edges
        link
          .attr('stroke-opacity', (l) => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 1 : 0.1;
          })
          .attr('stroke-width', (l) => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 2 : 1;
          });
      })
      .on('mouseleave', function () {
        hoveredNodeId = null;
        d3Selection.select(this).select('circle').attr('stroke', 'var(--bg-primary)').attr('stroke-width', 2);
        link.attr('stroke-opacity', 0.4).attr('stroke-width', 1);
      })
      .on('click', (event, d) => {
        notesStore.selectNote(d.id);
        onClose();
      });

    // Drag behavior
    const drag = d3Drag
      .drag<SVGGElement, GraphNodeDatum>()
      .on('start', (event, d) => {
        if (!event.active) simulation?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.call(drag as any);

    // Zoom behavior
    const zoom = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center the view initially
    const initialTransform = d3Zoom.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2);
    svg.call(zoom.transform, initialTransform);

    // Force simulation
    simulation = d3Force
      .forceSimulation(nodeData)
      .force(
        'link',
        d3Force
          .forceLink<GraphNodeDatum, GraphEdgeDatum>(edgeData)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3Force.forceManyBody().strength(-200))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius((d) => getNodeRadius((d as GraphNodeDatum).connectionCount) + 10))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as GraphNodeDatum).x!)
          .attr('y1', (d) => (d.source as GraphNodeDatum).y!)
          .attr('x2', (d) => (d.target as GraphNodeDatum).x!)
          .attr('y2', (d) => (d.target as GraphNodeDatum).y!);

        node.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });
  }

  // Initialize graph when opened
  $effect(() => {
    if (open) {
      // Small delay to ensure container is rendered
      setTimeout(initGraph, 50);
    }
  });

  // Cleanup on unmount
  onDestroy(() => {
    if (simulation) {
      simulation.stop();
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="graph-overlay">
    <div class="graph-container" bind:this={containerElement}>
      <header class="graph-header">
        <h2 class="graph-title">Note Graph</h2>
        <div class="graph-controls">
          <input
            type="text"
            class="search-input"
            placeholder="Search notes..."
            bind:value={searchQuery}
          />
          <span class="stats">
            {notesStore.getGraphData().nodes.length} notes · {notesStore.getGraphData().edges.length} connections
          </span>
        </div>
        <button class="close-btn" onclick={onClose}><X size={18} /></button>
      </header>

      <svg bind:this={svgElement} class="graph-svg"></svg>

      {#if notesStore.getGraphData().nodes.length === 0}
        <div class="empty-state">
          <p>No notes yet. Create some notes and connect them with [[wiki-links]]!</p>
        </div>
      {/if}

      <div class="graph-legend">
        <div class="legend-item">
          <span class="legend-dot" style:background="var(--accent-color)"></span>
          <span>No notebook</span>
        </div>
        {#each appStore.notebooks.slice(0, 5) as notebook}
          <div class="legend-item">
            <span class="legend-dot" style:background={notebook.color || '#888'}></span>
            <span>{notebook.name}</span>
          </div>
        {/each}
      </div>

      <div class="graph-help">
        <span>Scroll to zoom · Drag to pan · Click node to open</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .graph-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
  }

  .graph-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .graph-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .graph-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .graph-controls {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .search-input {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
    width: 200px;
  }

  .search-input::placeholder {
    color: var(--text-muted);
  }

  .stats {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .graph-svg {
    flex: 1;
    width: 100%;
    background: var(--bg-primary);
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .graph-legend {
    position: absolute;
    bottom: 48px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 11px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .graph-help {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  /* Node styles via CSS vars */
  :global(.graph-container .node-group:hover circle) {
    filter: brightness(1.2);
  }
</style>
