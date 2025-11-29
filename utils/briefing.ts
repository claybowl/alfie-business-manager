/**
 * Business Briefing Module for Alfie
 * Intelligence Dossier - Fetches and synthesizes business data from Pieces, Notion, and Linear
 */

import { supabase, isSupabaseConfigured, logSyncOperation } from './supabase';
import { isBackendAvailable } from './networkStatus';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkstreamEvent {
  id: string;
  timestamp: string;
  readableTime: string;
  app: string;
  windowTitle: string;
  summary: string;
  score: number;
}

export interface WorkstreamSummary {
  id: string;
  created: string;
  readableTime: string;
  timeRange: string;
  content: string;
}

export interface ActiveProject {
  name: string;
  lastAccessed: string;
  app: string;
  activityCount: number;
}

export interface IntelligenceDossier {
  timestamp: string;
  systemStatus: string;
  
  // Active Projects (extracted from Pieces events)
  activeProjects: ActiveProject[];
  
  // Recent Decisions (extracted from summaries)
  recentDecisions: string[];
  
  // Context Timeline (workstream summaries)
  timeline: WorkstreamSummary[];
  
  // Raw events for detailed view
  events: WorkstreamEvent[];
  
  // User notes to Alfie
  userNotes: string;
  
  // Raw data for Alfie's context
  rawContext: string;
  
  // Linear issues (flat list, for backwards compatibility)
  linearIssues: LinearIssueData[];
  
  // Linear projects with nested issues
  linearProjects: LinearProjectData[];
  
  // Notion pages
  notionPages: NotionPage[];
  
  // Data source statuses
  dataSources: {
    pieces: boolean;
    linear: boolean;
    notion: boolean;
  };
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  dueDate?: string;
  labels?: string[];
}

export interface NotionTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  project?: string;
}

export interface NotionPage {
  id: string;
  title: string;
  lastEdited: string;
  type: string;
  content?: string; // Actual page content from Notion blocks
  url?: string;
}

export interface LinearIssueData {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  status: string;
  statusType: string;
  dueDate?: string;
  project?: string;
  assignee?: string;
}

export interface LinearProjectData {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  state: string;
  progress: number;
  startDate?: string;
  targetDate?: string;
  updatedAt: string;
  lead?: string;
  issues: LinearIssueData[];
}

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'alfie-intelligence-dossier';
const NOTES_STORAGE_KEY = 'alfie-user-notes';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (shorter for more real-time data)

// ============================================================================
// DATA FETCHING
// ============================================================================

interface WorkstreamDaySummary {
  date: string;
  dayLabel: string;
  dayIndex: number;
  summary: string;
  fetchedAt: string;
  // Enhanced structured data
  coreTasks?: any[];
  keyDecisions?: any[];
  documentsReviewed?: any[];
  nextSteps?: any[];
}

interface RawPiecesResponse {
  total: number;
  summaries?: WorkstreamDaySummary[];
  activities: Array<{
    name: string;
    summary?: string;
    date?: string;
    dayLabel?: string;
  }>;
  message?: string;
  cached?: boolean;
  lastFetch?: string;
}

interface FullBriefingResponse {
  pieces: RawPiecesResponse | null;
  linear: {
    total: number;
    issues: LinearIssueData[];
    projects?: LinearProjectData[];
  } | null;
  notion: {
    total: number;
    pages: NotionPage[];
    pagesWithContent?: number; // Number of pages that have actual content fetched
    contentFetched?: boolean;  // Whether content was retrieved (vs just metadata)
  } | null;
  errors: Array<{ source: string; error: string }>;
}

async function fetchFullBriefingData(): Promise<FullBriefingResponse> {
  try {
    const response = await fetch('http://localhost:3002/api/briefing/full');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch full briefing data:', error);
    return {
      pieces: null,
      linear: null,
      notion: null,
      errors: [{ source: 'backend', error: 'Failed to connect to backend server' }]
    };
  }
}

async function fetchRawPiecesData(): Promise<RawPiecesResponse> {
  try {
    const response = await fetch('http://localhost:3002/api/pieces/activity');
    if (!response.ok) {
      return { total: 0, activities: [] };
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Pieces data:', error);
    return { total: 0, activities: [] };
  }
}

function parsePiecesData(raw: RawPiecesResponse): {
  events: WorkstreamEvent[];
  summaries: WorkstreamSummary[];
  activeProjects: ActiveProject[];
  decisions: string[];
} {
  const events: WorkstreamEvent[] = [];
  const summaries: WorkstreamSummary[] = [];
  const activeProjects: Map<string, ActiveProject> = new Map();
  const decisions: string[] = [];

  try {
    // NEW: Handle multi-day summaries from the enhanced backend
    if (raw.summaries && Array.isArray(raw.summaries) && raw.summaries.length > 0) {
      console.log(`Parsing ${raw.summaries.length} day summaries from Pieces`);
      
      raw.summaries.forEach((daySummary, index) => {
        const content = daySummary.summary || '';
        
        summaries.push({
          id: `day-${daySummary.date}-${index}`,
          created: daySummary.fetchedAt || '',
          readableTime: daySummary.dayLabel || 'Recently',
          timeRange: daySummary.date || '',
          content: content.replace(/\\n/g, '\n').replace(/\\"/g, '"')
        });

        // Extract decisions and key info from this day's summary
        extractDecisionsFromContent(content, decisions);
        
        // Extract projects mentioned in the summary
        extractProjectsFromContent(content, activeProjects, daySummary.dayLabel);
      });
    }
    // LEGACY: Also handle old single-activity format for backwards compatibility
    else if (raw.activities && raw.activities.length > 0) {
      raw.activities.forEach((activity, actIndex) => {
        const content = activity.summary || '';
        const dayLabel = activity.dayLabel || 'Recently';
        const date = activity.date || new Date().toISOString().split('T')[0];
        
        // If summary looks like JSON (old format), try to parse it
        if (content.startsWith('{') || content.startsWith('[')) {
          try {
            const parsed = JSON.parse(content);
            
            // Parse old-style summaries
            if (parsed.summaries && Array.isArray(parsed.summaries)) {
              parsed.summaries.forEach((s: any, index: number) => {
                const combinedString = s.combined_string || '';
                const timeRangeMatch = combinedString.match(/Summarized time-range: ([^\n]+)/);
                const timeRange = timeRangeMatch ? timeRangeMatch[1] : 'Unknown';
                const contentStart = combinedString.indexOf('### **');
                const extractedContent = contentStart > -1 ? combinedString.substring(contentStart) : combinedString;

                summaries.push({
                  id: s.range?.id || `summary-${index}`,
                  created: s.created || '',
                  readableTime: s.range?.from?.readable || 'Recently',
                  timeRange,
                  content: extractedContent.replace(/\\n/g, '\n').replace(/\\"/g, '"')
                });
                
                extractDecisionsFromContent(extractedContent, decisions);
              });
            }

            // Parse old-style events
            if (parsed.events && Array.isArray(parsed.events)) {
              parsed.events.forEach((e: any, index: number) => {
                const event: WorkstreamEvent = {
                  id: `event-${index}`,
                  timestamp: e.created || '',
                  readableTime: extractReadableTime(e.combined_string) || 'Recently',
                  app: e.app_title || 'Unknown',
                  windowTitle: e.window_title || '',
                  summary: extractEventSummary(e.combined_string),
                  score: e.score || 0
                };
                events.push(event);
                extractProjectFromEvent(e, activeProjects, event);
              });
            }
          } catch {
            // Not JSON, treat as raw summary
            summaries.push({
              id: `activity-${actIndex}`,
              created: new Date().toISOString(),
              readableTime: dayLabel,
              timeRange: date,
              content: content
            });
            extractDecisionsFromContent(content, decisions);
          }
        } else {
          // Raw text summary (new format from multi-day fetch)
          summaries.push({
            id: `activity-${actIndex}`,
            created: new Date().toISOString(),
            readableTime: dayLabel,
            timeRange: date,
            content: content
          });
          extractDecisionsFromContent(content, decisions);
          extractProjectsFromContent(content, activeProjects, dayLabel);
        }
      });
    }
  } catch (e) {
    console.error('Failed to parse Pieces data:', e);
  }

  return {
    events: [], // NO EVENTS - user only wants workstream summaries
    summaries,
    activeProjects: Array.from(activeProjects.values()).sort((a, b) => b.activityCount - a.activityCount),
    decisions: decisions.slice(0, 15) // Increased from 10 to capture more context
  };
}

// Helper: Extract decisions from summary content
function extractDecisionsFromContent(content: string, decisions: string[]): void {
  // Try multiple patterns to find decisions/discussions
  const decisionPatterns = [
    /Key Discussions & Decisions\*?\*?\n([\s\S]*?)(?=###|\*\*[A-Z]|$)/i,
    /Key Discussions & Decisions\*?\*?([^#]+)/i,
    /Key Discussions[^*\n]*\n([\s\S]*?)(?=###|\n\n[A-Z]|$)/i,
    /Decisions[^*\n]*\n([^#]+)/i,
    /Important decisions[^*\n]*\n([^#]+)/i
  ];
  
  for (const pattern of decisionPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const lines = match[1].split('\n').filter((line: string) => {
        const trimmed = line.trim();
        return trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•');
      });
      lines.forEach((line: string) => {
        const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
        if (cleanLine && cleanLine.length > 10 && !decisions.includes(cleanLine)) {
          decisions.push(cleanLine);
        }
      });
      if (decisions.length > 0) return;
    }
  }
  
  // Fallback: extract from "Core Tasks & Projects"
  const tasksMatch = content.match(/Core Tasks & Projects\*?\*?\n([\s\S]*?)(?=###|\*\*[A-Z]|$)/i);
  if (tasksMatch && tasksMatch[1]) {
    const taskLines = tasksMatch[1].split('\n').filter((line: string) => {
      const trimmed = line.trim();
      return trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•');
    });
    taskLines.slice(0, 5).forEach((line: string) => {
      const cleanLine = line.replace(/^[-*•]\s*/, '').trim();
      if (cleanLine && cleanLine.length > 10 && !decisions.includes(cleanLine)) {
        decisions.push(cleanLine);
      }
    });
  }
}

// Helper: Extract projects from summary content (only real projects)
function extractProjectsFromContent(
  content: string,
  activeProjects: Map<string, ActiveProject>,
  dayLabel: string
): void {
  const foundProjects = new Set<string>();

  // Known project patterns that are definitely projects
  // Pattern 1: "working on/project/developing ProjectName" - explicit project mentions
  const explicitProjectPattern = /(?:working on|project:|developing|implementing|building)\s+(?:the\s+)?["']?([A-Z][a-zA-Z0-9_-]{2,30})["']?/g;
  let match;
  while ((match = explicitProjectPattern.exec(content)) !== null) {
    const projectName = match[1]?.trim();
    if (projectName && projectName.length >= 3 && projectName.length <= 40) {
      foundProjects.add(projectName);
    }
  }

  // Pattern 2: Bold project names (often markdown formatting for project names)
  const boldPattern = /\*\*([A-Z][a-zA-Z0-9_-]{2,30})\*\*(?:\s+(?:project|app|system|manager|dashboard))?/gi;
  while ((match = boldPattern.exec(content)) !== null) {
    const projectName = match[1]?.trim();
    // Only if it looks like a project (has keywords nearby or is compound)
    if (projectName && projectName.length >= 3 && projectName.length <= 40 && projectName.includes('-')) {
      foundProjects.add(projectName);
    }
  }

  // Pattern 3: Code/repo references (these are definitely projects)
  const repoPattern = /(?:repository|repo|codebase|github|gitlab)\s*[:\-]?\s*["']?([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)["']?/gi;
  let repoMatch;
  while ((repoMatch = repoPattern.exec(content)) !== null) {
    const repoName = repoMatch[1]?.trim();
    if (repoName && repoName.length >= 3 && repoName.length <= 40) {
      foundProjects.add(repoName);
    }
  }

  // Pattern 4: Known projects (curated list - common sense real projects)
  const knownProjects = [
    'Alfie', 'Alfie-Business-Manager', 'Alfie Business Manager',
    'Graphiti', 'Pieces', 'Neo4j', 'Linear', 'Notion',
    'React', 'Node', 'Python', 'TypeScript', 'Vite'
  ];

  const knownLowerSet = new Set(knownProjects.map(p => p.toLowerCase()));

  for (const project of knownProjects) {
    if (content.toLowerCase().includes(project.toLowerCase())) {
      foundProjects.add(project);
    }
  }

  // Add found projects, tracking activity count
  foundProjects.forEach(projectName => {
    // Skip null/undefined/empty project names
    if (!projectName || typeof projectName !== 'string') return;
    
    if (!activeProjects.has(projectName)) {
      activeProjects.set(projectName, {
        name: projectName,
        lastAccessed: dayLabel,
        app: 'Pieces Context',
        activityCount: 1
      });
    } else {
      const existing = activeProjects.get(projectName)!;
      existing.activityCount++;
    }
  });
}

// Helper: Extract project from event (legacy support)
function extractProjectFromEvent(
  e: any, 
  activeProjects: Map<string, ActiveProject>,
  event: WorkstreamEvent
): void {
  const projectMatch = e.window_title?.match(/([^-]+)\s*-\s*([^-]+)\s*-/);
  if (projectMatch) {
    const projectName = projectMatch[2]?.trim() || projectMatch[1]?.trim();
    // Skip null/undefined/empty project names
    if (!projectName || typeof projectName !== 'string' || projectName.length === 0) return;
    
    if (!activeProjects.has(projectName)) {
      activeProjects.set(projectName, {
        name: projectName,
        lastAccessed: event.readableTime,
        app: event.app.replace('.exe', ''),
        activityCount: 1
      });
    } else {
      const existing = activeProjects.get(projectName)!;
      existing.activityCount++;
    }
  }
}

function extractReadableTime(combinedString: string): string {
  const match = combinedString?.match(/Last accessed: ([^\n(]+)/);
  return match ? match[1].trim() : 'Recently';
}

function extractEventSummary(combinedString: string): string {
  const extractedMatch = combinedString?.match(/Extracted text: \[.*?\]\n?(.+)/s);
  if (extractedMatch) {
    return extractedMatch[1].substring(0, 200).trim() + '...';
  }
  return combinedString?.substring(0, 200) || 'No summary available';
}

// ============================================================================
// USER NOTES
// ============================================================================

export function getUserNotes(): string {
  try {
    return localStorage.getItem(NOTES_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export async function saveUserNotes(notes: string): Promise<void> {
  try {
    // Save to localStorage
    localStorage.setItem(NOTES_STORAGE_KEY, notes);

    // Also save to knowledge graph so Alfie can consider it in responses
    if (notes.trim().length > 0) {
      try {
        const response = await fetch('http://localhost:3002/api/graph/episode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `USER NOTES: ${notes}`,
            source: 'alfie_user_notes',
            episode_type: 'message'
          })
        });

        if (!response.ok) {
          console.warn('Failed to save notes to knowledge graph:', response.status);
        }
      } catch (error) {
        console.warn('Failed to sync notes to knowledge graph:', error);
        // Don't throw - local save already succeeded
      }
    }
  } catch (e) {
    console.error('Failed to save user notes:', e);
  }
}

// ============================================================================
// PROJECT ACTIVITY ENHANCEMENT
// ============================================================================

/**
 * Enhance project activity counts by looking for project mentions across Linear and Notion.
 * This creates a heatmap effect where heavily used projects across multiple sources get higher counts.
 */
function enhanceProjectActivityFromSources(
  activeProjects: Map<string, ActiveProject>,
  linearIssues: LinearIssueData[],
  notionPages: NotionPage[]
): void {
  // Known projects to look for
  const projectNames = Array.from(activeProjects.keys());

  // Scan Linear issues for project mentions
  linearIssues.forEach(issue => {
    projectNames.forEach(projectName => {
      // Skip null/undefined/empty project names
      if (!projectName || typeof projectName !== 'string') return;
      
      const projectLower = projectName.toLowerCase();
      const issueText = `${issue.title} ${issue.project || ''}`.toLowerCase();

      if (issueText.includes(projectLower)) {
        const project = activeProjects.get(projectName)!;
        project.activityCount += 2; // Weight Linear mentions as +2
      }
    });
  });

  // Scan Notion pages for project mentions
  notionPages.forEach(page => {
    projectNames.forEach(projectName => {
      // Skip null/undefined/empty project names
      if (!projectName || typeof projectName !== 'string') return;
      
      const projectLower = projectName.toLowerCase();
      const pageText = `${page.title} ${page.content || ''}`.toLowerCase();

      if (pageText.includes(projectLower)) {
        const project = activeProjects.get(projectName)!;
        project.activityCount += 1; // Weight Notion mentions as +1
      }
    });
  });
}

// ============================================================================
// DOSSIER GENERATION
// ============================================================================

export async function generateIntelligenceDossier(forceRefresh = false): Promise<IntelligenceDossier> {
  // Check cache first
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          // Always get fresh user notes
          data.userNotes = getUserNotes();
          return data;
        }
      }
    } catch (e) {
      console.error('Error reading cache:', e);
    }
  }

  // Fetch all data sources at once
  const fullData = await fetchFullBriefingData();
  
  // Parse Pieces data
  const rawPieces = fullData.pieces || { total: 0, activities: [], message: 'Not connected' };
  const { events, summaries, activeProjects, decisions } = parsePiecesData(rawPieces);

  // Extract Linear issues
  const linearIssues: LinearIssueData[] = fullData.linear?.issues || [];
  
  // Extract Linear projects with their issues
  const linearProjects: LinearProjectData[] = fullData.linear?.projects || [];

  // Extract Notion pages
  const notionPages: NotionPage[] = fullData.notion?.pages || [];

  // Boost project activity counts based on mentions across all sources (Linear, Notion, etc.)
  enhanceProjectActivityFromSources(activeProjects, linearIssues, notionPages);

  // Build raw context for Alfie (now includes all sources)
  const rawContext = buildRawContext(summaries, events, decisions, linearIssues, notionPages);

  // Build system status
  const statusParts: string[] = [];
  if (fullData.pieces) statusParts.push('Pieces ✓');
  else statusParts.push('Pieces ✗');
  if (fullData.linear) statusParts.push(`Linear (${linearIssues.length})`);
  else statusParts.push('Linear ✗');
  if (fullData.notion) statusParts.push(`Notion (${notionPages.length})`);
  else statusParts.push('Notion ✗');

  const dossier: IntelligenceDossier = {
    timestamp: new Date().toISOString(),
    systemStatus: statusParts.join(' • '),
    activeProjects,
    recentDecisions: decisions,
    timeline: summaries,
    events,
    userNotes: getUserNotes(),
    rawContext,
    linearIssues,
    linearProjects,
    notionPages,
    dataSources: {
      pieces: !!fullData.pieces,
      linear: !!fullData.linear,
      notion: !!fullData.notion
    }
  };

  // Cache it
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      data: dossier,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Failed to cache dossier:', e);
  }

  return dossier;
}

// Helper to format structured Pieces data
function formatStructuredPiecesData(data: any): string {
  if (!data || !Array.isArray(data)) return "No data available.\n";
  
  return data.map(item => {
    if (typeof item === 'string') return item;
    if (item.text) return item.text;
    if (item.summary) return item.summary;
    
    // If it's a complex object, try to extract meaningful information
    if (item.combined_string) return item.combined_string;
    
    // Last resort: stringify the object
    return JSON.stringify(item, null, 2);
  }).join("\n\n") + "\n";
}

function buildRawContext(
  summaries: WorkstreamSummary[], 
  events: WorkstreamEvent[], 
  decisions: string[],
  linearIssues: LinearIssueData[] = [],
  notionPages: NotionPage[] = []
): string {
  let context = '## INTELLIGENCE DOSSIER FOR ALFIE\n';
  context += `Generated: ${new Date().toLocaleString()}\n`;
  context += `Rolling Context Window: Last ${summaries.length} days of work activity\n\n`;

  // Linear Issues Section
  if (linearIssues.length > 0) {
    context += '### LINEAR ISSUES (Active Work Items)\n';
    linearIssues.forEach((issue, i) => {
      const priority = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || 'Unknown';
      context += `${i + 1}. [${issue.identifier}] ${issue.title} - ${issue.status} (${priority})\n`;
      if (issue.project) context += `   Project: ${issue.project}\n`;
      if (issue.dueDate) context += `   Due: ${issue.dueDate}\n`;
    });
    context += '\n';
  }

  // Notion Pages Section - NOW WITH FULL CONTENT!
  if (notionPages.length > 0) {
    const pagesWithContent = notionPages.filter(p => p.content && p.content.trim().length > 0);
    const pagesWithoutContent = notionPages.filter(p => !p.content || p.content.trim().length === 0);
    
    context += '### NOTION DOCUMENTS (Full Content Retrieved)\n';
    context += `Total pages: ${notionPages.length} | Pages with content: ${pagesWithContent.length}\n\n`;
    
    // Include full content for pages that have it
    pagesWithContent.forEach((page, i) => {
      const editedDate = new Date(page.lastEdited).toLocaleDateString();
      context += `---\n`;
      context += `#### ${i + 1}. ${page.title}\n`;
      context += `Type: ${page.type} | Last edited: ${editedDate}\n\n`;
      context += `${page.content}\n\n`;
    });
    
    // List pages without content (databases, etc.)
    if (pagesWithoutContent.length > 0) {
      context += `---\n`;
      context += `#### Other Notion Items (metadata only):\n`;
      pagesWithoutContent.forEach((page, i) => {
        const editedDate = new Date(page.lastEdited).toLocaleDateString();
        context += `- ${page.title} (${page.type}) - ${editedDate}\n`;
      });
      context += '\n';
    }
  }

  // Multi-day Workstream Summaries - the core context with rich structured data
  context += '### WORKSTREAM SUMMARIES (Rolling 5-Day Context from Pieces)\n';
  context += 'These summaries capture your coding activity, decisions, and focus areas:\n\n';
  
  summaries.forEach((s, i) => {
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `## ${s.readableTime.toUpperCase()} ${s.timeRange ? `(${s.timeRange})` : ''}\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Check if we have structured data (new format) or just text (legacy)
    const hasStructuredData = (s as any).coreTasks || (s as any).keyDecisions || 
                               (s as any).documentsReviewed || (s as any).nextSteps;
    
    if (hasStructuredData) {
      // Display structured data with clear sections
      if ((s as any).coreTasks) {
        context += `### 📋 CORE TASKS & PROJECTS\n`;
        context += formatStructuredPiecesData((s as any).coreTasks);
        context += `\n`;
      }
      
      if ((s as any).keyDecisions) {
        context += `### 💡 KEY DISCUSSIONS & DECISIONS\n`;
        context += formatStructuredPiecesData((s as any).keyDecisions);
        context += `\n`;
      }
      
      if ((s as any).documentsReviewed) {
        context += `### 📄 DOCUMENTS & CODE REVIEWED\n`;
        context += formatStructuredPiecesData((s as any).documentsReviewed);
        context += `\n`;
      }
      
      if ((s as any).nextSteps) {
        context += `### ⏭️ NEXT STEPS\n`;
        context += formatStructuredPiecesData((s as any).nextSteps);
        context += `\n`;
      }
    } else {
      // Legacy format: just display the summary text
      context += `${s.content}\n\n`;
    }
  });

  // Key Decisions extracted across all days
  if (decisions.length > 0) {
    context += '### KEY DECISIONS & DISCUSSIONS (Extracted from workstream)\n';
    decisions.forEach((d, i) => {
      context += `${i + 1}. ${d}\n`;
    });
    context += '\n';
  }

  // NOTE: Events are no longer included - only structured workstream summaries

  return context;
}

// ============================================================================
// ALFIE CONTEXT FORMATTING
// ============================================================================

export function formatDossierForAlfie(dossier: IntelligenceDossier): string {
  let context = `## DONJON INTELLIGENCE SYSTEMS - BRIEFING DOSSIER
Generated: ${new Date(dossier.timestamp).toLocaleString()}
Status: ${dossier.systemStatus}

### ACTIVE PROJECTS
${dossier.activeProjects.length > 0 
  ? dossier.activeProjects.map(p => `- **${p.name}** (${p.app}) - ${p.activityCount} activities, last: ${p.lastAccessed}`).join('\n')
  : 'No active projects detected.'}

### RECENT DECISIONS & DISCUSSIONS
${dossier.recentDecisions.length > 0
  ? dossier.recentDecisions.map((d, i) => `${i + 1}. ${d}`).join('\n')
  : 'No recent decisions recorded.'}

### WORKSTREAM TIMELINE
${dossier.timeline.length > 0
  ? dossier.timeline.map(s => `**[${s.readableTime}]**\n${s.content.substring(0, 500)}...`).join('\n\n---\n\n')
  : 'No workstream data available.'}

### USER NOTES TO ALFIE
${dossier.userNotes || 'No additional notes from user.'}

---
*Use this context to provide informed, specific business advice. Reference specific projects, decisions, and activities when relevant.*
`;

  return context;
}

// ============================================================================
// LEGACY COMPATIBILITY (for existing code that uses old interface)
// ============================================================================

export interface BusinessBriefing {
  timestamp: string;
  summary: string;
  priorities: Array<{
    issue: string;
    reason: string;
    impact: string;
  }>;
  opportunity: {
    title: string;
    description: string;
    potentialImpact: string;
  };
  risk: {
    title: string;
    description: string;
    mitigation: string;
  };
}

export async function getBriefing(forceRefresh = false): Promise<BusinessBriefing> {
  const dossier = await generateIntelligenceDossier(forceRefresh);
  
  // Convert to legacy format for backward compatibility
  return {
    timestamp: dossier.timestamp,
    summary: formatDossierForAlfie(dossier),
    priorities: dossier.recentDecisions.slice(0, 3).map((d, i) => ({
      issue: d,
      reason: 'Identified from recent workstream activity',
      impact: 'Directly affects current project trajectory'
    })),
    opportunity: {
      title: 'Continue current momentum',
      description: `${dossier.activeProjects.length} active projects detected with ${dossier.events.length} recent activities.`,
      potentialImpact: 'Maintain velocity on key initiatives'
    },
    risk: {
      title: 'Context fragmentation',
      description: 'Multiple projects and contexts may lead to scattered focus.',
      mitigation: 'Use Alfie to maintain strategic alignment across activities.'
    }
  };
}

export function formatBriefingForAlfie(briefing: BusinessBriefing): string {
  return briefing.summary;
}

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

/**
 * Upload current dossier to Supabase
 */
export async function uploadDossierToSupabase(dossier: IntelligenceDossier): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured');
    return;
  }

  try {
    const snapshotData = {
      timestamp: dossier.timestamp,
      system_status: dossier.systemStatus,
      active_projects: dossier.activeProjects,
      recent_decisions: dossier.recentDecisions,
      timeline: dossier.timeline,
      events: dossier.events,
      linear_issues: dossier.linearIssues,
      notion_pages: dossier.notionPages,
      user_notes: dossier.userNotes,
      raw_context: dossier.rawContext,
      data_sources: dossier.dataSources
    };

    const { error } = await supabase!
      .from('briefing_snapshots')
      .insert([snapshotData]);

    if (error) {
      throw error;
    }

    await logSyncOperation('briefing', 'success', 1);
    console.log('✓ Briefing uploaded to Supabase');
  } catch (error) {
    console.error('Failed to upload dossier to Supabase:', error);
    await logSyncOperation('briefing', 'failed', 0, (error as any).message);
    throw error;
  }
}

/**
 * Fetch the latest dossier from Supabase
 */
export async function fetchDossierFromSupabase(): Promise<IntelligenceDossier | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase!
      .from('briefing_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    // Convert database format to IntelligenceDossier format
    const dossier: IntelligenceDossier = {
      timestamp: data.timestamp,
      systemStatus: data.system_status,
      activeProjects: data.active_projects || [],
      recentDecisions: data.recent_decisions || [],
      timeline: data.timeline || [],
      events: data.events || [],
      linearIssues: data.linear_issues || [],
      linearProjects: [], // Fetch fresh from Linear API rather than storing in DB
      notionPages: data.notion_pages || [],
      userNotes: data.user_notes || '',
      rawContext: data.raw_context || '',
      dataSources: data.data_sources || { pieces: false, linear: false, notion: false }
    };

    return dossier;
  } catch (error) {
    console.error('Failed to fetch dossier from Supabase:', error);
    return null;
  }
}

/**
 * Modified generateIntelligenceDossier with Supabase fallback
 * This wraps the original function to add fallback logic
 */
const originalGenerateIntelligenceDossier = generateIntelligenceDossier;

export async function generateIntelligenceDossierWithFallback(forceRefresh = false): Promise<IntelligenceDossier> {
  // First try to use the local server
  const backendAvailable = await isBackendAvailable();

  if (backendAvailable) {
    try {
      return await originalGenerateIntelligenceDossier(forceRefresh);
    } catch (error) {
      console.warn('Failed to fetch from local server, falling back to Supabase:', error);
    }
  }

  // Fall back to Supabase if server is unavailable
  const supabaseData = await fetchDossierFromSupabase();
  if (supabaseData) {
    console.log('Using Supabase data (offline mode)');
    return supabaseData;
  }

  // If both fail, return empty dossier
  console.error('No data available from server or Supabase');
  return {
    timestamp: new Date().toISOString(),
    systemStatus: 'Offline - No data available',
    activeProjects: [],
    recentDecisions: [],
    timeline: [],
    events: [],
    linearIssues: [],
    linearProjects: [],
    notionPages: [],
    userNotes: '',
    rawContext: '',
    dataSources: { pieces: false, linear: false, notion: false }
  };
}
