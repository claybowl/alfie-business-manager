import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { forceCollide, forceManyBody } from 'd3-force';
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
    person: { primary: '#ff6b9d', glow: '#ff6b9d80' },       // Hot pink
    place: { primary: '#00f5d4', glow: '#00f5d480' },        // Cyan
    organization: { primary: '#fee440', glow: '#fee44080' }, // Yellow
    concept: { primary: '#9b5de5', glow: '#9b5de580' },      // Purple
    object: { primary: '#00bbf9', glow: '#00bbf980' },       // Blue
    event: { primary: '#f15bb5', glow: '#f15bb580' },        // Magenta
    tool: { primary: '#00ff88', glow: '#00ff8880' },         // Neon green
    project: { primary: '#ff9f1c', glow: '#ff9f1c80' },      // Orange
    Entity: { primary: '#6c757d', glow: '#6c757d40' },       // Gray (fallback)
    default: { primary: '#6c757d', glow: '#6c757d40' }       // Gray
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
  tool: '🔧',
  project: '📁',
  Entity: '◈',
  default: '◈'
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENT TYPE INFERENCE - Assign semantic types based on entity content
// ═══════════════════════════════════════════════════════════════════════════════

// Known entities for quick lookup
const KNOWN_ENTITIES: Record<string, string> = {
  // People
  'clay': 'person',
  'alfie': 'person',
  'alfie solomons': 'person',
  'user': 'person',
  'assistant': 'person',
  
  // Places
  'washington dc': 'place',
  'washington': 'place',
  'london': 'place',
  'birmingham': 'place',
  
  // Organizations
  'donjon intelligence systems': 'organization',
  'donjon': 'organization',
  'peaky blinders': 'organization',
  
  // Tools & Tech
  'neo4j': 'tool',
  'graphiti': 'tool',
  'pieces os': 'tool',
  'pieces': 'tool',
  'linear': 'tool',
  'notion': 'tool',
  'vercel': 'tool',
  'react': 'tool',
  'python': 'tool',
  'node': 'tool',
  'typescript': 'tool',
  
  // Projects
  'alfie business manager': 'project',
  'alfie business manager project': 'project',
};

// Patterns for type inference
const TYPE_PATTERNS: { pattern: RegExp; type: string }[] = [
  // Tools & Tech (check first - specific patterns)
  { pattern: /\b(api|sdk|app|tool|software|platform|service|database|server|client|library|framework|ai|llm|gpt|claude)\b/i, type: 'tool' },
  { pattern: /\.(js|ts|py|go|rs|java|jsx|tsx)$/i, type: 'tool' },
  
  // Projects
  { pattern: /\b(project|app|application|system|manager|dashboard)\b/i, type: 'project' },
  
  // Organizations
  { pattern: /\b(inc|llc|corp|company|org|organization|team|group|department|agency|firm|institute|systems)\b/i, type: 'organization' },
  
  // Places
  { pattern: /\b(city|town|country|state|street|avenue|building|office|location|dc|nyc|la|sf)\b/i, type: 'place' },
  
  // Events
  { pattern: /\b(meeting|event|call|session|conversation|discussion|interview|presentation)\b/i, type: 'event' },
  
  // Concepts (abstract ideas)
  { pattern: /\b(concept|idea|strategy|plan|goal|vision|mission|value|principle|theory|method|process|workflow|memory|knowledge|context)\b/i, type: 'concept' },
];

// Infer entity type from name and summary
function inferEntityType(name: string, summary?: string): string {
  const nameLower = name.toLowerCase().trim();
  
  // Check known entities first
  if (KNOWN_ENTITIES[nameLower]) {
    return KNOWN_ENTITIES[nameLower];
  }
  
  // Check patterns
  const textToAnalyze = `${name} ${summary || ''}`;
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(textToAnalyze)) {
      return type;
    }
  }
  
  // Heuristic: Single capitalized words that look like names → person
  if (/^[A-Z][a-z]+$/.test(name) && name.length > 2 && name.length < 15) {
    return 'person';
  }
  
  // Heuristic: Multiple capitalized words → likely person or organization
  if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(name)) {
    // If it's 2-3 words, probably a person
    const words = name.split(/\s+/);
    if (words.length <= 3) {
      return 'person';
    }
    return 'organization';
  }
  
  // Default to concept for abstract terms
  return 'concept';
}

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
  const [showLinkLabels, setShowLinkLabels] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const [showStraightLines, setShowStraightLines] = useState(false);
  const [showLineAnimations, setShowLineAnimations] = useState(true);
  const [abbreviateLabels, setAbbreviateLabels] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Particle animation state
  const particlesRef = useRef<Map<string, { progress: number; speed: number }[]>>(new Map());
  const animationRef = useRef<number>(0);

  // Create intelligent abbreviation function
  const createReadableAbbreviation = (text: string): string => {
    // List of important words to keep when possible
    const importantWords = ['is', 'has', 'can', 'will', 'was', 'were', 'are', 'been', 'being', 'have', 'had', 'do', 'does', 'did'];
    const actionWords = ['relates', 'connects', 'links', 'associated', 'related', 'connected', 'depends', 'requires', 'needs', 'uses', 'contains', 'includes', 'involves', 'affects', 'impacts', 'influences'];

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);

    if (words.length === 1) {
      // Single word - just truncate if too long
      return text.length > 12 ? text.substring(0, 12) + '...' : text;
    }

    // For multi-word phrases, try to keep meaningful words
    let result: string[] = [];
    let length = 0;

    // First, try to keep action words or important short words
    for (const word of words) {
      if (length >= 15) break;

      const lowerWord = word.toLowerCase();

      // Keep action words and important words that are short
      if ((actionWords.includes(lowerWord) || importantWords.includes(lowerWord)) && word.length <= 8) {
        result.push(word);
        length += word.length + 1; // +1 for space
        continue;
      }

      // For other words, take first few characters
      if (word.length > 6) {
        result.push(word.substring(0, 4));
        length += 4 + 1;
      } else {
        result.push(word);
        length += word.length + 1;
      }
    }

    // If result is still too long, be more aggressive
    let finalResult = result.join(' ');
    if (finalResult.length > 18) {
      // Take first letter of each word + keep one meaningful word
      const importantWord = words.find(w => actionWords.includes(w.toLowerCase()) || w.length <= 4) || words[0];
      const initials = words.map(w => w[0]).join('').toUpperCase();
      finalResult = `${importantWord.substring(0, 6)} ${initials}`;
    }

    return finalResult.trim();
  };

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
        // Force refresh on initial load to get latest data
        const data = await fetchGraphData(true);
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

  // Particle animation loop - trigger re-render via state update
  const [particleTick, setParticleTick] = useState(0);
  
  useEffect(() => {
    if (!showParticles || graphData.links.length === 0) return;
    
    const animate = () => {
      particlesRef.current.forEach((particles) => {
        particles.forEach(p => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
        });
      });
      // Trigger canvas redraw by updating tick
      setParticleTick(t => (t + 1) % 1000);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [showParticles, graphData.links.length]);

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

  const getNodeColor = useCallback((node: Node | string) => {
    // If passed a node object, infer the type
    if (typeof node === 'object') {
      const inferredType = inferEntityType(node.id, node.summary);
      return THEME.nodeColors[inferredType as keyof typeof THEME.nodeColors] || THEME.nodeColors.default;
    }
    // If passed a string (group name), use it directly
    return THEME.nodeColors[node as keyof typeof THEME.nodeColors] || THEME.nodeColors.default;
  }, []);
  
  // Get inferred type for a node (for display)
  const getNodeType = useCallback((node: Node): string => {
    return inferEntityType(node.id, node.summary);
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
    if (node && graphRef.current) {
      // Use 2D center and zoom controls
      graphRef.current.centerAt(node.x || 0, node.y || 0, 500);
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
    // Force refresh to bypass cache
    const data = await fetchGraphData(true);
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

  
  // Handle spreading nodes out
  const handleSpreadNodes = useCallback(() => {
    if (!graphRef.current) return;

    const graph = graphRef.current;

    // Clear frozen positions to re-enable physics
    graphData.nodes.forEach(node => {
      node.fx = undefined;
      node.fy = undefined;
    });

    // Increase forces for better spreading
    graph.d3Force('charge', forceManyBody().strength(-500).distanceMax(600));
    graph.d3Force('link')?.distance(150);
    graph.d3Force('center')?.strength(0.01);

    // Enhanced collision for bouncing
    graph.d3Force('collide', forceCollide()
      .radius(40)
      .strength(1.2)
      .iterations(5)
    );

    // Reheat simulation and run longer
    setIsSimulationRunning(true);
    graph.d3ReheatSimulation();
    graph.cooldownTicks(300);

    // Auto-freeze after 6 seconds to let nodes settle
    setTimeout(() => {
      setIsSimulationRunning(false);
      graphData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          node.fx = node.x;
          node.fy = node.y;
        }
      });
      saveNodePositions(graphData.nodes);
      // Reset forces to original values
      graph.d3Force('charge', forceManyBody().strength(-300).distanceMax(400));
      graph.d3Force('link')?.distance(120);
      graph.d3Force('center')?.strength(0.03);
      graph.d3Force('collide', forceCollide()
        .radius(35)
        .strength(0.8)
        .iterations(3)
      );
    }, 6000);
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
            onClick={() => setShowLinks(!showLinks)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              showLinks
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            🔗 {showLinks ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowLinkLabels(!showLinkLabels)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              showLinkLabels
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            🔤 {showLinkLabels ? 'LABELS ON' : 'LABELS OFF'}
          </button>

          <button
            onClick={() => setShowStraightLines(!showStraightLines)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              showStraightLines
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            📏 {showStraightLines ? 'STRAIGHT' : 'CURVED'}
          </button>

          <button
            onClick={() => setShowLineAnimations(!showLineAnimations)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              showLineAnimations
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            ⚡ {showLineAnimations ? 'ANIM ON' : 'ANIM OFF'}
          </button>

          <button
            onClick={() => setAbbreviateLabels(!abbreviateLabels)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              abbreviateLabels
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
            }`}
          >
            📝 {abbreviateLabels ? 'ABBREV' : 'FULL'}
          </button>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 bg-gray-800/50 text-gray-300 border border-gray-700/50 rounded text-xs font-mono hover:bg-gray-700/50 disabled:opacity-50 transition-all"
          >
            ↻ SYNC
          </button>
          
          {hasData && (
            <>
              <button
                onClick={handleSpreadNodes}
                className="px-3 py-1.5 bg-purple-800/50 text-purple-300 border border-purple-700/50 rounded text-xs font-mono hover:bg-purple-700/50 transition-all"
              >
                ⚡ SPREAD
              </button>
              <button
                onClick={() => graphRef.current?.zoomToFit(400, 80)}
                className="px-3 py-1.5 bg-gray-800/50 text-gray-300 border border-gray-700/50 rounded text-xs font-mono hover:bg-gray-700/50 transition-all"
              >
                ◎ FIT
              </button>
            </>
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

                // 2D Settings
                backgroundColor="#0a0a0f"

                // Wire geometric nodes (adapted for 2D)
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const n = node as Node;
                  const colors = getNodeColor(n);
                  const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(n.id);
                  const isSelected = selectedNode === n.id;
                  const isHovered = hoveredNode === n.id;

                  const baseRadius = isSelected ? 8 : isHovered ? 6 : 5;

                  // Node position
                  const x = node.x || 0;
                  const y = node.y || 0;

                  ctx.save();
                  ctx.translate(x, y);

                  // Create wire geometric shape
                  ctx.strokeStyle = colors.primary;
                  ctx.lineWidth = isHighlighted ? 2 : 1;
                  ctx.globalAlpha = isHighlighted ? 0.9 : 0.6;
                  ctx.fillStyle = colors.primary;

                  // Draw spiral/geometric pattern
                  ctx.beginPath();
                  const points = [
                    { x: -baseRadius, y: 0 },
                    { x: -baseRadius * 0.5, y: baseRadius * 0.5 },
                    { x: 0, y: 0 },
                    { x: baseRadius * 0.5, y: baseRadius * 0.5 },
                    { x: baseRadius, y: 0 },
                    { x: baseRadius * 0.5, y: -baseRadius * 0.5 },
                    { x: 0, y: 0 },
                    { x: -baseRadius * 0.5, y: -baseRadius * 0.5 },
                    { x: -baseRadius, y: 0 }
                  ];

                  points.forEach((point, i) => {
                    if (i === 0) {
                      ctx.moveTo(point.x, point.y);
                    } else {
                      ctx.lineTo(point.x, point.y);
                    }
                  });

                  ctx.closePath();
                  ctx.stroke();

                  // Add inner glow for highlighted nodes
                  if (isHighlighted) {
                    ctx.beginPath();
                    ctx.arc(0, 0, baseRadius * 0.3, 0, 2 * Math.PI);
                    ctx.globalAlpha = 0.4;
                    ctx.fill();
                  }

                  ctx.restore();
                }}

                // Links with glow effect
                linkColor={showLinks ? '#00f5d4' : 'rgba(0,245,212,0.1)'}
                linkWidth={showLinks ? 0.8 : 0}
                linkDirectionalParticles={showParticles && showLineAnimations ? 3 : 0}
                linkDirectionalParticleSpeed={0.008}
                linkDirectionalParticleWidth={2.5}
                linkDirectionalParticleColor="#ffff00"

                // Custom link rendering for straight lines and labels
                linkCanvasObject={(link, ctx, globalScale) => {
                  const source = link.source as Node;
                  const target = link.target as Node;
                  const sourceX = source.x || 0;
                  const sourceY = source.y || 0;
                  const targetX = target.x || 0;
                  const targetY = target.y || 0;

                  // Always draw lines for particles, but control visibility
                  if (!showLinks && !showLineAnimations) return;

                  ctx.save();
                  ctx.beginPath();
                  ctx.moveTo(sourceX, sourceY);

                  if (showStraightLines) {
                    // Draw straight line
                    ctx.lineTo(targetX, targetY);
                  } else {
                    // Draw curved line
                    const dx = targetX - sourceX;
                    const dy = targetY - sourceY;
                    const cx = sourceX + dx / 2 - dy / 4;
                    const cy = sourceY + dy / 2 + dx / 4;
                    ctx.quadraticCurveTo(cx, cy, targetX, targetY);
                  }

                  // Draw line only if showLinks is true, otherwise make it nearly invisible for particles
                  if (showLinks) {
                    ctx.strokeStyle = '#00f5d4';
                    ctx.lineWidth = 0.4;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();
                  } else if (showLineAnimations) {
                    // Draw invisible line for particles to follow with electric effect
                    ctx.strokeStyle = 'rgba(0,245,212,0.15)';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.1;
                    ctx.stroke();

                    // Add electric glow effect
                    ctx.strokeStyle = 'rgba(0,255,255,0.3)';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.05;
                    ctx.stroke();
                  }
                  ctx.restore();

                  // Draw labels if enabled
                  if (showLinkLabels && showLinks) {
                    // Calculate midpoint
                    const midX = (sourceX + targetX) / 2;
                    const midY = (sourceY + targetY) / 2;

                    // Only show label if zoomed in enough and link has a value
                    let linkValue = typeof link.value === 'string' ? link.value : '';
                    if (!linkValue || globalScale < 0.5) return;

                    // Abbreviate if enabled
                    if (abbreviateLabels && linkValue.length > 10) {
                      // Create intelligent abbreviation
                      linkValue = createReadableAbbreviation(linkValue);
                    }

                    ctx.save();
                    ctx.translate(midX, midY);

                    // Draw label background
                    ctx.font = '10px monospace';
                    const textWidth = ctx.measureText(linkValue).width;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillRect(-textWidth / 2 - 4, -6, textWidth + 8, 12);

                    // Draw label text
                    ctx.fillStyle = '#00f5d4';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(linkValue, 0, 0);

                    ctx.restore();
                  }
                }}

                // Events
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onBackgroundClick={handleBackgroundClick}
              />

              {/* Graph overlay info */}
              <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono bg-black/50 px-3 py-2 rounded">
                🖱️ Left click: Select • Drag: Move • Scroll: Zoom • Right-click + drag: Pan
              </div>
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
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ 
                    backgroundColor: getNodeColor(selectedNodeData.node).primary + '30',
                    border: `2px solid ${getNodeColor(selectedNodeData.node).primary}`
                  }}
                >
                  {NODE_ICONS[getNodeType(selectedNodeData.node)] || NODE_ICONS.default}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">{selectedNodeData.node.id}</h3>
                  <p 
                    className="text-xs uppercase tracking-wider"
                    style={{ color: getNodeColor(selectedNodeData.node).primary }}
                  >
                    {getNodeType(selectedNodeData.node)}
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
          <span><kbd className="text-cyan-400">Right-click + Drag</kbd> Pan</span>
          <span><kbd className="text-cyan-400">STRAIGHT</kbd> Line type</span>
          <span><kbd className="text-cyan-400">ANIM</kbd> Particles</span>
          <span><kbd className="text-cyan-400">ABBREV</kbd> Labels</span>
        </div>
        <div className="flex gap-4">
          {['person', 'organization', 'place', 'tool', 'project', 'concept'].map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ 
                  backgroundColor: THEME.nodeColors[type as keyof typeof THEME.nodeColors].primary,
                  boxShadow: `0 0 6px ${THEME.nodeColors[type as keyof typeof THEME.nodeColors].primary}`
                }} 
              />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
