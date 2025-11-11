
import { GoogleGenAI, Type } from '@google/genai';
import { getApiProvider, getGeminiApiKey, getOpenRouterApiKey } from './apiKey';

// Define the structure of our graph data
export interface Node {
  id: string;
  group: string;
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
}

export interface KnowledgeGraphData {
  nodes: Node[];
  links: Link[];
}

const STORAGE_KEY = 'alfie-knowledge-graph';

// Function to get the graph from localStorage
export const getGraph = (): KnowledgeGraphData => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const graph = JSON.parse(storedData);
      // The force graph will use fx/fy for fixed positions and x/y for initial positions if they exist.
      return graph;
    }
  } catch (error) {
    console.error("Error reading knowledge graph from localStorage:", error);
  }
  return { nodes: [], links: [] };
};

// Function to save the graph to localStorage
const saveGraph = (graph: KnowledgeGraphData) => {
  try {
    // Sanitize node positions before saving to prevent corruption from invalid physics values (e.g., Infinity)
    graph.nodes.forEach(node => {
        if (node.x !== undefined && !isFinite(node.x)) delete node.x;
        if (node.y !== undefined && !isFinite(node.y)) delete node.y;
        if (node.fx !== undefined && !isFinite(node.fx)) delete node.fx;
        if (node.fy !== undefined && !isFinite(node.fy)) delete node.fy;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
    window.dispatchEvent(new Event('storage')); // Notify other components of change
  } catch (error) {
    console.error("Error saving knowledge graph to localStorage:", error);
  }
};

// Saves only the positions of nodes, to persist the visual layout
export const saveNodePositions = (layoutNodes: Node[]) => {
    const graph = getGraph();
    const positionMap = new Map(layoutNodes.map(n => [n.id, { x: n.x, y: n.y }]));

    graph.nodes.forEach(node => {
        const pos = positionMap.get(node.id);
        if (pos) {
            // Persist the current visual position.
            node.x = pos.x;
            node.y = pos.y;
        }
    });

    saveGraph(graph);
};


// Function to clear the graph
export const clearGraph = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event('storage'));
    } catch (error) {
        console.error("Error clearing knowledge graph:", error);
    }
}

const getExtractionPrompt = (currentGraph: KnowledgeGraphData, recentConversation: string) => {
    return `Analyze the following conversation excerpt and extract key entities and their relationships.
  
    Entities should be nouns (people, places, concepts). Classify them into groups like 'person', 'place', 'organization', 'concept', 'object', or 'event'.
    Relationships should be concise verbs or short phrases describing how entities are connected.
  
    Existing Knowledge Graph:
    ${JSON.stringify(currentGraph)}
  
    Recent Conversation:
    """
    ${recentConversation}
    """
  
    Based on the "Recent Conversation" and considering the "Existing Knowledge Graph" to avoid duplicates, identify *new* entities and relationships.
    Return ONLY a valid JSON object with 'nodes' and 'links' arrays containing ONLY the new items. If no new nodes or links are found, you can omit the corresponding key.
    `;
}

const processApiResponse = (responseText: string, currentGraph: KnowledgeGraphData) => {
    const cleanResponse = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const newGraphData = JSON.parse(cleanResponse) as Partial<KnowledgeGraphData>;

    if (newGraphData) {
        let graphWasUpdated = false;
        
        // Add new nodes first
        if (newGraphData.nodes?.length > 0) {
            const existingNodeIds = new Set(currentGraph.nodes.map(n => n.id.toLowerCase()));
            newGraphData.nodes.forEach(newNode => {
                if (!existingNodeIds.has(newNode.id.toLowerCase())) {
                    currentGraph.nodes.push(newNode);
                    existingNodeIds.add(newNode.id.toLowerCase());
                    graphWasUpdated = true;
                }
            });
        }

        // Then add new links, checking against the updated node list
        if (newGraphData.links?.length > 0) {
            const existingLinkSignatures = new Set(currentGraph.links.map(l => `${l.source.toLowerCase()}-${l.target.toLowerCase()}-${l.value.toLowerCase()}`));
            const allNodeIds = new Set(currentGraph.nodes.map(n => n.id.toLowerCase()));
            
            newGraphData.links.forEach(newLink => {
                const sourceExists = allNodeIds.has(newLink.source.toLowerCase());
                const targetExists = allNodeIds.has(newLink.target.toLowerCase());
                const signature = `${newLink.source.toLowerCase()}-${newLink.target.toLowerCase()}-${newLink.value.toLowerCase()}`;
                
                if (sourceExists && targetExists && !existingLinkSignatures.has(signature)) {
                    currentGraph.links.push(newLink);
                    existingLinkSignatures.add(signature);
                    graphWasUpdated = true;
                }
            });
        }
        
        if (graphWasUpdated) {
            saveGraph(currentGraph);
        }
    }
};

// Function to update the graph based on conversation history
export const updateGraphFromConversation = async (conversation: { role: string, content: string }[]): Promise<void> => {
  const apiProvider = getApiProvider();
  if (conversation.length === 0) return;

  const currentGraph = getGraph();
  const recentConversation = conversation.slice(-4).map(turn => `${turn.role}: ${turn.content}`).join('\n');
  const prompt = getExtractionPrompt(currentGraph, recentConversation);

  try {
    let responseText: string | null = null;

    if (apiProvider === 'gemini') {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return;
        
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING, description: "Name of the entity (e.g., 'Tommy Shelby')" },
                                    group: { type: Type.STRING, description: "Classification of the entity (e.g., 'person')" }
                                },
                                required: ['id', 'group']
                            }
                        },
                        links: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING, description: "Source entity 'id'" },
                                    target: { type: Type.STRING, description: "Target entity 'id'" },
                                    value: { type: Type.STRING, description: "Description of the relationship" }
                                },
                                required: ['source', 'target', 'value']
                            }
                        }
                    }
                }
            }
        });
        responseText = response.text;

    } else { // openrouter
        const apiKey = getOpenRouterApiKey();
        if (!apiKey) return;

        const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-flash-1.5",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
            })
        });

        if (!apiResponse.ok) {
            console.error("OpenRouter knowledge graph update error:", await apiResponse.text());
            return;
        }

        const data = await apiResponse.json();
        responseText = data.choices[0].message.content;
    }

    if (responseText) {
        processApiResponse(responseText, currentGraph);
    }

  } catch (error) {
    console.error("Failed to update knowledge graph:", error);
  }
};