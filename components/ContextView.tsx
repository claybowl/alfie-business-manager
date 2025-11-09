import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraph, clearGraph, saveNodePositions, KnowledgeGraphData, Node } from '../utils/knowledgeGraph';

export const ContextView: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null); // Ref for the graph instance

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
    
    const observer = new ResizeObserver(updateSize);
    const currentRef = containerRef.current;
    if(currentRef) {
        observer.observe(currentRef);
    }
    updateSize();
    
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
    if (fgRef.current) {
        // Save current node positions for layout persistence
        const currentNodes = fgRef.current.graphData().nodes as Node[];
        saveNodePositions(currentNodes);
    }
  }, []);

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
                className="px-4 py-2 bg-red-900/50 text-red-300 border border-red-500/30 rounded-md hover:bg-red-800/60 transition-colors"
                aria-label="Clear Alfie's memory"
            >
                Clear Memory
            </button>
        </header>
        <main ref={containerRef} className="flex-grow w-full border border-gray-800 rounded-lg bg-black/30 relative overflow-hidden">
            {hasData && containerSize.width > 0 ? (
                <ForceGraph2D
                    ref={fgRef}
                    width={containerSize.width}
                    height={containerSize.height}
                    graphData={graphData}
                    // Physics
                    d3AlphaDecay={0.05}
                    // Node styling
                    nodeLabel="id"
                    nodeAutoColorBy="group"
                    // Link styling & visibility
                    linkColor={() => 'rgba(251, 191, 36, 0.5)'} // Increased opacity
                    linkWidth={1}
                    linkDirectionalArrowLength={3.5}
                    linkDirectionalArrowRelPos={1}
                    linkCurvature={0.1}
                    linkDirectionalParticles={1}
                    linkDirectionalParticleWidth={2.5}
                    linkDirectionalParticleColor={() => 'rgba(251, 191, 36, 0.8)'}
                    // Interaction
                    onNodeDragEnd={node => {
                        node.fx = node.x;
                        node.fy = node.y;
                    }}
                    onEngineStop={handleEngineStop}
                    // Custom drawing
                    nodeCanvasObjectMode={() => 'after'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const label = node.id as string;
                        const fontSize = 12 / globalScale;
                        ctx.font = `${fontSize}px Sans-Serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        if (node.x !== undefined && node.y !== undefined) {
                            ctx.fillText(label, node.x, node.y + 10);
                        }
                    }}
                    linkCanvasObjectMode={() => 'after'}
                    linkCanvasObject={(link, ctx, globalScale) => {
                        const MAX_FONT_SIZE = 8;
                        const MIN_FONT_SIZE = 3;
                        const label = link.value as string;
                        const start = link.source as any;
                        const end = link.target as any;
                        if (!start || !end || start.x === undefined || start.y === undefined || end.x === undefined || end.y === undefined) return;

                        const textPos = {
                            x: start.x + (end.x - start.x) / 2,
                            y: start.y + (end.y - start.y) / 2
                        };
                        
                        const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, 8 / globalScale));
                        ctx.font = `italic ${fontSize}px Sans-Serif`;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
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