import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { forceCollide, forceManyBody, forceLink } from 'd3-force';
import { 
  getGraph, 
  fetchGraphData, 
  clearGraph, 
  saveNodePositions, 
  checkGraphitiHealth,
  searchGraph,
  KnowledgeGraphData, 
  Node, 
  Link 
} from '../utils/knowledgeGraph';

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL THEME - Cyberpunk Neon
// ═══════════════════════════════════════════════════════════════════════════════

const THEME = {
  // Node colors by group - vibrant neon palette
  nodeColors: {
    person: { primary: '#ff6b9d', glow: '#ff6b9d80' },      // Hot pink
    place: { primary: '#00f5d4', glow: '#00f5d480' },       // Cyan
    organization: { primary: '#fee440', glow: '#fee44080' }, // Yellow
    concept: { primary: '#9b5de5', glow: '#9b5de580' },     // Purple
    object: { primary: '#00bbf9', glow: '#00bbf980' },      // Blue
    event: { primary: '#f15bb5', glow: '#f15bb580' },       // Magenta
    Entity: { primary: '#00f5d4', glow: '#00f5d480' },      // Default cyan
    default: { primary: '#8b8b8b', glow: '#8b8b8b40' }      // Gray
  },
  // Link colors
  link: {
    default: 'rgba(0, 245, 212, 0.25)',
    highlighted: 'rgba(0, 245, 212, 0.9)',
    dimmed: 'rgba(0, 245, 212, 0.08)'
  },
  // Background
  bg: {
    primary: '#0a0a0f',
    grid: 'rgba(0, 245, 212, 0.03)',
    vignette: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
  },
  // Text
  text: {
    primary: '#ffffff',
    secondary: '#a0a0a0',
    accent: '#00f5d4'
  }
};

// Icons for node types
const NODE_ICONS: Record<string, string> = {
  person: '👤',
  place: '📍',
  organization: '🏢',
  concept: '💡',
  object: '📦',
  event: '📅',
  Entity: '◈',
  default: '◈'
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const ContextView: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [graphitiStatus, setGraphitiStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showParticles, setShowParticles] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Particle animation state
  const particlesRef = useRef<Map<string, { progress: number; speed: number }[]>>(new Map());
  const animationRef = useRef<number>(0);

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────────

  // Check Graphiti health
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkGraphitiHealth();
      setGraphitiStatus(healthy ? 'connected' : 'offline');
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Load graph data
  useEffect(() => {
    const loadGraph = async () => {
      setIsLoading(true);
      try {
        const data = await fetchGraphData();
        setGraphData(data);
        // Initialize particles for each link
        data.links.forEach((link, i) => {
          const key = `${typeof link.source === 'object' ? (link.source as Node).id : link.source}-${typeof link.target === 'object' ? (link.target as Node).id : link.target}`;
          particlesRef.current.set(key, [
            { progress: Math.random(), speed: 0.002 + Math.random() * 0.003 }
          ]);
        });
      } catch (error) {
        console.error('Failed to load graph:', error);
        setGraphData(getGraph());
      }
      setIsLoading(false);
    };
    
    loadGraph();
    
    const handleUpdate = () => loadGraph();
    window.addEventListener('graphDataUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    
    return () => {
      window.removeEventListener('graphDataUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Handle resize
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

  // Configure physics
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || graphData.nodes.length === 0) return;

    // Stronger repulsion for better spacing
    graph.d3Force('charge', forceManyBody().strength(-300).distanceMax(400));
    graph.d3Force('link')?.distance(120);
    graph.d3Force('center')?.strength(0.03);
    
    // Collision with larger radius
    graph.d3Force('collide', forceCollide()
      .radius(35)
      .strength(0.8)
      .iterations(3)
    );

    // Zoom to fit
    const zoomTimer = setTimeout(() => {
      graph.zoomToFit(600, 80);
    }, 800);

    // Freeze after settling
    const freezeTimer = setTimeout(() => {
      setIsSimulationRunning(false);
      graphData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          node.fx = node.x;
          node.fy = node.y;
        }
      });
      saveNodePositions(graphData.nodes);
    }, 4000);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(freezeTimer);
    };
  }, [graphData]);

  // Particle animation loop
  useEffect(() => {
    if (!showParticles) return;
    
    const animate = () => {
      particlesRef.current.forEach((particles, key) => {
        particles.forEach(p => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
        });
      });
      graphRef.current?.refresh();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [showParticles, graphData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

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

  const getNodeColor = useCallback((group: string) => {
    return THEME.nodeColors[group as keyof typeof THEME.nodeColors] || THEME.nodeColors.default;
  }, []);

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Local fuzzy search first
    const localMatches = graphData.nodes
      .filter(n => n.id.toLowerCase().includes(query.toLowerCase()))
      .map(n => n.id);
    setSearchResults(localMatches);
    
    // Also search via Graphiti for semantic matches
    if (query.length > 2) {
      const result = await searchGraph(query, 5);
      if (result.success && result.results.length > 0) {
        // Could highlight these differently
      }
    }
  }, [graphData.nodes]);

  // Focus on a specific node
  const focusNode = useCallback((nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node && graphRef.current && node.x !== undefined && node.y !== undefined) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
      setSelectedNode(nodeId);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [graphData.nodes]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleClearMemory = async () => {
    if (confirm('⚠️ Clear Alfie\'s entire memory?\n\nThis will delete all entities and relationships from the knowledge graph. This cannot be undone.')) {
      const success = await clearGraph();
      if (success) {
        setGraphData({ nodes: [], links: [] });
        setSelectedNode(null);
        particlesRef.current.clear();
      }
    }
  };
  
  const handleRefresh = async () => {
    setIsLoading(true);
    const data = await fetchGraphData();
    setGraphData(data);
    setIsLoading(false);
    graphRef.current?.zoomToFit(400, 80);
  };

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(prev => prev === node.id ? null : node.id);
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node ? node.id : null);
    document.body.style.cursor = node ? 'pointer' : 'default';
  }, []);

  const handleNodeDragStart = useCallback((node: any) => {
    setIsSimulationRunning(true);
    graphData.nodes.forEach(n => {
      if (n.id === node.id) return;
      const dx = (n.x || 0) - (node.x || 0);
      const dy = (n.y || 0) - (node.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 150) {
        n.fx = undefined;
        n.fy = undefined;
      }
    });
    graphRef.current?.d3ReheatSimulation();
  }, [graphData.nodes]);

  const handleNodeDrag = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
    setTimeout(() => {
      setIsSimulationRunning(false);
      graphData.nodes.forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          n.fx = n.x;
          n.fy = n.y;
        }
      });
      saveNodePositions(graphData.nodes);
    }, 1000);
  }, [graphData.nodes]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────────

  const activeNode = selectedNode || hoveredNode;
  const highlightedNodes = activeNode ? getConnectedNodes(activeNode) : new Set<string>();
  const hasData = graphData.nodes.length > 0;

  // Get selected node details
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const node = graphData.nodes.find(n => n.id === selectedNode);
    if (!node) return null;
    
    const connections = graphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
      return sourceId === selectedNode || targetId === selectedNode;
    });
    
    return { node, connections };
  }, [selectedNode, graphData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-900/30 bg-gradient-to-r from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <div>
              <h1 className="text-lg font-medium text-white tracking-wide">
                NEURAL MEMORY
              </h1>
              <p className="text-xs text-cyan-400/60 font-mono">
                {isLoading ? 'SYNCHRONIZING...' : hasData 
                  ? `${graphData.nodes.length} ENTITIES • ${graphData.links.length} SYNAPSES`
                  : 'AWAITING INPUT'}
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono ${
            graphitiStatus === 'connected' 
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
              : graphitiStatus === 'offline'
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              graphitiStatus === 'connected' ? 'bg-cyan-400 animate-pulse' 
              : graphitiStatus === 'offline' ? 'bg-red-400' : 'bg-gray-400'
            }`}></span>
            {graphitiStatus === 'connected' ? 'GRAPHITI ONLINE' : graphitiStatus === 'offline' ? 'OFFLINE' : 'CONNECTING'}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-48 px-3 py-1.5 bg-black/40 border border-cyan-900/30 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1117] border border-cyan-900/30 rounded shadow-xl z-50 max-h-48 overflow-auto">
                {searchResults.map(id => (
                  <button
                    key={id}
                    onClick={() => focusNode(id)}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-cyan-500/10 flex items-center gap-2"
                  >
                    <span className="text-cyan-400">◈</span>
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Particle Toggle */}
          <button
            onClick={() => setShowParticles(!showParticles)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              showParticles 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            ⚡ {showParticles ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 bg-gray-800/50 text-gray-300 border border-gray-700/50 rounded text-xs font-mono hover:bg-gray-700/50 disabled:opacity-50 transition-all"
          >
            ↻ SYNC
          </button>
          
          {hasData && (
            <button
              onClick={() => graphRef.current?.zoomToFit(400, 80)}
              className="px-3 py-1.5 bg-gray-800/50 text-gray-300 border border-gray-700/50 rounded text-xs font-mono hover:bg-gray-700/50 transition-all"
            >
              ◎ FIT
            </button>
          )}
          
          <button
            onClick={handleClearMemory}
            className="px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/50 rounded text-xs font-mono hover:bg-red-800/40 transition-all"
          >
            ✕ CLEAR
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{ 
            background: `
              radial-gradient(circle at 50% 50%, rgba(0, 245, 212, 0.02) 0%, transparent 50%),
              linear-gradient(rgba(0, 245, 212, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 245, 212, 0.02) 1px, transparent 1px),
              #0a0a0f
            `,
            backgroundSize: '100% 100%, 50px 50px, 50px 50px'
          }}
        >
          {hasData ? (
            <>
              <ForceGraph2D
                ref={graphRef}
                width={dimensions.width - (selectedNodeData ? 320 : 0)}
                height={dimensions.height}
                graphData={graphData}
                
                // Simulation
                cooldownTicks={isSimulationRunning ? 200 : 0}
                d3AlphaDecay={0.015}
                d3VelocityDecay={0.3}
                
                // Interaction
                enableNodeDrag={true}
                enablePanInteraction={true}
                enableZoomInteraction={true}
                
                // Custom node rendering
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const n = node as Node;
                  if (n.x === undefined || n.y === undefined) return;
                  
                  const colors = getNodeColor(n.group);
                  const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(n.id);
                  const isSelected = selectedNode === n.id;
                  const isHovered = hoveredNode === n.id;
                  const isSearchResult = searchResults.includes(n.id);
                  
                  const baseRadius = 12;
                  const radius = isSelected ? baseRadius * 1.4 : isHovered ? baseRadius * 1.2 : baseRadius;
                  const alpha = isHighlighted ? 1 : 0.2;
                  
                  // Outer glow
                  if (isHighlighted) {
                    const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3);
                    gradient.addColorStop(0, colors.glow);
                    gradient.addColorStop(1, 'transparent');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius * 3, 0, 2 * Math.PI);
                    ctx.fill();
                  }
                  
                  // Selection ring
                  if (isSelected || isSearchResult) {
                    ctx.strokeStyle = isSearchResult ? '#fee440' : colors.primary;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, radius + 6, 0, 2 * Math.PI);
                    ctx.stroke();
                    ctx.setLineDash([]);
                  }
                  
                  // Node body with gradient
                  const bodyGradient = ctx.createRadialGradient(
                    n.x - radius * 0.3, n.y - radius * 0.3, 0,
                    n.x, n.y, radius
                  );
                  bodyGradient.addColorStop(0, '#ffffff30');
                  bodyGradient.addColorStop(0.5, colors.primary);
                  bodyGradient.addColorStop(1, colors.primary + '80');
                  
                  ctx.globalAlpha = alpha;
                  ctx.fillStyle = bodyGradient;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
                  ctx.fill();
                  
                  // Inner highlight
                  ctx.fillStyle = 'rgba(255,255,255,0.2)';
                  ctx.beginPath();
                  ctx.arc(n.x - radius * 0.25, n.y - radius * 0.25, radius * 0.4, 0, 2 * Math.PI);
                  ctx.fill();
                  ctx.globalAlpha = 1;
                  
                  // Label
                  if (isHighlighted || globalScale > 0.8) {
                    const label = n.id;
                    const fontSize = Math.max(10, Math.min(14, 14 / globalScale));
                    ctx.font = `600 ${fontSize}px "Inter", "SF Pro Display", system-ui, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const textWidth = ctx.measureText(label).width;
                    const padding = 6;
                    const labelY = n.y + radius + fontSize + 4;
                    
                    // Label background
                    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
                    ctx.beginPath();
                    ctx.roundRect(
                      n.x - textWidth / 2 - padding,
                      labelY - fontSize / 2 - padding / 2,
                      textWidth + padding * 2,
                      fontSize + padding,
                      4
                    );
                    ctx.fill();
                    
                    // Label border
                    ctx.strokeStyle = isSelected ? colors.primary : 'rgba(0, 245, 212, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Label text
                    ctx.fillStyle = isSelected ? colors.primary : (isHighlighted ? '#ffffff' : '#888888');
                    ctx.fillText(label, n.x, labelY);
                  }
                }}
                nodePointerAreaPaint={(node, color, ctx) => {
                  const n = node as Node;
                  if (n.x === undefined || n.y === undefined) return;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, 20, 0, 2 * Math.PI);
                  ctx.fill();
                }}
                
                // Custom link rendering with particles
                linkCanvasObject={(link, ctx, globalScale) => {
                  const l = link as Link;
                  const source = l.source as any;
                  const target = l.target as any;
                  
                  if (!source.x || !target.x) return;
                  
                  const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
                  const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
                  
                  const isHighlighted = highlightedNodes.size === 0 || 
                    (highlightedNodes.has(sourceId as string) && highlightedNodes.has(targetId as string));
                  
                  // Draw curved link
                  const dx = target.x - source.x;
                  const dy = target.y - source.y;
                  const dr = Math.sqrt(dx * dx + dy * dy);
                  
                  // Calculate control point for curve
                  const midX = (source.x + target.x) / 2;
                  const midY = (source.y + target.y) / 2;
                  const curvature = 0.2;
                  const ctrlX = midX - dy * curvature;
                  const ctrlY = midY + dx * curvature;
                  
                  // Link gradient
                  const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
                  const sourceColor = getNodeColor(source.group || 'default').primary;
                  const targetColor = getNodeColor(target.group || 'default').primary;
                  
                  if (isHighlighted) {
                    gradient.addColorStop(0, sourceColor + '80');
                    gradient.addColorStop(0.5, 'rgba(0, 245, 212, 0.6)');
                    gradient.addColorStop(1, targetColor + '80');
                  } else {
                    gradient.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
                    gradient.addColorStop(1, 'rgba(0, 245, 212, 0.08)');
                  }
                  
                  ctx.strokeStyle = gradient;
                  ctx.lineWidth = isHighlighted ? 2 : 1;
                  ctx.beginPath();
                  ctx.moveTo(source.x, source.y);
                  ctx.quadraticCurveTo(ctrlX, ctrlY, target.x, target.y);
                  ctx.stroke();
                  
                  // Arrow
                  if (isHighlighted) {
                    const angle = Math.atan2(target.y - ctrlY, target.x - ctrlX);
                    const arrowLength = 8;
                    const arrowX = target.x - Math.cos(angle) * 15;
                    const arrowY = target.y - Math.sin(angle) * 15;
                    
                    ctx.fillStyle = targetColor;
                    ctx.beginPath();
                    ctx.moveTo(arrowX, arrowY);
                    ctx.lineTo(
                      arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
                      arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.lineTo(
                      arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
                      arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.closePath();
                    ctx.fill();
                  }
                  
                  // Flowing particles
                  if (showParticles && isHighlighted) {
                    const key = `${sourceId}-${targetId}`;
                    const particles = particlesRef.current.get(key) || [];
                    
                    particles.forEach(p => {
                      // Calculate position along quadratic curve
                      const t = p.progress;
                      const x = (1-t)*(1-t)*source.x + 2*(1-t)*t*ctrlX + t*t*target.x;
                      const y = (1-t)*(1-t)*source.y + 2*(1-t)*t*ctrlY + t*t*target.y;
                      
                      // Particle glow
                      const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
                      particleGradient.addColorStop(0, '#00f5d4');
                      particleGradient.addColorStop(1, 'transparent');
                      ctx.fillStyle = particleGradient;
                      ctx.beginPath();
                      ctx.arc(x, y, 6, 0, 2 * Math.PI);
                      ctx.fill();
                      
                      // Particle core
                      ctx.fillStyle = '#ffffff';
                      ctx.beginPath();
                      ctx.arc(x, y, 2, 0, 2 * Math.PI);
                      ctx.fill();
                    });
                  }
                  
                  // Relationship label
                  if (isHighlighted && l.value && (selectedNode || globalScale > 1.2)) {
                    const labelX = midX;
                    const labelY = midY - 8;
                    
                    const fontSize = Math.max(9, 11 / globalScale);
                    ctx.font = `500 ${fontSize}px "Inter", system-ui, sans-serif`;
                    const textWidth = ctx.measureText(l.value).width;
                    
                    // Background
                    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
                    ctx.beginPath();
                    ctx.roundRect(labelX - textWidth / 2 - 6, labelY - fontSize / 2 - 3, textWidth + 12, fontSize + 6, 3);
                    ctx.fill();
                    
                    ctx.strokeStyle = 'rgba(0, 245, 212, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    // Text
                    ctx.fillStyle = '#00f5d4';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(l.value, labelX, labelY);
                  }
                }}
                linkCanvasObjectMode={() => 'replace'}
                
                // Events
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onNodeDragStart={handleNodeDragStart}
                onNodeDrag={handleNodeDrag}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBackgroundClick}
              />
              
              {/* Vignette overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }}
              />
            </>
          ) : isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
                  <div className="absolute inset-2 border-2 border-cyan-500/50 rounded-full animate-pulse" />
                  <div className="absolute inset-4 border-2 border-cyan-400 rounded-full" />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
                </div>
                <p className="text-cyan-400 font-mono text-sm tracking-widest">SYNCHRONIZING MEMORY</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-6 opacity-20">🧠</div>
                <h2 className="text-xl text-white/80 mb-2">Neural Memory Empty</h2>
                <p className="text-gray-500 text-sm">
                  {graphitiStatus === 'connected' 
                    ? 'Start a conversation with Alfie to build the temporal knowledge graph.'
                    : 'Graphiti service is offline. Ensure the Python service is running.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Details Panel */}
        {selectedNodeData && (
          <div className="w-80 bg-[#0d1117] border-l border-cyan-900/30 overflow-y-auto">
            <div className="p-4 border-b border-cyan-900/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {NODE_ICONS[selectedNodeData.node.group] || NODE_ICONS.default}
                </span>
                <div>
                  <h3 className="text-lg font-medium text-white">{selectedNodeData.node.id}</h3>
                  <p className="text-xs text-cyan-400/60 uppercase tracking-wider">
                    {selectedNodeData.node.group}
                  </p>
                </div>
              </div>
              {selectedNodeData.node.summary && (
                <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                  {selectedNodeData.node.summary}
                </p>
              )}
            </div>
            
            <div className="p-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                Connections ({selectedNodeData.connections.length})
              </h4>
              <div className="space-y-2">
                {selectedNodeData.connections.map((conn, i) => {
                  const sourceId = typeof conn.source === 'object' ? (conn.source as Node).id : conn.source;
                  const targetId = typeof conn.target === 'object' ? (conn.target as Node).id : conn.target;
                  const isOutgoing = sourceId === selectedNode;
                  const connectedId = isOutgoing ? targetId : sourceId;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => focusNode(connectedId as string)}
                      className="w-full p-2 bg-black/30 rounded border border-cyan-900/20 hover:border-cyan-500/50 text-left transition-all group"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-cyan-500">{isOutgoing ? '→' : '←'}</span>
                        <span className="text-white group-hover:text-cyan-400 transition-colors">
                          {connectedId}
                        </span>
                      </div>
                      {conn.value && (
                        <p className="text-xs text-gray-500 mt-1 pl-5">{conn.value}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="px-6 py-3 border-t border-cyan-900/30 flex items-center justify-between text-xs font-mono text-gray-500">
        <div className="flex gap-6">
          <span><kbd className="text-cyan-400">Click</kbd> Select node</span>
          <span><kbd className="text-cyan-400">Drag</kbd> Move nodes</span>
          <span><kbd className="text-cyan-400">Scroll</kbd> Zoom</span>
          <span><kbd className="text-cyan-400">Pan</kbd> Move view</span>
        </div>
        <div className="flex gap-4">
          {Object.entries(THEME.nodeColors).slice(0, 5).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
