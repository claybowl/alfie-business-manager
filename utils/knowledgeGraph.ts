// Graphiti Temporal Knowledge Graph Integration
// Now uses Graphiti API via backend proxy instead of localStorage

// Define the structure of our graph data
export interface Node {
  id: string;
  group: string;
  uuid?: string;
  summary?: string;
  fx?: number;
  fy?: number;
  x?: number;
  y?: number;
  __bckgDimensions?: [number, number];
}

export interface Link {
  source: string;
  target: string;
  value: string;
  created_at?: string;
  valid_at?: string;
}

export interface KnowledgeGraphData {
  nodes: Node[];
  links: Link[];
}

// Use environment variable or default to 8001
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || '8001';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const POSITION_STORAGE_KEY = 'alfie-graph-positions'; // Local storage for visual positions only

// Cache for graph data to avoid excessive API calls
let graphCache: KnowledgeGraphData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 2000; // 2 seconds - reduced for more frequent refreshes

// Function to get the graph from Graphiti API
export const getGraph = (): KnowledgeGraphData => {
  // Return cached data synchronously if available
  // The actual fetch happens asynchronously via fetchGraphData()
  if (graphCache) {
    return graphCache;
  }
  return { nodes: [], links: [] };
};

// Async function to fetch fresh graph data from Graphiti
export const fetchGraphData = async (forceRefresh: boolean = false): Promise<KnowledgeGraphData> => {
  const now = Date.now();

  // Return cache if still valid and not forcing refresh
  if (!forceRefresh && graphCache && (now - lastFetchTime) < CACHE_DURATION) {
    return graphCache;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/data`);
    if (!response.ok) {
      console.error('Failed to fetch graph data:', response.status);
      return graphCache || { nodes: [], links: [] };
    }
    
    const data = await response.json();
    
    if (data.success) {
      // Transform Graphiti format to our visualization format
      const nodes: Node[] = (data.nodes || []).map((n: any) => ({
        id: n.id || n.name,
        group: n.group || 'Entity',
        uuid: n.uuid,
        summary: n.summary
      }));
      
      const links: Link[] = (data.links || []).map((l: any) => ({
        source: l.source,
        target: l.target,
        value: l.value || 'relates to',
        created_at: l.created_at,
        valid_at: l.valid_at
      }));
      
      // Restore saved positions
      const savedPositions = getSavedPositions();
      nodes.forEach(node => {
        const saved = savedPositions[node.id];
        if (saved) {
          node.x = saved.x;
          node.y = saved.y;
          node.fx = saved.fx;
          node.fy = saved.fy;
        }
      });
      
      graphCache = { nodes, links };
      lastFetchTime = now;
      
      // Notify listeners
      window.dispatchEvent(new Event('graphDataUpdated'));
      
      return graphCache;
    }
    
    return graphCache || { nodes: [], links: [] };
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return graphCache || { nodes: [], links: [] };
  }
};

// Get saved node positions from localStorage
const getSavedPositions = (): Record<string, { x?: number; y?: number; fx?: number; fy?: number }> => {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

// Saves only the positions of nodes to localStorage (for visual layout persistence)
export const saveNodePositions = (layoutNodes: Node[]) => {
  try {
    const positions: Record<string, { x?: number; y?: number; fx?: number; fy?: number }> = {};
    
    layoutNodes.forEach(node => {
      // Sanitize positions
      const x = node.x !== undefined && isFinite(node.x) ? node.x : undefined;
      const y = node.y !== undefined && isFinite(node.y) ? node.y : undefined;
      const fx = node.fx !== undefined && isFinite(node.fx) ? node.fx : undefined;
      const fy = node.fy !== undefined && isFinite(node.fy) ? node.fy : undefined;
      
      if (x !== undefined || y !== undefined || fx !== undefined || fy !== undefined) {
        positions[node.id] = { x, y, fx, fy };
      }
    });
    
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.error("Error saving node positions:", error);
  }
};

// Function to clear the graph via Graphiti API
export const clearGraph = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/clear`, {
      method: 'DELETE'
    });
    const data = await response.json();
    
    if (data.success) {
      // Clear local cache and positions
      graphCache = null;
      lastFetchTime = 0;
      localStorage.removeItem(POSITION_STORAGE_KEY);
      window.dispatchEvent(new Event('graphDataUpdated'));
      return true;
    }
    
    console.error('Failed to clear graph:', data.error);
    return false;
  } catch (error) {
    console.error('Error clearing graph:', error);
    return false;
  }
};

// Add an episode to Graphiti (replaces the old LLM-based extraction)
export const addEpisodeToGraph = async (
  content: string,
  source: string = 'alfie_conversation',
  episodeType: string = 'message'
): Promise<{ success: boolean; entities_count?: number; edges_count?: number; error?: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/episode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        source,
        episode_type: episodeType
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Invalidate cache so next fetch gets fresh data
      graphCache = null;
      lastFetchTime = 0;
      window.dispatchEvent(new Event('graphDataUpdated'));
    }
    
    return data;
  } catch (error) {
    console.error('Error adding episode to graph:', error);
    return { success: false, error: String(error) };
  }
};

// Add a full conversation to Graphiti
export const addConversationToGraph = async (
  messages: { role: string; content: string }[],
  sessionId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        session_id: sessionId
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      graphCache = null;
      lastFetchTime = 0;
      window.dispatchEvent(new Event('graphDataUpdated'));
    }
    
    return data;
  } catch (error) {
    console.error('Error adding conversation to graph:', error);
    return { success: false, error: String(error) };
  }
};

// Search the knowledge graph
export const searchGraph = async (
  query: string,
  limit: number = 10
): Promise<{ success: boolean; results: any[]; error?: string }> => {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/graph/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return await response.json();
  } catch (error) {
    console.error('Error searching graph:', error);
    return { success: false, results: [], error: String(error) };
  }
};

// Legacy function - now sends to Graphiti instead of doing local extraction
export const updateGraphFromConversation = async (
  conversation: { role: string; content: string }[]
): Promise<void> => {
  if (conversation.length === 0) return;
  
  // Format conversation as text for Graphiti to process
  const recentConversation = conversation.slice(-6).map(
    turn => `${turn.role.toUpperCase()}: ${turn.content}`
  ).join('\n');
  
  // Send to Graphiti for entity extraction
  const result = await addEpisodeToGraph(
    recentConversation,
    'alfie_voice_conversation',
    'message'
  );
  
  if (result.success) {
    console.log(`Knowledge graph updated: ${result.entities_count || 0} entities, ${result.edges_count || 0} relationships`);
  } else {
    console.error('Failed to update knowledge graph:', result.error);
  }
};

// Check if Graphiti service is available
export const checkGraphitiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/graph/health`);
    const data = await response.json();
    return data.status === 'healthy' && data.initialized === true;
  } catch {
    return false;
  }
};
