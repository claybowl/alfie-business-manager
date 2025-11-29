/**
 * Workstream Summaries Module for Alfie
 * Manages clean, structured daily summaries for context priming
 */

import { supabase, isSupabaseConfigured } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkstreamSummaryStructured {
  id?: string;
  summary_date: string; // ISO date: YYYY-MM-DD
  day_label: string; // "today", "yesterday", "Monday (Dec 15)"
  core_tasks: string; // Core Tasks & Projects
  key_discussions: string; // Key Discussions & Decisions
  documents_reviewed: string; // Documents & Code Reviewed
  next_steps: string; // Next Steps
  raw_summary?: string; // Full markdown backup
  source?: string;
  is_manual?: boolean;
  is_locked?: boolean;
  tags?: string[];
  created_at?: string;
}

// ============================================================================
// STORAGE
// ============================================================================

const CACHE_KEY = 'alfie-workstream-summaries-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save a structured workstream summary to Supabase
 */
export async function saveWorkstreamSummary(summary: WorkstreamSummaryStructured): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, saving to localStorage only');
    return saveToLocalStorage(summary);
  }

  try {
    const { error } = await supabase!.from('workstream_summaries').insert([{
      summary_date: summary.summary_date,
      day_label: summary.day_label,
      core_tasks: summary.core_tasks,
      key_discussions: summary.key_discussions,
      documents_reviewed: summary.documents_reviewed,
      next_steps: summary.next_steps,
      raw_summary: summary.raw_summary,
      source: summary.source || 'pieces',
      is_manual: summary.is_manual || false,
      tags: summary.tags || []
    }]);

    if (error) {
      console.error('Error saving workstream summary:', error);
      return false;
    }

    // Clear cache
    clearCache();
    return true;
  } catch (error) {
    console.error('Failed to save workstream summary:', error);
    return false;
  }
}

/**
 * Fetch recent workstream summaries (last N days)
 */
export async function fetchRecentWorkstreamSummaries(days: number = 14): Promise<WorkstreamSummaryStructured[]> {
  if (!isSupabaseConfigured()) {
    return getFromLocalStorage();
  }

  try {
    // Check cache first
    const cached = getFromCache();
    if (cached && cached.length > 0) {
      return cached;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase!
      .from('recent_workstream_summaries') // Uses the view
      .select('*')
      .gte('summary_date', cutoffDate.toISOString().split('T')[0])
      .order('summary_date', { ascending: false });

    if (error) {
      console.error('Error fetching summaries:', error);
      return getFromLocalStorage();
    }

    const summaries = (data || []) as WorkstreamSummaryStructured[];

    // Cache the results
    saveToCache(summaries);
    return summaries;
  } catch (error) {
    console.error('Failed to fetch summaries:', error);
    return getFromLocalStorage();
  }
}

/**
 * Fetch today's workstream summary
 */
export async function fetchTodaySummary(): Promise<WorkstreamSummaryStructured | null> {
  if (!isSupabaseConfigured()) {
    return getFromLocalStorage()?.[0] || null;
  }

  try {
    const { data, error } = await supabase!
      .from('todays_workstream_summary') // Uses the view
      .select('*')
      .single();

    if (error || !data) {
      return null;
    }

    return data as WorkstreamSummaryStructured;
  } catch (error) {
    console.error('Failed to fetch today summary:', error);
    return null;
  }
}

/**
 * Update a workstream summary
 */
export async function updateWorkstreamSummary(id: string, updates: Partial<WorkstreamSummaryStructured>): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured');
    return false;
  }

  try {
    const { error } = await supabase!
      .from('workstream_summaries')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating summary:', error);
      return false;
    }

    clearCache();
    return true;
  } catch (error) {
    console.error('Failed to update summary:', error);
    return false;
  }
}

// ============================================================================
// LOCAL STORAGE (FALLBACK)
// ============================================================================

function saveToLocalStorage(summary: WorkstreamSummaryStructured): boolean {
  try {
    const key = `workstream-${summary.summary_date}`;
    localStorage.setItem(key, JSON.stringify(summary));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
}

function getFromLocalStorage(): WorkstreamSummaryStructured[] {
  try {
    const summaries: WorkstreamSummaryStructured[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('workstream-')) {
        const item = localStorage.getItem(key);
        if (item) {
          summaries.push(JSON.parse(item));
        }
      }
    }
    return summaries.sort((a, b) => new Date(b.summary_date).getTime() - new Date(a.summary_date).getTime());
  } catch (error) {
    console.error('Failed to get from localStorage:', error);
    return [];
  }
}

// ============================================================================
// CACHING
// ============================================================================

function saveToCache(summaries: WorkstreamSummaryStructured[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: summaries,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to cache:', error);
  }
}

function getFromCache(): WorkstreamSummaryStructured[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      clearCache();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to read cache:', error);
    return null;
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

// ============================================================================
// CONTEXT FORMATTING FOR ALFIE
// ============================================================================

/**
 * Format workstream summaries for inclusion in Alfie's system prompt
 * This creates clean, scannable context for the AI
 */
export function formatSummariesForAlfieContext(summaries: WorkstreamSummaryStructured[]): string {
  if (!summaries || summaries.length === 0) {
    return 'No workstream summaries available.';
  }

  let context = '## WORKSTREAM CONTEXT - LAST 14 DAYS\n\n';

  summaries.forEach((summary) => {
    context += `### ${summary.day_label.toUpperCase()} (${summary.summary_date})\n\n`;

    if (summary.core_tasks) {
      context += `**Core Tasks & Projects**\n${summary.core_tasks}\n\n`;
    }

    if (summary.key_discussions) {
      context += `**Key Discussions & Decisions**\n${summary.key_discussions}\n\n`;
    }

    if (summary.documents_reviewed) {
      context += `**Documents & Code Reviewed**\n${summary.documents_reviewed}\n\n`;
    }

    if (summary.next_steps) {
      context += `**Next Steps**\n${summary.next_steps}\n\n`;
    }

    context += '---\n\n';
  });

  return context;
}

/**
 * Get the most recent summaries formatted for context injection
 */
export async function getContextForAlfie(days: number = 7): Promise<string> {
  const summaries = await fetchRecentWorkstreamSummaries(days);
  return formatSummariesForAlfieContext(summaries);
}

// ============================================================================
// PARSING FROM PIECES LTM DATA
// ============================================================================

/**
 * Parse a Pieces workstream summary into structured format
 * Expects the structured format from backend's ask_pieces_ltm
 */
export function parseFromPiecesData(piecesData: any, dayLabel: string, dateStr: string): WorkstreamSummaryStructured {
  const summary: WorkstreamSummaryStructured = {
    summary_date: dateStr,
    day_label: dayLabel,
    core_tasks: extractSection(piecesData, 'Core Tasks & Projects') || '',
    key_discussions: extractSection(piecesData, 'Key Discussions & Decisions') || '',
    documents_reviewed: extractSection(piecesData, 'Documents & Code Reviewed') || '',
    next_steps: extractSection(piecesData, 'Next Steps') || '',
    raw_summary: typeof piecesData === 'string' ? piecesData : '',
    source: 'pieces',
    is_manual: false,
    tags: extractTags(piecesData)
  };

  return summary;
}

/**
 * Extract a specific section from markdown content
 */
function extractSection(content: any, sectionName: string): string {
  if (typeof content !== 'string') {
    return '';
  }

  // Match the section header and extract until the next section or end
  const regex = new RegExp(`^\\*\\*${sectionName}\\*\\*\\s*\n(.*?)(?=^\\*\\*|$)`, 'mgi');
  const match = regex.exec(content);

  if (match && match[1]) {
    return match[1].trim();
  }

  return '';
}

/**
 * Extract tags from content (project names, keywords, etc.)
 */
function extractTags(content: any): string[] {
  if (typeof content !== 'string') {
    return [];
  }

  const tags = new Set<string>();

  // Extract bold project names
  const projectMatches = content.match(/\*\*([A-Za-z\-]+(?:\s+[A-Za-z\-]+)*)\*\*/g);
  if (projectMatches) {
    projectMatches.forEach(match => {
      const project = match.replace(/\*\*/g, '').trim();
      if (project.length > 2 && project.length < 50) {
        tags.add(project);
      }
    });
  }

  // Extract common keywords
  const keywords = ['feature', 'bug', 'design', 'documentation', 'refactor', 'deployment', 'review', 'meeting', 'discussion'];
  keywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword)) {
      tags.add(keyword);
    }
  });

  return Array.from(tags);
}
