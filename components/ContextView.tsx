import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraph, clearGraph, saveNodePositions, KnowledgeGraphData, Node, Link } from '../utils/knowledgeGraph';

// Helper to convert hex to rgb for opacity changes
const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '255, 255, 255'; // default to white
};

// Define colors for node groups to replace nodeAutoColorBy
const groupColors: { [key: string]: string } = {
    'person': '#ff7f0e',       // orange
    'place': '#2ca02c',        // green
    'organization': '#d62728', // red
    'concept': '#9467bd',      // purple
    'object': '#8c564b',       // brown
    'event': '#e377c2',        // pink
    'default': '#1f77b4'       // blue
};


// Debounce function to limit how often a function can run.
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

export const ContextView: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null); // Ref for the graph instance

  // Use a ref to hold the latest graphData to prevent stale closures in callbacks
  const graphDataRef = useRef(graphData);
  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  // State for hover interactions
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const handleStorageChange = useCallback(() => {
    setGraphData(getGraph());
  }, []);

  useEffect(() => {
    handleStorageChange(); // Initial load
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleStorageChange]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    const debouncedUpdateSize = debounce(updateSize, 200);
    const observer = new ResizeObserver(debouncedUpdateSize);
    const currentRef = containerRef.current;

    if(currentRef) {
        observer.observe(currentRef);
    }
    updateSize(); // Initial call to set size immediately
    
    return () => {
        if(currentRef) {
            observer.unobserve(currentRef);
        }
    };
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      // Tune the physics engine for a more stable layout
      fgRef.current.d3Force('charge').strength(-150);
      fgRef.current.d3Force('link').distance(70);
    }
  }, [graphData]); // Re-apply physics when data changes
  
  const handleClearMemory = () => {
      clearGraph();
  }

  const handleEngineStop = useCallback(() => {
    // Use the ref to get the latest graph data, ensuring positions are saved correctly.
    saveNodePositions(graphDataRef.current.nodes);
  }, []); // Empty dependency array is correct, as the ref holds the latest data.

  // FIX: The onNodeHover callback from the library provides a generic object.
  // Changed the parameter type to 'unknown' and cast it to the expected 'Node | null' type.
  const handleNodeHover = useCallback((node: unknown) => {
    setHoveredNode(node as Node | null);
  }, []);

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const nodes = new Set<Node>();
    const links = new Set<Link>();

    if (hoveredNode) {
        nodes.add(hoveredNode);
        const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

        graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;

            if (sourceId === hoveredNode.id || targetId === hoveredNode.id) {
                links.add(link);
                const neighborId = sourceId === hoveredNode.id ? targetId : sourceId;
                const neighborNode = nodeMap.get(neighborId);
                if (neighborNode) {
                    nodes.add(neighborNode);
                }
            }
        });
    }

    return { highlightNodes: nodes, highlightLinks: links };
  }, [hoveredNode, graphData.nodes, graphData.links]);

  const hasData = graphData.nodes.length > 0;

  return (
    <div className="w-full h-full flex flex-col items-center p-4">
      <div className="w-full max-w-6xl flex-grow flex flex-col">
        <header className="flex-shrink-0 flex justify-between items-center mb-4">
            <div>
                <h2 className="text-2xl text-gray-300">Alfie's Memory</h2>
                <p className="text-gray-500">A knowledge graph of entities and relationships from your conversations.</p>
            </div>
            <button 
                onClick={handleClearMemory}
                className="px-4 py-2 bg-red-900/50 text-red-300 border border-red-500/30 rounded-md hover:bg-red-800/60 transition-colors cursor-pointer"
                aria-label="Clear Alfie's memory"
            >
                Clear Memory
            </button>
        </header>
        <main ref={containerRef} className="flex-grow w-full border border-amber-800/20 rounded-lg bg-black/30 relative overflow-hidden" style={{ cursor: hoveredNode ? 'pointer' : 'auto' }}>
            {hasData && containerSize.width > 0 ? (
                <ForceGraph2D
                    ref={fgRef}
                    width={containerSize.width}
                    height={containerSize.height}
                    graphData={graphData}
                    // Physics
                    cooldownTicks={100} // Stop simulation after it cools down
                    d3AlphaDecay={0.1} // Increased decay to settle faster
                    d3VelocityDecay={0.3} // Slightly less friction for smoother movement
                    // Node styling
                    nodeLabel="id"
                    nodeRelSize={8} // Make nodes bigger and easier to grab
                    // FIX: Explicitly type the node parameter to resolve an inference issue.
                    nodeColor={node => {
                        const typedNode = node as Node;
                        const colorHex = groupColors[typedNode.group] || groupColors.default;
                        if (highlightNodes.size > 0 && !highlightNodes.has(typedNode)) {
                            return `rgba(${hexToRgb(colorHex)}, 0.15)`;
                        }
                        return colorHex;
                    }}
                    // Link styling & visibility
                    linkColor={link => {
                        if (highlightLinks.size > 0 && !highlightLinks.has(link as Link)) {
                            return 'rgba(251, 191, 36, 0.1)';
                        }
                        return 'rgba(251, 191, 36, 0.6)';
                    }}
                    linkWidth={link => (highlightLinks.has(link as Link) ? 1.5 : 1)}
                    linkDirectionalArrowLength={3.5}
                    linkDirectionalArrowRelPos={1}
                    linkCurvature={0.1}
                    linkDirectionalParticleWidth={link => (highlightLinks.has(link as Link) ? 3 : 0)}
                    linkDirectionalParticleColor={() => 'rgba(251, 191, 36, 0.8)'}
                    // Interaction
                    onNodeHover={handleNodeHover}
                    // FIX: Explicitly type the node parameter as 'unknown' and use a typed variable with a cast to prevent type inference issues with the library.
                    onNodeDrag={(node: unknown) => {
                        const typedNode = node as Node;
                        if (draggedNodeId !== typedNode.id) {
                            setDraggedNodeId(typedNode.id as string);
                        }
                        // Pin node while dragging for smooth movement
                        if (typedNode.x !== undefined && typedNode.y !== undefined) {
                            typedNode.fx = typedNode.x;
                            typedNode.fy = typedNode.y;
                        }
                    }}
                    onNodeDragEnd={node => {
                        setDraggedNodeId(null);
                        // Reheat simulation to resettle neighbors after drag
                        fgRef.current?.d3ReheatSimulation();
                    }}
                    onNodeDoubleClick={(node) => {
                        // Un-pin node on double click
                        (node as Node).fx = undefined;
                        (node as Node).fy = undefined;
                        // Briefly reheat the simulation to allow the node to move
                        fgRef.current?.d3ReheatSimulation();
                    }}
                    onEngineStop={handleEngineStop}
                    // Custom drawing
                    nodeCanvasObjectMode={() => 'after'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const typedNode = node as Node;
                        // Drag visual feedback
                        if (draggedNodeId === typedNode.id) {
                            const colorHex = groupColors[typedNode.group] || groupColors.default;
                            const nodeRelSize = 8; // Match nodeRelSize prop
                            // FIX: Corrected typo from globalSca.le to globalScale
                            const radius = nodeRelSize + 3 / globalScale; // Scale radius with zoom
                            ctx.beginPath();
                            ctx.arc(typedNode.x!, typedNode.y!, radius, 0, 2 * Math.PI, false);
                            ctx.fillStyle = `rgba(${hexToRgb(colorHex)}, 0.3)`;
                            ctx.fill();
                        }
                        const label = typedNode.id as string;
                        const fontSize = 12 / globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = (highlightNodes.size > 0 && !highlightNodes.has(typedNode))
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(255, 255, 255, 0.9)';
                        if (typedNode.x !== undefined && typedNode.y !== undefined) {
                            ctx.fillText(label, typedNode.x, typedNode.y + 12); // Adjust label position for larger nodes
                        }
                    }}
                    linkCanvasObjectMode={() => 'after'}
                    linkCanvasObject={(link, ctx, globalScale) => {
                        const MAX_FONT_SIZE = 8;
                        const MIN_FONT_SIZE = 3;
                        const label = (link as Link).value as string;
                        const start = (link as Link).source as any;
                        const end = (link as Link).target as any;
                        // Only draw label for highlighted links
                        if (!start || !end || start.x === undefined || start.y === undefined || end.x === undefined || end.y === undefined || !highlightLinks.has(link as Link)) return;

                        const textPos = {
                            x: start.x + (end.x - start.x) / 2,
                            y: start.y + (end.y - start.y) / 2
                        };
                        
                        const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, 8 / globalScale));
                        ctx.font = `italic ${fontSize}px Sans-Serif`;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(label, textPos.x, textPos.y);
                    }}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-600 text-lg">Alfie's memory is currently empty. Start a conversation to build it.</p>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};
