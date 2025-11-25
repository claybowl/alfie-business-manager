import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';

// Polyfill EventSource for Node.js environment
global.EventSource = EventSource;

const app = express();
const PORT = 3001;
const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';

// API Keys (loaded from environment variables)
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!LINEAR_API_KEY || !NOTION_API_KEY) {
  console.error('ERROR: Missing required API keys in environment variables');
  console.error('Set LINEAR_API_KEY and NOTION_API_KEY before starting the server');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

let mcpClient = null;

async function connectToPieces() {
  try {
    console.log('Connecting to Pieces MCP via SSE...');
    const transport = new SSEClientTransport(new URL(PIECES_SSE_URL));
    
    mcpClient = new Client(
      { 
        name: "alfie-client", 
        version: "1.0.0" 
      }, 
      { 
        capabilities: {
            prompts: {},
            resources: {},
            tools: {}
        } 
      }
    );

    await mcpClient.connect(transport);
    console.log('✓ Connected to Pieces OS MCP server');
    
    // List tools to see what we have
    const tools = await mcpClient.listTools();
    console.log('Available tools:', tools.tools.map(t => t.name));
    
    return true;
  } catch (error) {
    console.error('Failed to connect to Pieces MCP:', error);
    return false;
  }
}

// Initialize connection
connectToPieces();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    mcp_connected: !!mcpClient
  });
});

app.get('/api/pieces/tools', async (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({ error: 'MCP client not connected' });
  }
  try {
    const result = await mcpClient.listTools();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic tool call endpoint
app.post('/api/pieces/call-tool', async (req, res) => {
    if (!mcpClient) {
        return res.status(503).json({ error: 'MCP client not connected' });
    }
    
    const { name, args } = req.body;
    
    try {
        const result = await mcpClient.callTool({
            name,
            arguments: args || {}
        });
        res.json(result);
    } catch (error) {
        console.error(`Error calling tool ${name}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Maintain the existing activity endpoint for compatibility, 
// but map it to MCP tools if possible
app.get('/api/pieces/activity', async (req, res) => {
    if (!mcpClient) {
        // Fallback to empty if not connected
        return res.json({ total: 0, byLanguage: {}, activities: [] });
    }

    try {
        // We'll try to use 'query_pieces_ltm' or similar if available. 
        // For now, let's check if there's a specific tool for recent activity.
        // If not, we might need to prompt the user (Alfie) to use the generic tool.
        
        // But for this specific endpoint which the UI expects, let's try to use 
        // the 'ask_pieces_ltm' tool to get a summary of recent work?
        // Or just return empty for now and let the chat interface do the heavy lifting.
        
        // A better approach for the Briefing View might be to ask for "Recent coding activity summary"
        // via the LTM tool.
        
        const result = await mcpClient.callTool({
            name: "ask_pieces_ltm",
            arguments: {
                question: "What are the most recent coding activities, snippets, or workstream events I worked on? Please provide a concise summary.",
                chat_llm: "gemini-2.0-flash-exp",
                connected_client: "Alfie"
            }
        });

        // Extract text content from tool result
        const content = result.content && result.content[0] && result.content[0].text 
            ? result.content[0].text 
            : "No content returned from Pieces LTM.";

        // If content contains "Failed to extract context", return 0 activity
        const hasContent = content && !content.includes("Failed to extract context");
        
        res.json({ 
            total: hasContent ? 1 : 0, 
            byLanguage: hasContent ? { "Pieces LTM": 1 } : {}, 
            activities: hasContent ? [{
                name: "Pieces Workstream Summary",
                language: "Context",
                summary: content
            }] : [], 
            message: hasContent ? "Successfully retrieved context" : "No recent context found" 
        });

    } catch (error) {
        console.error('Error fetching activity via MCP:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// LINEAR API ENDPOINTS
// ============================================================================

app.get('/api/linear/issues', async (req, res) => {
    try {
        const response = await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': LINEAR_API_KEY
            },
            body: JSON.stringify({
                query: `
                    query {
                        issues(first: 25, orderBy: updatedAt) {
                            nodes {
                                id
                                identifier
                                title
                                description
                                priority
                                state {
                                    name
                                    type
                                }
                                dueDate
                                labels {
                                    nodes {
                                        name
                                        color
                                    }
                                }
                                assignee {
                                    name
                                }
                                project {
                                    name
                                }
                                createdAt
                                updatedAt
                            }
                        }
                    }
                `
            })
        });

        const data = await response.json();
        
        if (data.errors) {
            console.error('Linear API errors:', data.errors);
            return res.status(400).json({ error: data.errors[0]?.message || 'Linear API error' });
        }

        const issues = data.data?.issues?.nodes || [];
        res.json({ 
            total: issues.length,
            issues: issues.map(issue => ({
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                description: issue.description?.substring(0, 200) || '',
                priority: issue.priority,
                status: issue.state?.name || 'Unknown',
                statusType: issue.state?.type || 'unknown',
                dueDate: issue.dueDate,
                labels: issue.labels?.nodes?.map(l => ({ name: l.name, color: l.color })) || [],
                assignee: issue.assignee?.name,
                project: issue.project?.name,
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt
            }))
        });
    } catch (error) {
        console.error('Error fetching Linear issues:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/linear/me', async (req, res) => {
    try {
        const response = await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': LINEAR_API_KEY
            },
            body: JSON.stringify({
                query: `
                    query {
                        viewer {
                            id
                            name
                            email
                            organization {
                                name
                            }
                        }
                    }
                `
            })
        });

        const data = await response.json();
        res.json(data.data?.viewer || {});
    } catch (error) {
        console.error('Error fetching Linear user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// NOTION API ENDPOINTS
// ============================================================================

app.get('/api/notion/search', async (req, res) => {
    try {
        const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: 20,
                sort: {
                    direction: 'descending',
                    timestamp: 'last_edited_time'
                }
            })
        });

        const data = await response.json();
        
        if (data.object === 'error') {
            console.error('Notion API error:', data);
            return res.status(400).json({ error: data.message });
        }

        const results = data.results || [];
        res.json({
            total: results.length,
            pages: results.map(page => ({
                id: page.id,
                type: page.object,
                title: extractNotionTitle(page),
                url: page.url,
                lastEdited: page.last_edited_time,
                created: page.created_time,
                icon: page.icon?.emoji || page.icon?.external?.url || null,
                parent: page.parent?.type || 'workspace'
            }))
        });
    } catch (error) {
        console.error('Error searching Notion:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/notion/databases', async (req, res) => {
    try {
        const response = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                filter: {
                    property: 'object',
                    value: 'database'
                },
                page_size: 20
            })
        });

        const data = await response.json();
        
        if (data.object === 'error') {
            return res.status(400).json({ error: data.message });
        }

        const databases = data.results || [];
        res.json({
            total: databases.length,
            databases: databases.map(db => ({
                id: db.id,
                title: db.title?.[0]?.plain_text || 'Untitled Database',
                url: db.url,
                lastEdited: db.last_edited_time,
                icon: db.icon?.emoji || null
            }))
        });
    } catch (error) {
        console.error('Error fetching Notion databases:', error);
        res.status(500).json({ error: error.message });
    }
});

// Query a specific Notion database for tasks
app.get('/api/notion/database/:id/query', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: 50
            })
        });

        const data = await response.json();
        
        if (data.object === 'error') {
            return res.status(400).json({ error: data.message });
        }

        res.json({
            total: data.results?.length || 0,
            items: data.results?.map(item => ({
                id: item.id,
                properties: item.properties,
                url: item.url,
                lastEdited: item.last_edited_time
            })) || []
        });
    } catch (error) {
        console.error('Error querying Notion database:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to extract title from Notion page
function extractNotionTitle(page) {
    // Try different title property locations
    if (page.properties?.title?.title?.[0]?.plain_text) {
        return page.properties.title.title[0].plain_text;
    }
    if (page.properties?.Name?.title?.[0]?.plain_text) {
        return page.properties.Name.title[0].plain_text;
    }
    // For databases
    if (page.title?.[0]?.plain_text) {
        return page.title[0].plain_text;
    }
    // Check all properties for a title type
    for (const [key, value] of Object.entries(page.properties || {})) {
        if (value?.type === 'title' && value?.title?.[0]?.plain_text) {
            return value.title[0].plain_text;
        }
    }
    return 'Untitled';
}

// ============================================================================
// COMBINED BRIEFING ENDPOINT
// ============================================================================

app.get('/api/briefing/full', async (req, res) => {
    const results = {
        pieces: null,
        linear: null,
        notion: null,
        errors: []
    };

    // Fetch all data sources in parallel
    const [piecesResult, linearResult, notionResult] = await Promise.allSettled([
        // Pieces
        (async () => {
            if (!mcpClient) return { total: 0, activities: [] };
            const result = await mcpClient.callTool({
                name: "ask_pieces_ltm",
                arguments: {
                    question: "What are the most recent coding activities, snippets, or workstream events I worked on? Please provide a concise summary.",
                    chat_llm: "gemini-2.0-flash-exp",
                    connected_client: "Alfie"
                }
            });
            const content = result.content?.[0]?.text || "";
            const hasContent = content && !content.includes("Failed to extract context");
            return {
                total: hasContent ? 1 : 0,
                activities: hasContent ? [{ name: "Pieces Workstream Summary", summary: content }] : [],
                message: hasContent ? "Successfully retrieved context" : "No recent context found"
            };
        })(),
        // Linear
        (async () => {
            const response = await fetch('https://api.linear.app/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': LINEAR_API_KEY
                },
                body: JSON.stringify({
                    query: `
                        query {
                            issues(first: 10, orderBy: updatedAt) {
                                nodes {
                                    id
                                    identifier
                                    title
                                    priority
                                    state { name type }
                                    dueDate
                                    project { name }
                                }
                            }
                        }
                    `
                })
            });
            const data = await response.json();
            const issues = data.data?.issues?.nodes || [];
            return {
                total: issues.length,
                issues: issues.map(issue => ({
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    priority: issue.priority,
                    status: issue.state?.name || 'Unknown',
                    statusType: issue.state?.type || 'unknown',
                    dueDate: issue.dueDate,
                    project: issue.project?.name
                }))
            };
        })(),
        // Notion
        (async () => {
            const response = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NOTION_API_KEY}`,
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    page_size: 10,
                    sort: { direction: 'descending', timestamp: 'last_edited_time' }
                })
            });
            const data = await response.json();
            return {
                total: data.results?.length || 0,
                pages: data.results?.map(p => ({
                    id: p.id,
                    title: extractNotionTitle(p),
                    lastEdited: p.last_edited_time,
                    type: p.object
                })) || []
            };
        })()
    ]);

    // Process results
    if (piecesResult.status === 'fulfilled') {
        results.pieces = piecesResult.value;
    } else {
        results.errors.push({ source: 'pieces', error: piecesResult.reason?.message });
    }

    if (linearResult.status === 'fulfilled') {
        results.linear = linearResult.value;
    } else {
        results.errors.push({ source: 'linear', error: linearResult.reason?.message });
    }

    if (notionResult.status === 'fulfilled') {
        results.notion = notionResult.value;
    } else {
        results.errors.push({ source: 'notion', error: notionResult.reason?.message });
    }

    res.json(results);
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('Data sources:');
  console.log('  - Pieces MCP: Connecting...');
  console.log('  - Linear API: Configured');
  console.log('  - Notion API: Configured');
});

