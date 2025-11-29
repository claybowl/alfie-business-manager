import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import EventSource from 'eventsource';

// Polyfill EventSource for Node.js environment
global.EventSource = EventSource;

const app = express();
const PORT = process.env.PORT || 3002;
const PIECES_SSE_URL = 'http://localhost:39300/model_context_protocol/2024-11-05/sse';

// API Keys (loaded from environment variables)
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;

// Graphiti Service URL (Python microservice for temporal knowledge graph)
const GRAPHITI_SERVICE_URL = process.env.GRAPHITI_SERVICE_URL || 'http://localhost:8000';

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
// NOTION CONTENT RETRIEVAL - Fetch actual page content
// ============================================================================

// Convert a single Notion block to plain text
function blockToText(block) {
    const type = block.type;
    const content = block[type];
    
    if (!content) return '';
    
    // Extract rich text from various block types
    let text = '';
    
    switch (type) {
        case 'paragraph':
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
        case 'bulleted_list_item':
        case 'numbered_list_item':
        case 'quote':
        case 'callout':
        case 'toggle':
            text = content.rich_text?.map(rt => rt.plain_text).join('') || '';
            // Add appropriate prefixes for structure
            if (type === 'heading_1') text = `# ${text}`;
            else if (type === 'heading_2') text = `## ${text}`;
            else if (type === 'heading_3') text = `### ${text}`;
            else if (type === 'bulleted_list_item') text = `• ${text}`;
            else if (type === 'numbered_list_item') text = `- ${text}`;
            else if (type === 'quote') text = `> ${text}`;
            break;
            
        case 'to_do':
            const checked = content.checked ? '☑' : '☐';
            text = `${checked} ${content.rich_text?.map(rt => rt.plain_text).join('') || ''}`;
            break;
            
        case 'code':
            const code = content.rich_text?.map(rt => rt.plain_text).join('') || '';
            const lang = content.language || '';
            text = `\`\`\`${lang}\n${code}\n\`\`\``;
            break;
            
        case 'divider':
            text = '---';
            break;
            
        case 'table_row':
            text = content.cells?.map(cell => 
                cell.map(rt => rt.plain_text).join('')
            ).join(' | ') || '';
            break;
            
        case 'child_page':
            text = `[Subpage: ${content.title || 'Untitled'}]`;
            break;
            
        case 'child_database':
            text = `[Database: ${content.title || 'Untitled'}]`;
            break;
            
        case 'bookmark':
        case 'embed':
        case 'link_preview':
            text = `[Link: ${content.url || ''}]`;
            break;
            
        case 'image':
        case 'video':
        case 'file':
        case 'pdf':
            const caption = content.caption?.map(rt => rt.plain_text).join('') || '';
            text = `[${type}: ${caption || 'No caption'}]`;
            break;
            
        default:
            // For unknown types, try to extract any rich_text
            if (content.rich_text) {
                text = content.rich_text.map(rt => rt.plain_text).join('');
            }
    }
    
    return text;
}

// Fetch all blocks from a Notion page (handles pagination)
async function fetchNotionPageBlocks(pageId, maxBlocks = 100) {
    const blocks = [];
    let cursor = undefined;
    
    while (blocks.length < maxBlocks) {
        const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
        if (cursor) url.searchParams.set('start_cursor', cursor);
        url.searchParams.set('page_size', '100');
        
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        });
        
        const data = await response.json();
        
        if (data.object === 'error') {
            console.error(`Error fetching blocks for page ${pageId}:`, data.message);
            break;
        }
        
        blocks.push(...(data.results || []));
        
        if (!data.has_more || !data.next_cursor) break;
        cursor = data.next_cursor;
    }
    
    return blocks.slice(0, maxBlocks);
}

// Convert all blocks to readable text content
function blocksToText(blocks) {
    return blocks
        .map(block => blockToText(block))
        .filter(text => text.trim().length > 0)
        .join('\n');
}

// Fetch page content with a character limit
async function fetchNotionPageContent(pageId, maxChars = 4000) {
    try {
        const blocks = await fetchNotionPageBlocks(pageId, 50); // Limit blocks per page
        const content = blocksToText(blocks);
        
        // Truncate if too long
        if (content.length > maxChars) {
            return content.substring(0, maxChars) + '\n... [content truncated]';
        }
        
        return content;
    } catch (error) {
        console.error(`Error fetching content for page ${pageId}:`, error.message);
        return null;
    }
}

// New endpoint: Get a single page's full content
app.get('/api/notion/page/:id/content', async (req, res) => {
    try {
        const { id } = req.params;
        const maxChars = parseInt(req.query.maxChars) || 8000;
        
        // First get the page metadata
        const pageResponse = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        });
        
        const pageData = await pageResponse.json();
        
        if (pageData.object === 'error') {
            return res.status(400).json({ error: pageData.message });
        }
        
        // Fetch the content
        const content = await fetchNotionPageContent(id, maxChars);
        
        res.json({
            id: pageData.id,
            title: extractNotionTitle(pageData),
            lastEdited: pageData.last_edited_time,
            url: pageData.url,
            content: content || 'No content available'
        });
    } catch (error) {
        console.error('Error fetching Notion page content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fetch content for multiple pages in parallel (with rate limiting)
async function fetchMultiplePagesContent(pages, maxPagesWithContent = 15, maxCharsPerPage = 3000) {
    // Only fetch content for pages (not databases) - prioritize most recently edited
    const pagesToFetch = pages
        .filter(p => p.object === 'page')
        .slice(0, maxPagesWithContent);
    
    const results = await Promise.allSettled(
        pagesToFetch.map(async (page) => {
            const content = await fetchNotionPageContent(page.id, maxCharsPerPage);
            return {
                id: page.id,
                title: extractNotionTitle(page),
                lastEdited: page.last_edited_time,
                type: page.object,
                url: page.url,
                content: content || ''
            };
        })
    );
    
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
}

// ============================================================================
// PIECES WORKSTREAM SUMMARIES - MULTI-DAY CONTEXT
// ============================================================================

// In-memory storage for rolling context (persists across requests but not server restarts)
// In production, this should be stored in a database or file system
let workstreamContextStore = {
    summaries: [], // Array of { date: string, dayLabel: string, summary: string, fetchedAt: string }
    lastFullFetch: null,
    maxDays: 5 // Rolling window - keep last 5 days
};

// Generate date labels for querying
function getDateLabels(daysBack = 7) {
    const labels = [];
    const now = new Date();
    
    for (let i = 0; i < daysBack; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = date.toISOString().split('T')[0];
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        let label;
        if (i === 0) label = 'today';
        else if (i === 1) label = 'yesterday';
        else label = `${dayName} (${monthDay})`;
        
        labels.push({ 
            dayIndex: i,
            dateStr, 
            label,
            queryLabel: i === 0 ? 'today' : i === 1 ? 'yesterday' : `on ${dayName}, ${monthDay}`
        });
    }
    return labels;
}

// Parse Pieces LTM JSON response to extract rich structured data
function parsePiecesLTMResponse(response) {
    try {
        const content = response.content?.[0]?.text || "";
        if (!content) return null;
        
        // Try to parse as JSON first
        if (content.startsWith('{') || content.startsWith('[')) {
            const data = JSON.parse(content);
            
            // Extract rich details from summaries and events
            const enrichedData = [];
            
            // Process summaries array
            if (data.summaries && Array.isArray(data.summaries)) {
                data.summaries.forEach(summary => {
                    if (summary.combined_string) {
                        enrichedData.push({
                            type: 'summary',
                            created: summary.created,
                            app: summary.app_title,
                            window: summary.window_title,
                            url: summary.browser_url,
                            score: summary.score,
                            content: summary.combined_string // This has the rich detail!
                        });
                    }
                });
            }
            
            // Process events array
            if (data.events && Array.isArray(data.events)) {
                data.events.forEach(event => {
                    if (event.combined_string) {
                        enrichedData.push({
                            type: 'event',
                            created: event.created,
                            app: event.app_title,
                            window: event.window_title,
                            url: event.browser_url,
                            score: event.score,
                            content: event.combined_string // This has the rich detail!
                        });
                    }
                });
            }
            
            // Sort by score (highest first) and return
            return enrichedData.length > 0 
                ? enrichedData.sort((a, b) => (b.score || 0) - (a.score || 0))
                : [{ text: content }];
        }
        
        // Fallback: return as text
        return [{ text: content }];
    } catch (e) {
        // If parsing fails, return the raw text
        const content = response.content?.[0]?.text || "";
        return content ? [{ text: content }] : null;
    }
}

// Fetch comprehensive workstream data for a specific day - RAW DATA EXTRACTION
async function fetchDaySummary(dayInfo) {
    if (!mcpClient) return null;
    
    try {
        const timeframe = dayInfo.dayIndex === 0 ? "today" : dayInfo.queryLabel;
        
        // Request RAW activity data in JSON format - this is the key!
        const result = await mcpClient.callTool({
            name: "ask_pieces_ltm",
            arguments: {
                question: `Give me the complete raw activity log for ${timeframe} in JSON format. Include all summaries, events, applications, files opened, code edits, conversations, and timestamps. Return the full JSON structure with all details.`,
                topics: ["development", "coding", "files", "projects", "work"],
                application_sources: ["Cursor", "Cursor.exe"],
                chat_llm: "gemini-2.0-flash-exp",
                connected_client: "Alfie"
            }
        });
        
        // Parse the raw JSON response
        const rawData = parsePiecesLTMResponse(result);
        
        if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
            console.log(`No significant activity for ${dayInfo.label}`);
            return null;
        }
        
        // Organize data by type
        const summaries = Array.isArray(rawData) ? rawData.filter(item => item.type === 'summary') : [];
        const events = Array.isArray(rawData) ? rawData.filter(item => item.type === 'event') : [];
        const allActivities = Array.isArray(rawData) ? rawData : [rawData];
        
        // Build comprehensive summary with rich context
        const summary = {
            date: dayInfo.dateStr,
            dayLabel: dayInfo.label,
            dayIndex: dayInfo.dayIndex,
            fetchedAt: new Date().toISOString(),
            
            // Store ALL the rich data
            coreTasks: summaries.slice(0, 10), // Top 10 summaries by score
            keyDecisions: summaries.slice(0, 10),
            documentsReviewed: events.slice(0, 15), // Top 15 events by score
            nextSteps: allActivities.slice(0, 5),
            
            // Rich text summary with ALL details
            summary: formatComprehensiveSummary(summaries, events)
        };
        
        return summary;
    } catch (error) {
        console.error(`Error fetching summary for ${dayInfo.label}:`, error.message);
        return null;
    }
}

// Format comprehensive summary with all rich details
function formatComprehensiveSummary(summaries, events) {
    const parts = [];
    
    if (summaries.length > 0) {
        parts.push("## 📋 DETAILED WORKSTREAM SUMMARIES\n");
        summaries.forEach((s, i) => {
            if (s.content) {
                parts.push(`### Activity ${i + 1}${s.app ? ` - ${s.app}` : ''}\n${s.content}\n`);
            }
        });
    }
    
    if (events.length > 0) {
        parts.push("\n## 🎯 ACTIVITY EVENTS\n");
        events.slice(0, 10).forEach((e, i) => {
            if (e.content) {
                parts.push(`### Event ${i + 1}${e.window ? ` - ${e.window}` : ''}\n${e.content}\n`);
            }
        });
    }
    
    return parts.length > 0 ? parts.join("\n") : "No significant activity recorded.";
}

// Legacy function kept for backward compatibility (not actively used)
function buildTextSummary(data) {
    return "Using new comprehensive summary format.";
}

// Format Pieces data for display (extracts rich contextual information)
function formatPiecesData(piecesData) {
    if (!piecesData || !Array.isArray(piecesData)) return "No data available.";
    
    return piecesData.map((item, index) => {
        // New rich format with app/window context
        if (item.content && item.type) {
            const header = [];
            if (item.app) header.push(`App: ${item.app}`);
            if (item.window) header.push(`Window: ${item.window}`);
            if (item.created) header.push(`Time: ${item.created}`);
            
            return (header.length > 0 ? `[${header.join(' | ')}]\n` : '') + item.content;
        }
        
        // Legacy formats
        if (item.text) return item.text;
        if (item.summary) return item.summary;
        if (item.combined_string) return item.combined_string;
        
        return JSON.stringify(item, null, 2);
    }).join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
}

// Clean up old summaries beyond the rolling window
function cleanupOldSummaries() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - workstreamContextStore.maxDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    workstreamContextStore.summaries = workstreamContextStore.summaries.filter(
        s => s.date >= cutoffStr
    );
}

// Endpoint to fetch multi-day workstream summaries
app.get('/api/pieces/workstream-summaries', async (req, res) => {
    if (!mcpClient) {
        return res.json({ 
            total: 0, 
            summaries: [], 
            message: 'Pieces MCP not connected' 
        });
    }

    const forceRefresh = req.query.refresh === 'true';
    const daysToFetch = parseInt(req.query.days) || 7;
    
    // Check if we have recent data (within last 30 minutes) and not forcing refresh
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (!forceRefresh && workstreamContextStore.lastFullFetch > thirtyMinutesAgo) {
        cleanupOldSummaries();
        return res.json({
            total: workstreamContextStore.summaries.length,
            summaries: workstreamContextStore.summaries,
            cached: true,
            lastFetch: workstreamContextStore.lastFullFetch
        });
    }

    try {
        console.log(`Fetching workstream summaries for ${daysToFetch} days...`);
        const dateLabels = getDateLabels(daysToFetch);
        
        // Fetch summaries in parallel (but limit concurrency to avoid overwhelming the API)
        const results = await Promise.allSettled(
            dateLabels.map(dayInfo => fetchDaySummary(dayInfo))
        );
        
        // Process results
        const newSummaries = results
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value)
            .sort((a, b) => a.dayIndex - b.dayIndex); // Sort by most recent first
        
        // Merge with existing summaries, preferring newer fetches
        const existingSummaries = workstreamContextStore.summaries.filter(
            existing => !newSummaries.some(ns => ns.date === existing.date)
        );
        
        workstreamContextStore.summaries = [...newSummaries, ...existingSummaries]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, workstreamContextStore.maxDays); // Keep only maxDays
        
        workstreamContextStore.lastFullFetch = new Date().toISOString();
        
        console.log(`Retrieved ${newSummaries.length} summaries, total stored: ${workstreamContextStore.summaries.length}`);
        
        res.json({
            total: workstreamContextStore.summaries.length,
            summaries: workstreamContextStore.summaries,
            cached: false,
            lastFetch: workstreamContextStore.lastFullFetch
        });
    } catch (error) {
        console.error('Error fetching workstream summaries:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        // Pieces - now fetch multi-day summaries
        (async () => {
            if (!mcpClient) return { total: 0, summaries: [], activities: [] };
            
            // First, trigger/get the multi-day summaries
            const forceRefresh = false;
            const daysToFetch = 7;
            
            // Check cache first
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            if (!forceRefresh && workstreamContextStore.lastFullFetch > thirtyMinutesAgo && workstreamContextStore.summaries.length > 0) {
                cleanupOldSummaries();
                return {
                    total: workstreamContextStore.summaries.length,
                    summaries: workstreamContextStore.summaries,
                    activities: workstreamContextStore.summaries.map(s => ({
                        name: `Workstream: ${s.dayLabel}`,
                        summary: s.summary,
                        date: s.date,
                        dayLabel: s.dayLabel
                    })),
                    message: 'Retrieved from cache'
                };
            }
            
            // Fetch fresh summaries
            const dateLabels = getDateLabels(daysToFetch);
            const fetchResults = await Promise.allSettled(
                dateLabels.map(dayInfo => fetchDaySummary(dayInfo))
            );
            
            const newSummaries = fetchResults
                .filter(r => r.status === 'fulfilled' && r.value !== null)
                .map(r => r.value)
                .sort((a, b) => a.dayIndex - b.dayIndex);
            
            // Update store
            const existingSummaries = workstreamContextStore.summaries.filter(
                existing => !newSummaries.some(ns => ns.date === existing.date)
            );
            
            workstreamContextStore.summaries = [...newSummaries, ...existingSummaries]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, workstreamContextStore.maxDays);
            
            workstreamContextStore.lastFullFetch = new Date().toISOString();
            
            return {
                total: workstreamContextStore.summaries.length,
                summaries: workstreamContextStore.summaries,
                activities: workstreamContextStore.summaries.map(s => ({
                    name: `Workstream: ${s.dayLabel}`,
                    summary: s.summary,
                    date: s.date,
                    dayLabel: s.dayLabel
                })),
                message: `Retrieved ${newSummaries.length} new summaries`
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
        // Notion - Now fetches actual page CONTENT, not just titles!
        (async () => {
            // Step 1: Search for recent pages (increased limit)
            const response = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${NOTION_API_KEY}`,
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify({
                    page_size: 25, // Increased from 10
                    sort: { direction: 'descending', timestamp: 'last_edited_time' }
                })
            });
            const data = await response.json();
            
            if (data.object === 'error') {
                console.error('Notion search error:', data.message);
                return { total: 0, pages: [] };
            }
            
            const rawPages = data.results || [];
            
            // Step 2: Fetch actual content for pages (not databases)
            // Limit to 15 pages with content to avoid rate limits
            const pagesWithContent = await fetchMultiplePagesContent(rawPages, 15, 3000);
            
            // Step 3: Include databases as metadata only
            const databases = rawPages
                .filter(p => p.object === 'database')
                .map(db => ({
                    id: db.id,
                    title: extractNotionTitle(db),
                    lastEdited: db.last_edited_time,
                    type: 'database',
                    content: '' // Databases don't have block content
                }));
            
            return {
                total: pagesWithContent.length + databases.length,
                pages: [...pagesWithContent, ...databases],
                pagesWithContent: pagesWithContent.length,
                contentFetched: true
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

// ============================================================================
// GRAPHITI TEMPORAL KNOWLEDGE GRAPH ENDPOINTS
// ============================================================================

// Health check for Graphiti service
app.get('/api/graph/health', async (req, res) => {
    try {
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/health`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(503).json({ 
            status: 'unavailable', 
            error: error.message,
            graphiti_url: GRAPHITI_SERVICE_URL 
        });
    }
});

// Add episode to knowledge graph (conversations, events, etc.)
app.post('/api/graph/episode', async (req, res) => {
    try {
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/episodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti episode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add full conversation to knowledge graph
app.post('/api/graph/conversation', async (req, res) => {
    try {
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti conversation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search the knowledge graph
app.get('/api/graph/search', async (req, res) => {
    try {
        const query = req.query.query || '';
        const limit = req.query.limit || 10;
        const response = await fetch(
            `${GRAPHITI_SERVICE_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti search error:', error);
        res.status(500).json({ success: false, error: error.message, results: [] });
    }
});

// Get full graph data for visualization
app.get('/api/graph/data', async (req, res) => {
    try {
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/graph`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti graph data error:', error);
        res.status(500).json({ success: false, error: error.message, nodes: [], links: [] });
    }
});

// Get all nodes
app.get('/api/graph/nodes', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/nodes?limit=${limit}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti nodes error:', error);
        res.status(500).json({ success: false, error: error.message, nodes: [] });
    }
});

// Get all edges
app.get('/api/graph/edges', async (req, res) => {
    try {
        const limit = req.query.limit || 200;
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/edges?limit=${limit}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti edges error:', error);
        res.status(500).json({ success: false, error: error.message, edges: [] });
    }
});

// Clear the knowledge graph (dangerous!)
app.delete('/api/graph/clear', async (req, res) => {
    try {
        const response = await fetch(`${GRAPHITI_SERVICE_URL}/graph`, {
            method: 'DELETE'
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Graphiti clear error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('Data sources:');
  console.log('  - Pieces MCP: Connecting...');
  console.log('  - Linear API: Configured');
  console.log('  - Notion API: Configured');
  console.log(`  - Graphiti KG: ${GRAPHITI_SERVICE_URL}`);
});

