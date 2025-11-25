/**
 * Business Briefing Module for Alfie
 * Intelligence Dossier - Fetches and synthesizes business data from Pieces, Notion, and Linear
 */

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
  
  // Linear issues
  linearIssues: LinearIssueData[];
  
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
  } | null;
  notion: {
    total: number;
    pages: NotionPage[];
  } | null;
  errors: Array<{ source: string; error: string }>;
}

async function fetchFullBriefingData(): Promise<FullBriefingResponse> {
  try {
    const response = await fetch('http://localhost:3001/api/briefing/full');
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
    const response = await fetch('http://localhost:3001/api/pieces/activity');
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
    events: events.sort((a, b) => b.score - a.score).slice(0, 20),
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

// Helper: Extract projects from summary content
function extractProjectsFromContent(
  content: string, 
  activeProjects: Map<string, ActiveProject>,
  dayLabel: string
): void {
  // Look for project names in various patterns
  const projectPatterns = [
    /(?:project|working on|developing|implementing)\s+["']?([A-Z][a-zA-Z0-9\s-]+)["']?/gi,
    /\*\*([A-Z][a-zA-Z0-9\s-]+)\*\*\s*(?:project|app|application|system)/gi,
    /([A-Z][a-zA-Z0-9-]+(?:\s+[A-Z][a-zA-Z0-9-]+)?)\s+(?:backend|frontend|server|client|API)/gi
  ];
  
  const foundProjects = new Set<string>();
  
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const projectName = match[1]?.trim();
      if (projectName && projectName.length > 2 && projectName.length < 50) {
        foundProjects.add(projectName);
      }
    }
  }
  
  // Also look for specific code/repo references
  const repoPattern = /(?:repository|repo|codebase)\s*[:\-]?\s*["']?([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/gi;
  let repoMatch;
  while ((repoMatch = repoPattern.exec(content)) !== null) {
    if (repoMatch[1]) foundProjects.add(repoMatch[1]);
  }
  
  foundProjects.forEach(projectName => {
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
    if (projectName && !activeProjects.has(projectName)) {
      activeProjects.set(projectName, {
        name: projectName,
        lastAccessed: event.readableTime,
        app: event.app.replace('.exe', ''),
        activityCount: 1
      });
    } else if (projectName) {
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

export function saveUserNotes(notes: string): void {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, notes);
  } catch (e) {
    console.error('Failed to save user notes:', e);
  }
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
  
  // Extract Notion pages
  const notionPages: NotionPage[] = fullData.notion?.pages || [];

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

  // Notion Pages Section
  if (notionPages.length > 0) {
    context += '### NOTION PAGES (Recent Documents)\n';
    notionPages.forEach((page, i) => {
      const editedDate = new Date(page.lastEdited).toLocaleDateString();
      context += `${i + 1}. ${page.title} (${page.type}) - Last edited: ${editedDate}\n`;
    });
    context += '\n';
  }

  // Multi-day Workstream Summaries - the core context
  context += '### WORKSTREAM SUMMARIES (Rolling 5-Day Context from Pieces)\n';
  context += 'These summaries capture your coding activity, decisions, and focus areas:\n\n';
  
  summaries.forEach((s, i) => {
    context += `---\n`;
    context += `**${s.readableTime}** ${s.timeRange ? `(${s.timeRange})` : ''}\n`;
    context += `${s.content}\n\n`;
  });

  // Key Decisions extracted across all days
  if (decisions.length > 0) {
    context += '### KEY DECISIONS & DISCUSSIONS (Extracted from workstream)\n';
    decisions.forEach((d, i) => {
      context += `${i + 1}. ${d}\n`;
    });
    context += '\n';
  }

  // Recent Activity events (if available)
  if (events.length > 0) {
    context += '### RECENT ACTIVITY (Top 10 by relevance)\n';
    events.slice(0, 10).forEach((e, i) => {
      context += `${i + 1}. [${e.app}] ${e.windowTitle} - ${e.readableTime}\n`;
    });
  }

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
