import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { getGraph, clearGraph, saveNodePositions, KnowledgeGraphData, Node, Link } from '../utils/knowledgeGraph';

// Node colors by group
const GROUP_COLORS: Record<string, string> = {
  person: '#ff7f0e',
  place: '#2ca02c', 
  organization: '#d62728',
  concept: '#9467bd',
  object: '#8c564b',
  event: '#e377c2',
  default: '#1f77b4'
};

export const ContextView: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>();
  
  // Load graph data
  useEffect(() => {
    const loadGraph = () => setGraphData(getGraph());
    loadGraph();
    
    window.addEventListener('storage', loadGraph);
    window.addEventListener('knowledgeGraphUpdated', loadGraph);
    return () => {
      window.removeEventListener('storage', loadGraph);
      window.removeEventListener('knowledgeGraphUpdated', loadGraph);
    };
  }, []);

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Configure physics with COLLISION for bouncy nodes!
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || graphData.nodes.length === 0) return;

    // Configure physics
    graph.d3Force('charge')?.strength(-150);
    graph.d3Force('link')?.distance(80);
    graph.d3Force('center')?.strength(0.05);
    
    // 🎱 COLLISION FORCE - nodes bounce off each other!
    graph.d3Force('collide', forceCollide()
      .radius(20)      // Size of collision boundary
      .strength(1)     // Full bounce strength
      .iterations(4)   // More iterations = better collision detection
    );

    // Zoom to fit after short delay
    const zoomTimer = setTimeout(() => {
      graph.zoomToFit(500, 50);
    }, 500);

    // Stop simulation and freeze nodes after settling
    const freezeTimer = setTimeout(() => {
      setIsSimulationRunning(false);
      // Freeze all node positions
      graphData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          node.fx = node.x;
          node.fy = node.y;
        }
      });
      saveNodePositions(graphData.nodes);
    }, 3000);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(freezeTimer);
    };
  }, [graphData]);

  // Get connected nodes for highlighting
  const getConnectedNodes = useCallback((nodeId: string) => {
    const connected = new Set<string>([nodeId]);
    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as Node).id : link.target;
      if (sourceId === nodeId) connected.add(targetId as string);
      if (targetId === nodeId) connected.add(sourceId as string);
    });
    return connected;
  }, [graphData.links]);

  const handleClearMemory = () => {
    clearGraph();
    setSelectedNode(null);
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(prev => prev === node.id ? null : node.id);
  }, []);

  const handleNodeDragStart = useCallback((node: any) => {
    setIsSimulationRunning(true);
    
    // 🎱 UNPIN nearby nodes so they can be PUSHED!
    graphData.nodes.forEach(n => {
      if (n.id === node.id) return; // Skip dragged node
      
      const dx = (n.x || 0) - (node.x || 0);
      const dy = (n.y || 0) - (node.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Unpin nodes within bounce range (100px)
      if (distance < 100) {
        n.fx = undefined;
        n.fy = undefined;
      }
    });
    
    // Reheat simulation for physics to kick in
    graphRef.current?.d3ReheatSimulation();
  }, [graphData.nodes]);

  const handleNodeDrag = useCallback((node: any) => {
    // Keep dragged node pinned to cursor
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    // Pin dragged node where dropped
    node.fx = node.x;
    node.fy = node.y;
    
    // Let bounced nodes settle, then freeze everything
    setTimeout(() => {
      setIsSimulationRunning(false);
      // Re-freeze ALL nodes to prevent drift
      graphData.nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          n.fx = n.x;
          n.fy = n.y;
        }
      });
    }, 800); // Give bounced nodes time to settle
  }, [graphData.nodes]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Get highlight sets
  const highlightedNodes = selectedNode ? getConnectedNodes(selectedNode) : new Set<string>();

  const hasData = graphData.nodes.length > 0;

  return (
    <div className="w-full h-full flex flex-col p-4">
      <div className="w-full max-w-6xl mx-auto flex-grow flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl text-gray-300">Alfie's Memory</h2>
            <p className="text-gray-500 text-sm">
              {hasData 
                ? `${graphData.nodes.length} entities • ${graphData.links.length} relationships`
                : 'Knowledge graph from conversations'}
            </p>
          </div>
          <div className="flex gap-2">
            {hasData && (
              <button
                onClick={() => graphRef.current?.zoomToFit(400, 50)}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded hover:bg-gray-700 text-sm"
              >
                Fit View
              </button>
            )}
            <button
              onClick={handleClearMemory}
              className="px-3 py-1.5 bg-red-900/50 text-red-300 border border-red-800 rounded hover:bg-red-800/50 text-sm"
            >
              Clear Memory
            </button>
          </div>
        </div>

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className="flex-grow w-full bg-gray-950 border border-gray-800 rounded-lg overflow-hidden relative"
          style={{ minHeight: 400 }}
        >
          {hasData ? (
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              
              // Simulation settings - tuned for bouncy physics
              cooldownTicks={isSimulationRunning ? 200 : 0}
              d3AlphaDecay={0.02}      // Slower decay = longer bounce
              d3VelocityDecay={0.25}   // Less friction = more momentum
              
              // Interaction
              enableNodeDrag={true}
              enablePanInteraction={true}
              enableZoomInteraction={true}
              
              // Node appearance
              nodeRelSize={6}
              nodeVal={node => highlightedNodes.size === 0 || highlightedNodes.has((node as Node).id as string) ? 6 : 3}
              nodeColor={node => {
                const n = node as Node;
                const color = GROUP_COLORS[n.group] || GROUP_COLORS.default;
                if (highlightedNodes.size > 0 && !highlightedNodes.has(n.id as string)) {
                  return color + '40'; // Add transparency
                }
                return color;
              }}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const n = node as Node;
                if (n.x === undefined || n.y === undefined) return;
                
                const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(n.id as string);
                const isSelected = selectedNode === n.id;
                
                // Draw selection ring
                if (isSelected) {
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, 10, 0, 2 * Math.PI);
                  ctx.strokeStyle = '#fbbf24';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
                
                // Only draw labels for highlighted nodes or when zoomed in
                if (!isHighlighted && globalScale < 1.5) return;
                
                const label = n.id as string;
                const fontSize = Math.max(10, 12 / globalScale);
                ctx.font = `${fontSize}px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                
                const textWidth = ctx.measureText(label).width;
                const y = n.y + 8;
                
                // Background
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(n.x - textWidth/2 - 3, y - 2, textWidth + 6, fontSize + 4);
                
                // Text
                ctx.fillStyle = isSelected ? '#fbbf24' : (isHighlighted ? '#fff' : '#888');
                ctx.fillText(label, n.x, y);
              }}
              nodeCanvasObjectMode={() => 'after'}
              
              // Link appearance  
              linkColor={link => {
                if (highlightedNodes.size === 0) return 'rgba(251, 191, 36, 0.4)';
                const l = link as Link;
                const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
                const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
                if (highlightedNodes.has(sourceId as string) && highlightedNodes.has(targetId as string)) {
                  return 'rgba(251, 191, 36, 0.8)';
                }
                return 'rgba(251, 191, 36, 0.1)';
              }}
              linkWidth={link => {
                if (highlightedNodes.size === 0) return 1;
                const l = link as Link;
                const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
                const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
                return (highlightedNodes.has(sourceId as string) && highlightedNodes.has(targetId as string)) ? 2 : 0.5;
              }}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              
              // Link labels (only when node selected)
              linkCanvasObject={(link, ctx, globalScale) => {
                if (!selectedNode) return;
                
                const l = link as Link;
                const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
                const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
                
                if (!highlightedNodes.has(sourceId as string) || !highlightedNodes.has(targetId as string)) return;
                if (!l.value) return;
                
                const source = l.source as any;
                const target = l.target as any;
                if (!source.x || !target.x) return;
                
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                
                const fontSize = Math.max(8, 10 / globalScale);
                ctx.font = `${fontSize}px Arial`;
                const label = l.value as string;
                const textWidth = ctx.measureText(label).width;
                
                ctx.fillStyle = 'rgba(0,0,0,0.9)';
                ctx.fillRect(midX - textWidth/2 - 4, midY - fontSize/2 - 2, textWidth + 8, fontSize + 4);
                
                ctx.fillStyle = '#fbbf24';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, midX, midY);
              }}
              linkCanvasObjectMode={() => 'after'}
              
              // Events
              onNodeClick={handleNodeClick}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onBackgroundClick={handleBackgroundClick}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-600 text-6xl mb-4">🧠</div>
                <p className="text-gray-500">Alfie's memory is empty.</p>
                <p className="text-gray-600 text-sm mt-1">Start a conversation to build the knowledge graph.</p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Click node to highlight connections</span>
            <span>•</span>
            <span>Drag to move nodes</span>
            <span>•</span>
            <span>Scroll to zoom</span>
            <span>•</span>
            <span>Drag background to pan</span>
          </div>
        )}
      </div>
    </div>
  );
};
