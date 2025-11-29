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
  // Node colors by group - Enhanced neon palette for brain-like effect
  nodeColors: {
    person: { primary: '#f472b6', glow: '#f472b6cc' },       // Hot pink
    place: { primary: '#4ade80', glow: '#4ade80dd' },        // Neon green
    organization: { primary: '#a78bfa', glow: '#a78bfadd' }, // Purple
    concept: { primary: '#c084fc', glow: '#c084fccc' },      // Light purple
    object: { primary: '#60a5fa', glow: '#60a5fadd' },       // Light blue
    event: { primary: '#fb7185', glow: '#fb7185dd' },        // Pink
    tool: { primary: '#34d399', glow: '#34d399ee' },         // Mint green
    project: { primary: '#fbbf24', glow: '#fbbf24dd' },      // Amber
    Entity: { primary: '#22d3ee', glow: '#22d3eecc' },       // Cyan (fallback)
    default: { primary: '#22d3ee', glow: '#22d3eecc' }       // Cyan
  },
  // Link colors
  link: {
    default: 'rgba(0, 255, 221, 0.45)',
    highlighted: 'rgba(0, 255, 221, 1.0)',
    dimmed: 'rgba(0, 255, 221, 0.15)'
  },
  // Background - Enhanced brain-like neural network
  bg: {
    primary: '#0a0a0f',
    grid: 'rgba(147, 51, 234, 0.04)', // Purple grid instead of cyan
    vignette: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.1) 0%, rgba(0,0,0,0.6) 100%)', // Purple vignette
    neuralPattern: 'radial-gradient(circle at 30% 40%, rgba(236, 72, 153, 0.08) 0%, transparent 25%), radial-gradient(circle at 70% 60%, rgba(74, 222, 128, 0.08) 0%, transparent 25%)'
  },
  // Text - Varied color palette
  text: {
    primary: '#fbbf24',        // Amber
    secondary: '#a78bfa',      // Purple
    accent: '#06b6d4',        // Turquoise
    relationship: {
      primary: '#4ade80',      // Neon green
      secondary: '#f472b6',    // Hot pink
      accent: '#60a5fa',      // Light blue
      warning: '#fbbf24',     // Yellow
      error: '#ec4899'        // Magenta
    }
  },
  // Text rendering styles following Graphiti best practices
  textStyles: {
    // Node labels - hierarchical approach
    node: {
      primary: {
        font: 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        shadowBlur: 3,
        alpha: 1.0
      },
      secondary: {
        font: '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#a0a0a0',
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        shadowBlur: 2,
        alpha: 0.8
      },
      compact: {
        font: 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ffffff',
        shadowColor: 'rgba(0, 0, 0, 0.7)',
        shadowBlur: 2,
        alpha: 0.9
      }
    },
    // Relationship labels
    relationship: {
      primary: {
        font: '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#00ff88',
        shadowColor: 'rgba(0, 0, 0, 0.9)',
        shadowBlur: 4,
        alpha: 1.0
      },
      secondary: {
        font: '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#ff6b9d',
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        shadowBlur: 3,
        alpha: 0.9
      },
      accent: {
        font: '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#00f5d4',
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        shadowBlur: 3,
        alpha: 1.0
      }
    },
    // Background containers - Transparent purple brain-like effect
    background: {
      node: {
        fill: 'rgba(147, 51, 234, 0.15)', // Transparent purple
        stroke: 'rgba(236, 72, 153, 0.4)', // Neon pink border
        strokeWidth: 1.5,
        borderRadius: 6
      },
      relationship: {
        fill: 'rgba(139, 92, 246, 0.12)', // Lighter transparent purple
        stroke: 'rgba(74, 222, 128, 0.3)', // Neon green border
        strokeWidth: 1,
        borderRadius: 4
      }
    }
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

  // Memoize graphData to prevent unnecessary ForceGraph2D re-renders
  const memoizedGraphData = useMemo(() => graphData, [JSON.stringify(graphData.nodes), JSON.stringify(graphData.links)]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [graphitiStatus, setGraphitiStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showParticles, setShowParticles] = useState(true);
  const [relationshipTextMode, setRelationshipTextMode] = useState<'off' | 'abbrev' | 'full'>('off');

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>();

  // Particle animation state
  const particlesRef = useRef<Map<string, { progress: number; speed: number }[]>>(new Map());
  const animationRef = useRef<number>(0);
  const [particleTick, setParticleTick] = useState(0);

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

  // Particle animation loop - use throttled state updates to prevent flicker
  useEffect(() => {
    if (!showParticles || graphData.links.length === 0) return;

    let lastUpdate = 0;
    const throttleMs = 16; // ~60fps max

    const animate = (timestamp: number) => {
      particlesRef.current.forEach((particles) => {
        particles.forEach(p => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
        });
      });

      // Throttle state updates to prevent excessive re-renders
      if (timestamp - lastUpdate > throttleMs) {
        setParticleTick(t => (t + 1) % 1000);
        lastUpdate = timestamp;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [showParticles, graphData.links.length]);

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

  // Split text into two rows for better readability
  const splitTextIntoRows = useCallback((text: string, maxLength: number = 8): [string, string] => {
    if (!text) return ['', ''];

    const words = text.split(/\s+/);
    if (words.length === 0) return ['', ''];

    // If text is short, return it as single row
    if (text.length <= maxLength) {
      return [text, ''];
    }

    // Try to split by word boundary
    let firstRow = '';
    let secondRow = '';

    for (const word of words) {
      if ((firstRow + ' ' + word).length <= maxLength) {
        firstRow += (firstRow ? ' ' : '') + word;
      } else {
        secondRow += (secondRow ? ' ' : '') + word;
      }
    }

    // If first row is empty, force split by character count
    if (!firstRow) {
      firstRow = text.substring(0, maxLength);
      secondRow = text.substring(maxLength);
    }

    return [firstRow.trim(), secondRow.trim()];
  }, []);

  // Get relationship text color based on type
  const getRelationshipColor = useCallback((text: string): string => {
    const lower = text.toLowerCase();

    // Directional relationships
    if (['→', '←', 'creates', 'created by', 'manages', 'managed by', 'works on', 'assigned to'].includes(lower)) {
      return THEME.text.relationship.primary;
    }

    // Bidirectional relationships
    if (['↔', 'relates to', 'works with', 'collaborates with'].includes(lower)) {
      return THEME.text.relationship.accent;
    }

    // Warning/error relationships
    if (['depends on', 'required', 'error', 'problem'].some(word => lower.includes(word))) {
      return THEME.text.relationship.warning;
    }

    // Default to secondary color
    return THEME.text.relationship.secondary;
  }, []);

  // Professional text rendering utilities following Graphiti best practices
  const renderTextWithBackground = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    style: any,
    options: {
      maxWidth?: number;
      lineHeight?: number;
      textAlign?: CanvasTextAlign;
      background?: any;
      ellipsis?: string;
    } = {}
  ) => {
    // Handle undefined/null text and ensure it's a string
    if (!text) {
      text = '';
    }
    text = String(text);

    const {
      maxWidth = 200,
      lineHeight = 14,
      textAlign = 'center',
      background = THEME.textStyles.background.relationship,
      ellipsis = '...'
    } = options;

    ctx.save();

    // Apply text style
    ctx.font = style.font;
    ctx.fillStyle = style.color;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = style.alpha;

    // Apply shadow
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;

    // Handle text wrapping if needed
    const words = text.split(' ');
    if (words.length > 1 && ctx.measureText(text).width > maxWidth) {
      // Multi-line rendering with smart wrapping
      let lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Force break word if it's too long
            const truncatedWord = word.substring(0, Math.floor(maxWidth / ctx.measureText('M').width));
            lines.push(truncatedWord);
            currentLine = word.substring(truncatedWord.length);
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Calculate total height for multi-line text
      const totalHeight = lines.length * lineHeight;

      // Draw background for multi-line text
      if (lines.length > 1) {
        const bgWidth = Math.max(...lines.map(line => ctx.measureText(line).width)) + (background.borderRadius * 2);
        const bgHeight = totalHeight + (background.borderRadius * 2);

        const rectX = x - (bgWidth / 2);
        const rectY = y - (bgHeight / 2);

        // Draw rounded rectangle background
        ctx.fillStyle = background.fill;
        ctx.beginPath();
        ctx.moveTo(rectX + background.borderRadius, rectY);
        ctx.lineTo(rectX + bgWidth - background.borderRadius, rectY);
        ctx.quadraticCurveTo(rectX + bgWidth, rectY, rectX + bgWidth, rectY + background.borderRadius);
        ctx.lineTo(rectX + bgWidth, rectY + bgHeight - background.borderRadius);
        ctx.quadraticCurveTo(rectX + bgWidth, rectY + bgHeight, rectX + bgWidth - background.borderRadius, rectY + bgHeight);
        ctx.lineTo(rectX + background.borderRadius, rectY + bgHeight);
        ctx.quadraticCurveTo(rectX, rectY + bgHeight, rectX, rectY + bgHeight - background.borderRadius);
        ctx.lineTo(rectX, rectY + background.borderRadius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + background.borderRadius, rectY);
        ctx.closePath();
        ctx.fill();

        // Draw border if specified
        if (background.strokeWidth > 0) {
          ctx.strokeStyle = background.stroke;
          ctx.lineWidth = background.strokeWidth;
          ctx.stroke();
        }
      }

      // Draw each line
      lines.forEach((line, index) => {
        const lineY = y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);
        ctx.fillText(line, x, lineY);
      });

    } else {
      // Single line rendering
      const textWidth = ctx.measureText(text).width;

      // Draw background for single line
      if (background) {
        const bgWidth = textWidth + (background.borderRadius * 2);
        const bgHeight = lineHeight + (background.borderRadius * 2);
        const rectX = x - (bgWidth / 2);
        const rectY = y - (bgHeight / 2);

        // Draw rounded rectangle background
        ctx.fillStyle = background.fill;
        ctx.beginPath();
        ctx.moveTo(rectX + background.borderRadius, rectY);
        ctx.lineTo(rectX + bgWidth - background.borderRadius, rectY);
        ctx.quadraticCurveTo(rectX + bgWidth, rectY, rectX + bgWidth, rectY + background.borderRadius);
        ctx.lineTo(rectX + bgWidth, rectY + bgHeight - background.borderRadius);
        ctx.quadraticCurveTo(rectX + bgWidth, rectY + bgHeight, rectX + bgWidth - background.borderRadius, rectY + bgHeight);
        ctx.lineTo(rectX + background.borderRadius, rectY + bgHeight);
        ctx.quadraticCurveTo(rectX, rectY + bgHeight, rectX, rectY + bgHeight - background.borderRadius);
        ctx.lineTo(rectX, rectY + background.borderRadius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + background.borderRadius, rectY);
        ctx.closePath();
        ctx.fill();

        // Draw border if specified
        if (background.strokeWidth > 0) {
          ctx.strokeStyle = background.stroke;
          ctx.lineWidth = background.strokeWidth;
          ctx.stroke();
        }
      }

      // Draw text
      ctx.fillText(text, x, y);
    }

    ctx.restore();
  }, []);

  // Smart node name truncation with full name preservation
  const getNodeDisplayName = useCallback((node: Node | any): { display: string; tooltip: string } => {
    // Handle undefined/null nodes
    if (!node || !node.id) {
      return { display: 'Entity', tooltip: 'Unknown Entity' };
    }

    const maxLength = 12;

    if (node.id.length <= maxLength) {
      return { display: node.id, tooltip: node.id };
    }

    // Try to split on word boundaries first
    const words = node.id.split(/[\s-_./]+/);
    if (words.length > 1) {
      // Check if we can make a meaningful abbreviation
      let abbreviation = '';
      let remainingText = node.id;

      // Common abbreviations for development/project contexts
      const commonAbbrevs: Record<string, string> = {
        'project': 'proj',
        'application': 'app',
        'service': 'svc',
        'component': 'comp',
        'interface': 'iface',
        'database': 'db',
        'module': 'mod',
        'function': 'func',
        'class': 'cls',
        'test': 'test',
        'api': 'api',
        'web': 'web',
        'mobile': 'mob',
        'desktop': 'desk',
        'server': 'srv',
        'client': 'cli',
        'admin': 'adm',
        'user': 'usr',
        'auth': 'auth',
        'config': 'cfg',
        'utils': 'util',
        'helpers': 'help',
        'types': 'type',
        'constants': 'const',
        'services': 'svc',
        'controllers': 'ctrl',
        'models': 'mdl',
        'views': 'view',
        'routes': 'route',
        'middleware': 'mid',
        'validation': 'val',
        'authentication': 'auth',
        'authorization': 'authz',
        'business': 'biz',
        'logic': 'logic',
        'rules': 'rule',
      };

      // Try to abbreviate common words
      for (const [full, abbrev] of Object.entries(commonAbbrevs)) {
        if (node.id.toLowerCase().includes(full)) {
          const abbreviated = node.id.toLowerCase().replace(
            new RegExp(full, 'gi'),
            abbrev
          );
          if (abbreviated.length <= maxLength) {
            return {
              display: abbreviated.charAt(0).toUpperCase() + abbreviated.slice(1),
              tooltip: node.id
            };
          }
        }
      }

      // Fallback: first meaningful words
      let result = '';
      for (const word of words) {
        if ((result + word).length <= maxLength - 1) {
          result += (result ? ' ' : '') + word;
        } else {
          break;
        }
      }
      return {
        display: result.length > 0 ? result + '...' : node.id.substring(0, maxLength - 1) + '...',
        tooltip: node.id
      };
    }

    // Last resort: character-based truncation
    return {
      display: node.id.substring(0, maxLength - 1) + '...',
      tooltip: node.id
    };
  }, []);

  // Intelligently abbreviate relationship text with comprehensive shorthand
  const abbreviateRelationship = useCallback((text: string): string => {
    if (!text) return '';

    // Comprehensive relationship mappings with meaningful shorthand
    const abbreviations: Record<string, string> = {
      // Basic relationships
      'relates to': '↔',
      'related to': '↔',
      'connection': '↔',
      'linked to': '↔',
      'associated with': '↔',

      // Directional relationships
      'mentions': '→',
      'mentioned by': '←',
      'references': '→',
      'referenced by': '←',
      'cites': '→',
      'cited by': '←',
      'points to': '→',
      'pointed to by': '←',

      // Creation relationships
      'creates': '→',
      'created by': '←',
      'generated': '→',
      'generated by': '←',
      'produced': '→',
      'produced by': '←',
      'built': '→',
      'built by': '←',
      'developed': '→',
      'developed by': '←',
      'wrote': '→',
      'written by': '←',
      'authored': '→',
      'authored by': '←',

      // Work relationships
      'works on': '→',
      'works with': '↔',
      'collaborates with': '↔',
      'partnered with': '↔',
      'team with': '↔',
      'assigned to': '→',
      'managed by': '←',
      'manages': '→',
      'leads': '→',
      'led by': '←',

      // Dependency relationships
      'depends on': '→',
      'dependent on': '→',
      'required by': '←',
      'requires': '→',
      'needs': '→',
      'needed by': '←',
      'relies on': '→',
      'relies on by': '←',

      // Ownership relationships
      'has': '→',
      'has a': '→',
      'owned by': '←',
      'owns': '→',
      'possesses': '→',
      'possessed by': '←',

      // Composition relationships
      'part of': '←',
      'component of': '←',
      'member of': '←',
      'contains': '→',
      'included in': '←',
      'subset of': '←',

      // Discussion/Communication
      'discusses': '→',
      'discussed by': '←',
      'talks about': '→',
      'talked about by': '←',
      'conversation about': '↔',
      'chat about': '↔',

      // Project/Task relationships
      'task for': '→',
      'responsible for': '→',
      'reviewed': '→',
      'reviewed by': '←',
      'approved': '→',
      'approved by': '←',

      // Learning/Knowledge
      'learns about': '→',
      'learned from': '←',
      'studies': '→',
      'studied by': '←',
      'researched': '→',
      'researched by': '←',

      // Business relationships
      'reports to': '→',
      'reported by': '←',
      'supervises': '→',
      'supervised by': '←',

      // File/Code relationships
      'imports': '→',
      'imported by': '←',
      'includes': '→',
      'included by': '←',
      'uses': '→',
      'used by': '←',
      'calls': '→',
      'called by': '←',

      // Time-based relationships
      'happened before': '→',
      'happened after': '→',
      'preceded by': '←',
      'followed by': '→',

      // General action relationships
      'affects': '→',
      'affected by': '←',
      'influences': '→',
      'influenced by': '←',
      'impacts': '→',
      'impacted by': '←',
      'changes': '→',
      'changed by': '←',

      // Process relationships
      'starts': '→',
      'started by': '←',
      'begins': '→',
      'begun by': '←',
      'ends': '→',
      'ended by': '←',
      'finishes': '→',
      'finished by': '←',
    };

    const lower = text.toLowerCase().trim();

    // Check for exact abbreviation
    if (abbreviations[lower]) {
      return abbreviations[lower];
    }

    // Pattern-based intelligent abbreviation for longer text
    if (text.length > 12) {
      // Try to extract meaningful keywords and create shorthand
      const words = text.toLowerCase().split(/\s+/);

      // Common patterns for intelligent shorthand
      if (words.length >= 3) {
        // Check for common relationship patterns
        const patterns = [
          // [contains these words, abbreviation]
          [['working', 'on'], 'work→'],
          [['worked', 'with'], 'work↔'],
          [['discussion', 'about'], 'talk↔'],
          [['conversation', 'about'], 'chat↔'],
          [['depends', 'on'], 'dep→'],
          [['related', 'to'], '↔'],
          [['belongs', 'to'], '∈'],
          [['part', 'of'], '⊂'],
          [['connected', 'to'], '↔'],
          [['associated', 'with'], '↔'],
          [['collaborated', 'with'], '↔'],
          [['managed', 'by'], 'mgr←'],
          [['manages'], 'mgr→'],
          [['created', 'by'], '←by'],
          [['creates'], '→'],
          [['mentioned'], '→'],
          [['referenced'], '→'],
          [['discussed'], '→'],
          [['reviewed'], '→'],
          [['assigned'], '→'],
          [['responsible'], '→'],
        ];

        // Check each pattern
        for (const [pattern, shorthand] of patterns) {
          if (Array.isArray(pattern) && pattern.every(word => words.includes(word))) {
            return shorthand as string;
          }
        }

        // Default: Use first meaningful word + arrow if direction can be inferred
        const firstVerb = words.find(word =>
          ['creates', 'works', 'manages', 'depends', 'mentions', 'discusses', 'assigned', 'responsible'].includes(word)
        );

        if (firstVerb) {
          const verbAbbrev: Record<string, string> = {
            'creates': '→',
            'works': '→',
            'manages': '→',
            'depends': '→',
            'mentions': '→',
            'discusses': '→',
            'assigned': '→',
            'responsible': '→',
          };

          const abbrev = verbAbbrev[firstVerb] || '→';
          return firstVerb.substring(0, 3) + abbrev;
        }

        // Fallback: Use first 2 meaningful words, max 12 chars
        const meaningfulWords = words.filter(word =>
          word.length > 2 &&
          !['the', 'and', 'for', 'with', 'this', 'that', 'have', 'been', 'from', 'they', 'said'].includes(word)
        );

        if (meaningfulWords.length >= 2) {
          const result = meaningfulWords.slice(0, 2).join('').substring(0, 12);
          return result.length > 8 ? result.substring(0, 8) + '..' : result;
        }
      }

      // Ultimate fallback: truncate to 12 chars with ellipsis
      return text.substring(0, 12) + (text.length > 12 ? '...' : '');
    }

    return text;
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
      graphRef.current.centerAt(node.x || 0, node.y || 0, 1000);
      graphRef.current.zoom(2.5, 500);
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

          {/* Relationship Text Toggle */}
          <button
            onClick={() => setRelationshipTextMode(
              relationshipTextMode === 'off' ? 'abbrev' : relationshipTextMode === 'abbrev' ? 'full' : 'off'
            )}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              relationshipTextMode === 'off'
                ? 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
                : relationshipTextMode === 'abbrev'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            🏷 {relationshipTextMode === 'off' ? 'OFF' : relationshipTextMode === 'abbrev' ? 'ABBREV' : 'FULL'}
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
              ${THEME.bg.neuralPattern},
              radial-gradient(circle at 50% 50%, ${THEME.bg.grid.replace('0.04', '0.06')} 0%, transparent 50%),
              linear-gradient(${THEME.bg.grid} 1px, transparent 1px),
              linear-gradient(90deg, ${THEME.bg.grid} 1px, transparent 1px),
              ${THEME.bg.primary}
            `,
            backgroundSize: '100% 100%, 100% 100%, 60px 60px, 60px 60px, 100% 100%',
            backgroundBlend: 'normal, normal, normal, normal, normal'
          }}
        >
          {hasData ? (
            <>
              <ForceGraph2D
                ref={graphRef}
                width={dimensions.width - (selectedNodeData ? 320 : 0)}
                height={dimensions.height}
                graphData={memoizedGraphData}

                // Simulation
                cooldownTicks={isSimulationRunning ? 200 : 0}
                d3AlphaDecay={0.015}
                d3VelocityDecay={0.3}

                // 2D Settings
                backgroundColor="#0a0a0f"

                // 2D Interaction
                enableNodeDrag={true}

                // Node rendering
                nodeCanvasObject={(node, ctx) => {
                  const n = node as Node;
                  const colors = getNodeColor(n);
                  const isHighlighted = highlightedNodes.size === 0 || highlightedNodes.has(n.id);
                  const isSelected = selectedNode === n.id;
                  const isHovered = hoveredNode === n.id;

                  const radius = isSelected ? 6 : isHovered ? 5 : 4;
                  const x = n.x || 0;
                  const y = n.y || 0;

                  // Draw strong glow effect (always visible, stronger when highlighted)
                  ctx.fillStyle = isHighlighted ? colors.glow : colors.glow.replace('cc', '88');
                  ctx.beginPath();
                  ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
                  ctx.fill();

                  // Draw outer circle glow
                  ctx.strokeStyle = colors.glow;
                  ctx.lineWidth = isHighlighted ? 3 : 1.5;
                  ctx.beginPath();
                  ctx.arc(x, y, radius + 1.5, 0, 2 * Math.PI);
                  ctx.stroke();

                  // Draw bright core node
                  ctx.fillStyle = colors.primary;
                  ctx.beginPath();
                  ctx.arc(x, y, radius, 0, 2 * Math.PI);
                  ctx.fill();

                  // Draw simple node label - very thin, light text
                  const nodeDisplayName = getNodeDisplayName((n as any).name || n.id, n.group || 'entity');
                  const displayName = nodeDisplayName.display || nodeDisplayName;

                  // Ultra-thin font weight with light gray color
                  ctx.font = '200 8px -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif';
                  
                  // Light gray text - much lighter than the cyan lines
                  ctx.fillStyle = '#6b7280'; // Light gray, not bright
                  
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  ctx.globalAlpha = 0.7; // Subtle, not prominent
                  
                  // Simple text positioning
                  const textY = y + radius + 4;
                  ctx.fillText(displayName, x, textY);
                  ctx.globalAlpha = 1;
                }}
                nodePointerAreaPaint={(node, color, ctx) => {
                  const n = node as Node;
                  const radius = 8;
                  const x = n.x || 0;
                  const y = n.y || 0;
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(x, y, radius, 0, 2 * Math.PI);
                  ctx.fill();
                }}

                // Link rendering
                linkCanvasObject={(link, ctx) => {
                  const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
                  const targetId = typeof link.target === 'object' ? (link.target as Node).id : link.target;
                  const isHighlighted = activeNode && (sourceId === activeNode || targetId === activeNode);

                  ctx.strokeStyle = isHighlighted ? THEME.link.highlighted : THEME.link.default;
                  ctx.lineWidth = isHighlighted ? 2 : 1;
                  ctx.globalAlpha = isHighlighted ? 0.8 : 0.3;

                  const source = link.source as any;
                  const target = link.target as any;

                  ctx.beginPath();
                  ctx.moveTo(source.x, source.y);
                  ctx.lineTo(target.x, target.y);
                  ctx.stroke();

                  // Draw particles along the link
                  if (showParticles) {
                    const key = `${sourceId}-${targetId}`;
                    const particles = particlesRef.current.get(key);

                    if (particles) {
                      particles.forEach(particle => {
                        const x = source.x + (target.x - source.x) * particle.progress;
                        const y = source.y + (target.y - source.y) * particle.progress;

                        // Alternate particle colors between neon green and pink
                        const particleColors = ['#4ade80', '#f472b6', '#22d3ee', '#a78bfa'];
                        ctx.fillStyle = particleColors[Math.floor(particle.progress * 4) % 4];
                        ctx.globalAlpha = 0.8;
                        ctx.beginPath();
                        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
                        ctx.fill();
                      });
                    }
                  }

                  ctx.globalAlpha = 1;

                  // Draw relationship label if enabled - skinny font, no glow
                  if (relationshipTextMode !== 'off' && link.value && isHighlighted) {
                    const midX = (source.x + target.x) / 2;
                    const midY = (source.y + target.y) / 2;

                    const label = relationshipTextMode === 'full' ? link.value : abbreviateRelationship(link.value);
                    const labelColor = getRelationshipColor(label);

                    // Skinny font without glow
                    ctx.font = '300 8px -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif';
                    ctx.fillStyle = labelColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.globalAlpha = 0.8;
                    ctx.letterSpacing = '0.3px';

                    // Draw text with subtle outline for readability
                    ctx.strokeStyle = 'rgba(10, 10, 15, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.strokeText(label, midX, midY);

                    // Draw text
                    ctx.fillText(label, midX, midY);

                    // Reset
                    ctx.letterSpacing = 'normal';
                    ctx.globalAlpha = 1;
                  }
                }}

                // Events
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onNodeDrag={handleNodeDrag}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBackgroundClick}
              />

              {/* 2D overlay info */}
              <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono bg-black/50 px-3 py-2 rounded">
                🖱️ Click + drag: Pan • Scroll: Zoom • Drag nodes to move
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
          <span><kbd className="text-cyan-400">Drag Node</kbd> Move</span>
          <span><kbd className="text-cyan-400">Scroll</kbd> Zoom</span>
          <span><kbd className="text-cyan-400">Drag Canvas</kbd> Pan</span>
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
