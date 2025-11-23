/**
 * Business Briefing Module for Alfie
 * Fetches and synthesizes business data from Pieces, Notion, and Linear
 */

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

interface PiecesActivity {
  total: number;
  byLanguage: Record<string, number>;
  activities: Array<{
    name: string;
    language?: string;
  }>;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  dueDate?: string;
}

interface NotionTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
}

const STORAGE_KEY = 'alfie-business-briefing';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Fetch Pieces activity data
 */
export async function fetchPiecesActivity(): Promise<PiecesActivity> {
  try {
    // Try to fetch from local Pieces OS
    const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`http://localhost:39300/activity?since=${encodeURIComponent(sinceDate)}&type=created`);

    if (!response.ok) {
      return { total: 0, byLanguage: {}, activities: [] };
    }

    const data = await response.json();
    const activities = data.activities || [];

    const grouped: Record<string, number> = {};
    activities.forEach((activity: any) => {
      const lang = activity.language || 'unknown';
      grouped[lang] = (grouped[lang] || 0) + 1;
    });

    return {
      total: activities.length,
      byLanguage: grouped,
      activities: activities.slice(0, 5)
    };
  } catch (error) {
    console.error('Failed to fetch Pieces activity:', error);
    return { total: 0, byLanguage: {}, activities: [] };
  }
}

/**
 * Analyze business data and generate priorities
 */
function analyzePriorities(
  linearIssues: LinearIssue[],
  notionTasks: NotionTask[],
  pieces: PiecesActivity
): Array<{ issue: string; reason: string; impact: string }> {
  const priorities: Array<{ issue: string; reason: string; impact: string }> = [];

  // Priority 1: Overdue critical work
  const overdueIssues = linearIssues.filter(
    (i) => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'Done'
  );

  if (overdueIssues.length > 0) {
    priorities.push({
      issue: `  Address ${overdueIssues.length} overdue issue(s): ${overdueIssues[0].title}`,
      reason: `These were due and remain unfinished. Business impact materializing.`,
      impact: 'Team credibility and project timeline at serious risk'
    });
  }

  // Priority 2: High-priority active work
  const highPriorityIssues = linearIssues
    .filter((i) => i.priority >= 1 && i.status !== 'Done')
    .slice(0, 2);

  if (highPriorityIssues.length > 0) {
    priorities.push({
      issue: `<¯ Complete critical path: ${highPriorityIssues.map((i) => i.title).join(', ')}`,
      reason: 'These are marked as blocking other work',
      impact: 'Blocks downstream work and team dependencies'
    });
  }

  // Priority 3: Consolidate development efforts
  if (pieces.total > 0) {
    const topLanguage = Object.entries(pieces.byLanguage).sort((a, b) => b[1] - a[1])[0];
    priorities.push({
      issue: `=» Consolidate ${topLanguage[0]} development momentum`,
      reason: `${topLanguage[1]} pieces created recently - heavy activity in this area`,
      impact: 'Batch related work to improve velocity and consistency'
    });
  } else {
    // Fallback if no development activity
    priorities.push({
      issue: '=Ê Begin development work on next priority',
      reason: 'No recent development activity detected',
      impact: 'Need to kickstart engineering effort'
    });
  }

  return priorities.slice(0, 3);
}

/**
 * Identify business opportunities
 */
function identifyOpportunity(
  linearIssues: LinearIssue[],
  pieces: PiecesActivity
): {
  title: string;
  description: string;
  potentialImpact: string;
} {
  const completedIssues = linearIssues.filter((i) => i.status === 'Done');
  const inProgressIssues = linearIssues.filter((i) => i.status !== 'Done' && i.status !== 'Backlog');

  // Strong completion ratio - suggest scaling
  if (completedIssues.length > inProgressIssues.length && completedIssues.length > 3) {
    return {
      title: '=€ Scaling opportunity - execution is strong',
      description: `You've completed ${completedIssues.length} issues while only ${inProgressIssues.length} are in progress. Your team is moving fast.`,
      potentialImpact: '20-30% more features could ship in same timeframe'
    };
  }

  // Tech stack complexity
  const languageCount = Object.keys(pieces.byLanguage).length;
  if (languageCount > 3) {
    return {
      title: '<¯ Tech stack consolidation opportunity',
      description: `You're actively developing in ${languageCount} languages. This spreads expertise thin.`,
      potentialImpact: 'Improved code quality, faster onboarding, reduced cognitive load'
    };
  }

  // General opportunity
  return {
    title: '=¡ Customer feedback loop optimization',
    description: 'With current velocity, you have bandwidth to implement high-impact customer requests.',
    potentialImpact: 'Improved retention and competitive differentiation'
  };
}

/**
 * Identify business risks
 */
function identifyRisk(linearIssues: LinearIssue[], notionTasks: NotionTask[]): {
  title: string;
  description: string;
  mitigation: string;
} {
  // Work-in-progress accumulation
  const stuckIssues = linearIssues.filter((i) => i.status === 'In Progress').length;
  const totalIssues = linearIssues.length;

  if (stuckIssues > totalIssues * 0.5) {
    return {
      title: '=¨ WIP accumulation - context switching risk',
      description: `${stuckIssues} of ${totalIssues} issues stuck in progress. This screams context switching or unresolved blockers.`,
      mitigation: 'Establish WIP limits. Finish work before starting new. Root-cause and eliminate blockers immediately.'
    };
  }

  // Compressed timeline
  const upcomingDeadlines = linearIssues.filter(
    (i) =>
      i.dueDate &&
      new Date(i.dueDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
      i.status !== 'Done'
  );

  if (upcomingDeadlines.length > 2) {
    return {
      title: 'ð Multiple deadlines within 7 days',
      description: `${upcomingDeadlines.length} issues due imminently. This is a timeline squeeze.`,
      mitigation: 'Ruthless prioritization. Communicate risks to stakeholders. Negotiate deadline extensions where possible.'
    };
  }

  // Default risk
  return {
    title: '™ Technical debt accumulation',
    description: 'Monitor your codebase for areas needing refactoring or modernization.',
    mitigation: 'Allocate 10-15% of capacity to technical debt reduction each sprint'
  };
}

/**
 * Generate a business briefing
 */
export async function generateBusinessBriefing(): Promise<BusinessBriefing> {
  try {
    const pieces = await fetchPiecesActivity();

    // For now, Linear and Notion would be fetched from your actual APIs
    // This is a placeholder structure
    const mockLinearIssues: LinearIssue[] = [];
    const mockNotionTasks: NotionTask[] = [];

    const priorities = analyzePriorities(mockLinearIssues, mockNotionTasks, pieces);
    const opportunity = identifyOpportunity(mockLinearIssues, pieces);
    const risk = identifyRisk(mockLinearIssues, mockNotionTasks);

    const summary = `
**Donjon Systems Status:**
- Development Activity: ${pieces.total} pieces created (last 24h)
- Tech Stack: ${Object.keys(pieces.byLanguage).length > 0 ? Object.keys(pieces.byLanguage).join(', ') : 'None detected'}
- Primary Languages: ${Object.entries(pieces.byLanguage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ') || 'No activity'}
    `.trim();

    return {
      timestamp: new Date().toISOString(),
      summary,
      priorities,
      opportunity,
      risk
    };
  } catch (error) {
    console.error('Failed to generate business briefing:', error);
    return {
      timestamp: new Date().toISOString(),
      summary: 'Unable to fetch business context at this time',
      priorities: [],
      opportunity: {
        title: 'Restore data connections',
        description: 'System unable to fetch Pieces, Linear, and Notion data',
        potentialImpact: 'Reconnect data sources to enable intelligent business analysis'
      },
      risk: {
        title: 'Data availability',
        description: 'Could not fetch real-time business context',
        mitigation: 'Verify Pieces OS is running on localhost:39300. Check API credentials.'
      }
    };
  }
}

/**
 * Format briefing as markdown for Alfie to reference
 */
export function formatBriefingForAlfie(briefing: BusinessBriefing): string {
  return `
## Donjon Systems Business Briefing
${briefing.summary}

### <¯ Top 3 Priorities
${briefing.priorities.map((p, i) => `${i + 1}. ${p.issue}\n   ’ ${p.reason}\n      ${p.impact}`).join('\n\n')}

### =¡ Key Opportunity
**${briefing.opportunity.title}**
${briefing.opportunity.description}
**Impact**: ${briefing.opportunity.potentialImpact}

###    Critical Risk
**${briefing.risk.title}**
${briefing.risk.description}
**Mitigation**: ${briefing.risk.mitigation}

---
*Briefing generated: ${new Date(briefing.timestamp).toLocaleString()}*
  `.trim();
}

/**
 * Get cached briefing or generate new one
 */
export async function getBriefing(forceRefresh = false): Promise<BusinessBriefing> {
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.error('Error reading cached briefing:', error);
    }
  }

  const briefing = await generateBusinessBriefing();

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        data: briefing,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    console.error('Error caching briefing:', error);
  }

  return briefing;
}
