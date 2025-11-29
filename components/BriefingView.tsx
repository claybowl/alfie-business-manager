import React, { useState, useEffect } from 'react';
import { 
  generateIntelligenceDossier, 
  saveUserNotes, 
  IntelligenceDossier,
  WorkstreamSummary,
  WorkstreamEvent,
  ActiveProject,
  LinearIssueData,
  NotionPage
} from '../utils/briefing';
import { RefreshIcon } from './Icons';
import { getRecentSessions, ConversationSession, generateConversationSummary } from '../utils/conversations';

type TabId = 'overview' | 'linear' | 'notion' | 'timeline' | 'events' | 'notes';

export const BriefingView: React.FC = () => {
  const [dossier, setDossier] = useState<IntelligenceDossier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [userNotes, setUserNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const loadDossier = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const data = await generateIntelligenceDossier(forceRefresh);
      setDossier(data);
      setUserNotes(data.userNotes || '');
    } catch (error) {
      console.error('Failed to load dossier:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDossier();
  }, []);

  const handleSaveNotes = async () => {
    await saveUserNotes(userNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (isLoading && !dossier) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-950 to-black">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-amber-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-pulse"></div>
            <div className="absolute inset-4 bg-amber-500/20 rounded-full"></div>
          </div>
          <p className="text-amber-300/80 font-mono text-sm tracking-wider">COMPILING INTELLIGENCE...</p>
        </div>
      </div>
    );
  }

  // Get conversation count
  const conversationCount = getRecentSessions(7).length;
  
  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', count: dossier?.activeProjects.length || 0 },
    { id: 'linear' as TabId, label: 'Linear', count: dossier?.linearIssues?.length || 0, icon: '📋' },
    { id: 'notion' as TabId, label: 'Notion', count: dossier?.notionPages?.length || 0, icon: '📝' },
    { id: 'timeline' as TabId, label: 'Timeline', count: dossier?.timeline.length || 0 },
    { id: 'events' as TabId, label: 'Activity', count: conversationCount, icon: '💬' },
    { id: 'notes' as TabId, label: 'Notes', count: userNotes.length > 0 ? 1 : 0 },
  ];

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-gradient-to-b from-gray-950 to-black">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-900/30 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-amber-300 tracking-tight">Intelligence Dossier</h1>
              <p className="text-xs text-gray-500 font-mono mt-1">
                DONJON INTELLIGENCE SYSTEMS • {dossier?.systemStatus || 'Initializing...'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-600 font-mono">
                {dossier && new Date(dossier.timestamp).toLocaleTimeString()}
              </span>
              <button
                onClick={() => loadDossier(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded border border-amber-600/30 transition-all disabled:opacity-50 text-sm font-mono"
              >
                <RefreshIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'SYNCING' : 'REFRESH'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 mt-4 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-mono transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-amber-300 border-amber-500 bg-amber-900/10'
                    : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                    activeTab === tab.id ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {activeTab === 'overview' && dossier && <OverviewTab dossier={dossier} />}
          {activeTab === 'linear' && dossier && <LinearTab issues={dossier.linearIssues || []} connected={dossier.dataSources?.linear} />}
          {activeTab === 'notion' && dossier && <NotionTab pages={dossier.notionPages || []} connected={dossier.dataSources?.notion} />}
          {activeTab === 'timeline' && dossier && <TimelineTab timeline={dossier.timeline} />}
          {activeTab === 'events' && <ConversationsTab />}
          {activeTab === 'notes' && (
            <NotesTab 
              notes={userNotes} 
              setNotes={setUserNotes} 
              onSave={handleSaveNotes}
              saved={notesSaved}
            />
          )}
        </div>
      </main>
    </div>
  );
};

// ============================================================================
// TAB COMPONENTS
// ============================================================================

const OverviewTab: React.FC<{ dossier: IntelligenceDossier }> = ({ dossier }) => {
  const maxActivity = dossier.activeProjects.length > 0
    ? Math.max(...dossier.activeProjects.map(p => p.activityCount))
    : 0;

  return (
    <div className="space-y-6">
      {/* Active Projects */}
      <section>
        <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Active Projects
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dossier.activeProjects.length > 0 ? (
            dossier.activeProjects.map((project, i) => (
              <ProjectCard key={i} project={project} maxActivity={maxActivity} />
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-600 border border-dashed border-gray-800 rounded-lg">
              No active projects detected. Start working and Pieces will track your activity.
            </div>
          )}
        </div>
      </section>

      {/* Recent Decisions */}
      <section>
        <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
          Recent Decisions & Discussions
        </h2>
        <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
          {dossier.recentDecisions.length > 0 ? (
            <ul className="space-y-3">
              {dossier.recentDecisions.map((decision, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 bg-amber-900/30 border border-amber-700/30 rounded flex items-center justify-center text-amber-500 text-xs font-mono">
                    {i + 1}
                  </span>
                  <span className="text-gray-300 leading-relaxed">{decision}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 text-center py-4">
              No decisions extracted from recent activity. Key discussions will appear here.
            </p>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Projects" value={dossier.activeProjects.length} color="green" />
        <StatCard label="Decisions" value={dossier.recentDecisions.length} color="amber" />
        <StatCard label="Linear Issues" value={dossier.linearIssues?.length || 0} color="indigo" />
        <StatCard label="Notion Pages" value={dossier.notionPages?.length || 0} color="gray" />
        <StatCard label="Timeline" value={dossier.timeline.length} color="blue" />
        <StatCard label="Activity" value={dossier.events.length} color="purple" />
      </section>
      
      {/* Data Sources & Context Status */}
      <section className="p-4 bg-gray-900/20 rounded-lg border border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-mono">DATA SOURCES & CONTEXT</span>
          <span className="text-xs text-amber-400/60 font-mono">
            Rolling 5-Day Window Active
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-mono flex items-center gap-1 ${dossier.dataSources?.pieces ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dossier.dataSources?.pieces ? 'bg-green-400' : 'bg-red-400'}`}></span>
            Pieces ({dossier.timeline.length} days)
          </span>
          <span className={`text-xs font-mono flex items-center gap-1 ${dossier.dataSources?.linear ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dossier.dataSources?.linear ? 'bg-green-400' : 'bg-red-400'}`}></span>
            Linear
          </span>
          <span className={`text-xs font-mono flex items-center gap-1 ${dossier.dataSources?.notion ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dossier.dataSources?.notion ? 'bg-green-400' : 'bg-red-400'}`}></span>
            Notion
          </span>
        </div>
        {dossier.timeline.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-800/50">
            <p className="text-xs text-gray-500">
              <span className="text-amber-400/80">Context coverage:</span>{' '}
              {dossier.timeline[dossier.timeline.length - 1]?.readableTime || 'N/A'} → {dossier.timeline[0]?.readableTime || 'Today'}
            </p>
          </div>
        )}
      </section>

      {/* User Notes Preview */}
      {dossier.userNotes && (
        <section>
          <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Your Notes to Alfie
          </h2>
          <div className="bg-blue-900/10 border border-blue-800/30 rounded-lg p-4">
            <p className="text-blue-200/80 text-sm whitespace-pre-wrap">{dossier.userNotes}</p>
          </div>
        </section>
      )}
    </div>
  );
};

const TimelineTab: React.FC<{ timeline: WorkstreamSummary[] }> = ({ timeline }) => {
  const [refreshedTimeline, setRefreshedTimeline] = useState<WorkstreamSummary[]>(timeline);
  const [isRefreshingToday, setIsRefreshingToday] = useState(false);

  // Auto-refresh today's data periodically
  useEffect(() => {
    setRefreshedTimeline(timeline);

    const isToday = timeline.length > 0 && timeline[0].readableTime?.toLowerCase().includes('today');
    if (!isToday) return;

    const refreshTodayData = async () => {
      setIsRefreshingToday(true);
      try {
        const response = await fetch('http://localhost:3002/api/briefing/full');
        if (response.ok) {
          const fullData = await response.json();
          if (fullData.pieces?.summaries) {
            const todaySummaries = fullData.pieces.summaries
              .filter((s: any) => s.dayLabel?.toLowerCase().includes('today'))
              .map((daySummary: any, index: number) => ({
                id: `day-${daySummary.date}-${index}`,
                created: daySummary.fetchedAt || '',
                readableTime: daySummary.dayLabel || 'Today',
                timeRange: daySummary.date || '',
                content: (daySummary.summary || '').replace(/\\n/g, '\n').replace(/\\"/g, '"')
              }));

            if (todaySummaries.length > 0) {
              setRefreshedTimeline([...todaySummaries, ...refreshedTimeline.slice(1)]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to refresh today data:', error);
      }
      setIsRefreshingToday(false);
    };

    // Refresh today's data every 5 minutes if it's still today
    const interval = setInterval(refreshTodayData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeline]);

  // Clean content before processing - removes JSON artifacts and metadata
  const cleanContent = (raw: string): string => {
    let cleaned = raw;
    
    // Remove JSON objects and arrays from content
    cleaned = cleaned.replace(/\{"[^"]*":[^}]*\}/g, '');
    cleaned = cleaned.replace(/\[\{[^\]]*\}\]/g, '');
    cleaned = cleaned.replace(/\{[^{}]*"instructions:"[^}]*\}/g, '');
    cleaned = cleaned.replace(/\{[^{}]*"created":[^}]*\}/g, '');
    cleaned = cleaned.replace(/\{[^{}]*"browser_url":[^}]*\}/g, '');
    cleaned = cleaned.replace(/\{[^{}]*"hints":[^}]*\}/g, '');
    cleaned = cleaned.replace(/\{[^{}]*"pro_tips":[^}]*\}/g, '');
    
    // Remove incomplete fragments
    cleaned = cleaned.replace(/\}\s*\]\s*,?\s*"?[a-z_]*"?:?\s*\[?\s*\{?/gi, '');
    cleaned = cleaned.replace(/",?"?[a-z_]*"?:\s*"[^"]*$/gi, '');
    
    // Clean JSON punctuation artifacts
    cleaned = cleaned.replace(/[{}\[\]"]+/g, '');
    cleaned = cleaned.replace(/:\s*,/g, '');
    cleaned = cleaned.replace(/,\s*,/g, '');
    
    // Remove isolated technical words
    cleaned = cleaned.replace(/^\s*detected\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*activity\s*$/gm, '');
    cleaned = cleaned.replace(/Automated Summary:\s*/gi, '');
    
    return cleaned;
  };
  
  // Parse and organize content into sections
  const parseSummaryIntoSections = (rawContent: string) => {
    const content = cleanContent(rawContent);
    const sections: { title: string; items: string[] }[] = [];
    
    // Common section patterns - more flexible matching
    const sectionPatterns = [
      { pattern: /📋?\s*Core Tasks & Projects\s*\n([\s\S]*?)(?=(?:📋|💬|📁|⚙️|\*\*|###|$))/i, title: 'Core Tasks & Projects' },
      { pattern: /💬?\s*Key Discussions & Decisions\s*\n([\s\S]*?)(?=(?:📋|💬|📁|⚙️|\*\*|###|$))/i, title: 'Key Discussions & Decisions' },
      { pattern: /📁?\s*Documents & Code Focused On\s*\n([\s\S]*?)(?=(?:📋|💬|📁|⚙️|\*\*|###|$))/i, title: 'Documents & Code' },
      { pattern: /⚙️?\s*Technical Implementation\s*\n([\s\S]*?)(?=(?:📋|💬|📁|⚙️|\*\*|###|$))/i, title: 'Technical Implementation' },
    ];
    
    for (const { pattern, title } of sectionPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const items = match[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'))
          .map(line => line.replace(/^[-*•]\s*/, '').trim())
          .filter(line => line.length > 10 && !line.match(/^[{}\[\]",:]+$/)); // Filter out garbage
        
        if (items.length > 0) {
          sections.push({ title, items });
        }
      }
    }
    
    return sections;
  };

  return (
    <div className="space-y-6">
      {/* Context info banner */}
      <div className="flex items-center gap-3 p-3 bg-amber-900/10 border border-amber-800/30 rounded-lg">
        <div className={`w-2 h-2 ${isRefreshingToday ? 'bg-green-500 animate-spin' : 'bg-amber-500 animate-pulse'} rounded-full`}></div>
        <span className="text-xs text-amber-300/80 font-mono">
          ROLLING 5-DAY CONTEXT WINDOW • {refreshedTimeline.length} day{refreshedTimeline.length !== 1 ? 's' : ''} of activity captured
          {isRefreshingToday && ' • Refreshing today...'}
        </span>
      </div>

      {refreshedTimeline.length > 0 ? (
        refreshedTimeline.map((summary, i) => {
          const sections = parseSummaryIntoSections(summary.content);
          const hasStructuredContent = sections.length > 0;
          
          return (
            <div key={summary.id} className="relative pl-8 pb-6 border-l-2 border-gray-800 last:pb-0">
              {/* Timeline dot with day indicator */}
              <div className="absolute left-[-9px] top-0 w-4 h-4 bg-amber-500/20 border-2 border-amber-500 rounded-full flex items-center justify-center">
                {i === 0 && <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>}
              </div>
              
              <div className="bg-gray-900/40 border border-gray-800 rounded-lg overflow-hidden hover:border-amber-500/30 transition-colors">
                {/* Header */}
                <div className="flex justify-between items-center p-4 bg-gray-900/60 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono px-3 py-1 rounded ${
                      i === 0 
                        ? 'text-amber-300 bg-amber-900/30 border border-amber-700/30' 
                        : 'text-gray-400 bg-gray-800/50'
                    }`}>
                      {summary.readableTime}
                    </span>
                    {i === 0 && (
                      <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded font-mono">
                        LATEST
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 font-mono">{summary.timeRange}</span>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  {hasStructuredContent ? (
                    <div className="space-y-4">
                      {sections.map((section, sIdx) => (
                        <div key={sIdx}>
                          <h4 className="text-xs font-mono text-amber-400/80 mb-2 flex items-center gap-2">
                            {getSectionIcon(section.title)}
                            {section.title}
                          </h4>
                          <ul className="space-y-1.5">
                            {section.items.slice(0, 5).map((item, itemIdx) => (
                              <li key={itemIdx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-amber-600 mt-1">•</span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                            {section.items.length > 5 && (
                              <li className="text-xs text-gray-500 italic pl-4">
                                + {section.items.length - 5} more items...
                              </li>
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <FallbackContentDisplay content={summary.content} cleanContent={cleanContent} />
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-900/50 border border-gray-800 flex items-center justify-center">
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-lg text-gray-400 mb-2">No timeline data available</p>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Workstream summaries will appear here as Pieces captures your coding activity. 
            The rolling 5-day window ensures Alfie always has recent context.
          </p>
        </div>
      )}
    </div>
  );
};

// Fallback content display for unstructured summaries
const FallbackContentDisplay: React.FC<{ 
  content: string; 
  cleanContent: (s: string) => string;
}> = ({ content, cleanContent }) => {
  const cleaned = cleanContent(content);
  
  // Try to extract structured sections from cleaned content
  const extractedSections: { title: string; items: string[] }[] = [];
  
  // Look for emoji-prefixed sections
  const sectionMatches = cleaned.matchAll(/([📋💬📁⚙️🔧📌]\s*[A-Za-z\s&]+)\n([\s\S]*?)(?=(?:[📋💬📁⚙️🔧📌]|$))/g);
  for (const match of sectionMatches) {
    const title = match[1].trim();
    const items = match[2]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
      .map(line => line.replace(/^[•\-*]\s*/, ''))
      .filter(line => line.length > 10);
    
    if (items.length > 0) {
      extractedSections.push({ title, items });
    }
  }
  
  // If we found sections, display them
  if (extractedSections.length > 0) {
    return (
      <div className="space-y-4">
        {extractedSections.map((section, sIdx) => (
          <div key={sIdx}>
            <h4 className="text-xs font-mono text-amber-400/80 mb-2">
              {section.title}
            </h4>
            <ul className="space-y-1.5">
              {section.items.slice(0, 5).map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-amber-600 mt-1">•</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  
  // Otherwise, extract bullet points from the cleaned content
  const bulletPoints = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
    .map(line => line.replace(/^[•\-*]\s*/, ''))
    .filter(line => line.length > 15);
  
  if (bulletPoints.length > 0) {
    return (
      <ul className="space-y-2">
        {bulletPoints.slice(0, 8).map((item, idx) => (
          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
            <span className="text-amber-600 mt-1">•</span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
        {bulletPoints.length > 8 && (
          <li className="text-xs text-gray-500 italic pl-4">
            + {bulletPoints.length - 8} more items...
          </li>
        )}
      </ul>
    );
  }
  
  // Last resort: display as paragraphs, but clean it thoroughly
  const paragraphs = cleaned
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 20 && !p.match(/^[{}\[\]":,]+$/));
  
  if (paragraphs.length > 0) {
    return (
      <div className="space-y-3">
        {paragraphs.slice(0, 3).map((para, idx) => (
          <p key={idx} className="text-sm text-gray-300 leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    );
  }
  
  // Nothing meaningful found
  return (
    <p className="text-sm text-gray-500 italic">
      Activity captured but no detailed summary available.
    </p>
  );
};

// Helper: Get icon for section type
function getSectionIcon(sectionTitle: string): string {
  const title = sectionTitle.toLowerCase();
  if (title.includes('task') || title.includes('project')) return '📋';
  if (title.includes('discussion') || title.includes('decision')) return '💬';
  if (title.includes('document') || title.includes('code')) return '📁';
  if (title.includes('technical') || title.includes('implementation')) return '⚙️';
  return '📌';
}

const ConversationsTab: React.FC = () => {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    // Load recent conversation sessions (last 7 days)
    const recentSessions = getRecentSessions(7);
    setSessions(recentSessions);
  }, []);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDuration = (session: ConversationSession) => {
    if (!session.endTime) return 'Ongoing';
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    const durationSec = Math.floor((end - start) / 1000);
    if (durationSec < 60) return `${durationSec}s`;
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-3">
      {sessions.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm text-amber-400/70 font-mono mb-4">
            📝 Conversation History - Last 7 Days ({sessions.length} sessions)
          </div>
          {sessions.map((session, idx) => (
            <div 
              key={session.id}
              className="bg-gray-900/40 border border-gray-800/50 rounded-lg overflow-hidden hover:border-amber-900/30 transition-all"
            >
              {/* Session Header */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                      <span className="text-lg">💬</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-200">
                        Session {sessions.length - idx}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(session.startTime)} • {getDuration(session)} • {session.messages.length} messages
                      </div>
                    </div>
                  </div>
                  <div className="text-amber-500/50">
                    {expandedSession === session.id ? '▼' : '▶'}
                  </div>
                </div>

                {/* Summary */}
                {session.summary && (
                  <div className="text-xs text-gray-400 mt-2 ml-13">
                    {session.summary}
                  </div>
                )}
              </div>

              {/* Expanded Messages */}
              {expandedSession === session.id && (
                <div className="border-t border-gray-800/50 bg-black/20">
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {session.messages.map((msg, msgIdx) => (
                      <div 
                        key={msgIdx}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-amber-900/20 border border-amber-800/30' 
                            : 'bg-gray-800/40 border border-gray-700/30'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-400">
                              {msg.role === 'user' ? 'You' : 'Alfie'}
                            </span>
                            <span className="text-xs text-gray-600">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              msg.type === 'voice' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'
                            }`}>
                              {msg.type === 'voice' ? '🎤' : '💬'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-600">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-lg mb-2 text-gray-400">No conversations yet</p>
          <p className="text-sm text-gray-600">Start a conversation with Alfie in the Agent tab.</p>
          <p className="text-xs text-gray-700 mt-2">Your conversation history will appear here.</p>
        </div>
      )}
    </div>
  );
};

const LinearTab: React.FC<{ issues: LinearIssueData[]; connected?: boolean }> = ({ issues, connected }) => {
  // Filter out cancelled issues
  const activeIssues = issues.filter(issue => issue.statusType?.toLowerCase() !== 'canceled');

  const getPriorityLabel = (priority: number) => {
    const labels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
    return labels[priority] || 'Unknown';
  };

  const getPriorityColor = (priority: number) => {
    const colors: Record<number, string> = {
      1: 'text-red-400 bg-red-900/30 border-red-700/30',
      2: 'text-orange-400 bg-orange-900/30 border-orange-700/30',
      3: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/30',
      4: 'text-blue-400 bg-blue-900/30 border-blue-700/30',
    };
    return colors[priority] || 'text-gray-400 bg-gray-900/30 border-gray-700/30';
  };

  const getStatusColor = (statusType: string) => {
    const colors: Record<string, string> = {
      'backlog': 'text-gray-400',
      'unstarted': 'text-gray-400',
      'started': 'text-blue-400',
      'completed': 'text-green-400',
      'canceled': 'text-red-400',
    };
    return colors[statusType] || 'text-gray-400';
  };

  if (!connected) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-lg text-gray-400 mb-2">Linear Not Connected</p>
        <p className="text-sm text-gray-600">Unable to fetch Linear issues. Check your API key and backend connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-200">Active Issues</h2>
        <span className="text-xs font-mono text-gray-500">{activeIssues.length} active {activeIssues.length !== 1 ? 'issues' : 'issue'}</span>
      </div>

      {activeIssues.length > 0 ? (
        <div className="space-y-3">
          {activeIssues.map((issue) => (
            <div 
              key={issue.id}
              className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <span className={`text-xs font-mono px-2 py-1 rounded border ${getPriorityColor(issue.priority)}`}>
                    {getPriorityLabel(issue.priority)}
                  </span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-indigo-400">{issue.identifier}</span>
                    <span className={`text-xs ${getStatusColor(issue.statusType)}`}>• {issue.status}</span>
                  </div>
                  <h3 className="text-sm font-medium text-gray-200 mb-2">{issue.title}</h3>
                  {(issue.project || issue.dueDate) && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {issue.project && <span>📁 {issue.project}</span>}
                      {issue.dueDate && <span>📅 {new Date(issue.dueDate).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg mb-2">No issues found</p>
          <p className="text-sm">Your Linear issues will appear here.</p>
        </div>
      )}
    </div>
  );
};

const NotionTab: React.FC<{ pages: NotionPage[]; connected?: boolean }> = ({ pages, connected }) => {
  if (!connected) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📝</div>
        <p className="text-lg text-gray-400 mb-2">Notion Not Connected</p>
        <p className="text-sm text-gray-600">Unable to fetch Notion pages. Check your API key and backend connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-200">Recent Pages</h2>
        <span className="text-xs font-mono text-gray-500">{pages.length} pages</span>
      </div>
      
      {pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map((page) => (
            <div 
              key={page.id}
              className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">
                  {page.type === 'database' ? '🗃️' : '📄'}
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                    {page.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="capitalize">{page.type}</span>
                    <span>•</span>
                    <span>Edited {new Date(page.lastEdited).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg mb-2">No pages found</p>
          <p className="text-sm">Your recently edited Notion pages will appear here.</p>
        </div>
      )}
    </div>
  );
};

const NotesTab: React.FC<{ 
  notes: string; 
  setNotes: (notes: string) => void;
  onSave: () => void;
  saved: boolean;
}> = ({ notes, setNotes, onSave, saved }) => {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-200 mb-2">Notes to Alfie</h2>
        <p className="text-sm text-gray-500">
          Add context, priorities, or reminders that Alfie should know about. 
          This information will be included in every conversation.
        </p>
      </div>

      <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Example:
- Current sprint focus: Alfie Business Manager MVP
- Key deadline: Demo on Friday
- Important context: We're pivoting from X to Y
- Remind me to: Follow up on the Linear integration"
          className="w-full h-64 bg-black/30 border border-gray-700 rounded-lg p-4 text-gray-300 text-sm font-mono placeholder:text-gray-700 focus:outline-none focus:border-amber-500/50 resize-none"
        />
        
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-gray-600">
            {notes.length} characters • Alfie will see this in every conversation
          </span>
          <button
            onClick={onSave}
            className={`px-4 py-2 rounded font-mono text-sm transition-all ${
              saved 
                ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                : 'bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30'
            }`}
          >
            {saved ? '✓ SAVED' : 'SAVE NOTES'}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-900/10 border border-blue-800/30 rounded-lg">
        <h3 className="text-sm font-bold text-blue-300 mb-2">💡 Tips for effective notes:</h3>
        <ul className="text-xs text-blue-200/70 space-y-1">
          <li>• Be specific about current priorities and deadlines</li>
          <li>• Mention any context that isn't captured in your Pieces activity</li>
          <li>• Include names of key stakeholders or projects</li>
          <li>• Update regularly as your focus shifts</li>
        </ul>
      </div>
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ProjectCard: React.FC<{ project: ActiveProject; maxActivity: number }> = ({ project, maxActivity }) => {
  // Heatmap color based on activity count (0-100 scale)
  const getHeatmapColor = (count: number, max: number): string => {
    if (max === 0) return 'bg-gray-800/30 text-gray-400 border-gray-700/30';

    const intensity = count / max; // 0 to 1

    if (intensity >= 0.8) {
      return 'bg-red-900/30 text-red-400 border-red-700/30';
    } else if (intensity >= 0.6) {
      return 'bg-orange-900/30 text-orange-400 border-orange-700/30';
    } else if (intensity >= 0.4) {
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    } else if (intensity >= 0.2) {
      return 'bg-cyan-900/30 text-cyan-400 border-cyan-700/30';
    } else {
      return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    }
  };

  const heatmapColor = getHeatmapColor(project.activityCount, maxActivity);

  return (
    <div className={`border rounded-lg p-4 hover:border-opacity-100 transition-all ${heatmapColor}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-100 truncate">{project.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${heatmapColor.replace('bg-', 'text-').replace('border', '')}`}>
          {project.activityCount} hit{project.activityCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        <span className="text-gray-600">{project.app}</span>
        <span className="mx-2">•</span>
        <span>{project.lastAccessed}</span>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const colorClasses: Record<string, string> = {
    green: 'text-green-400 bg-green-900/20 border-green-800/30',
    amber: 'text-amber-400 bg-amber-900/20 border-amber-800/30',
    blue: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
    purple: 'text-purple-400 bg-purple-900/20 border-purple-800/30',
    indigo: 'text-indigo-400 bg-indigo-900/20 border-indigo-800/30',
    gray: 'text-gray-400 bg-gray-900/20 border-gray-800/30',
  };

  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
};

// ============================================================================
// UTILITIES
// ============================================================================

function formatSummaryContent(content: string): string {
  // Comprehensive cleanup of Pieces LTM response artifacts
  let cleaned = content;
  
  // Remove JSON objects that appear in the text (common Pieces artifact)
  cleaned = cleaned.replace(/\{"[^"]*":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"instructions:"[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"created":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"browser_url":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"range":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"schema":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"hints":[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^{}]*"pro_tips":[^}]*\}/g, '');
  
  // Remove array notation and nested JSON
  cleaned = cleaned.replace(/\[\{[^\]]*\}\]/g, '');
  cleaned = cleaned.replace(/\]\s*,\s*"[^"]*":\s*\[/g, '');
  
  // Remove any remaining JSON-like structures with multiple properties
  cleaned = cleaned.replace(/\{"[^"]*":"[^"]*"[^}]*\}/g, '');
  
  // Remove incomplete JSON fragments
  cleaned = cleaned.replace(/\}\s*\]\s*,?\s*"?[a-z_]*"?:?\s*\[?\s*\{?/gi, '');
  cleaned = cleaned.replace(/",?"?[a-z_]*"?:\s*"[^"]*$/gi, '');
  
  // Clean up markdown formatting
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold markers
  cleaned = cleaned.replace(/###\s*/g, ''); // Remove headers
  cleaned = cleaned.replace(/##\s*/g, ''); // Remove h2 headers
  
  // Clean up stray punctuation from JSON removal
  cleaned = cleaned.replace(/\}\s*\]/g, '');
  cleaned = cleaned.replace(/\[\s*\{/g, '');
  cleaned = cleaned.replace(/"\s*,\s*"/g, '');
  cleaned = cleaned.replace(/:\s*"/g, '');
  cleaned = cleaned.replace(/":\s*/g, '');
  cleaned = cleaned.replace(/^\s*[",\[\]{}]+\s*/gm, '');
  cleaned = cleaned.replace(/\s*[",\[\]{}]+\s*$/gm, '');
  
  // Remove isolated technical artifacts
  cleaned = cleaned.replace(/detected\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*activity\s*$/gm, '');
  cleaned = cleaned.replace(/Automated Summary:\s*/gi, '');
  
  // Normalize bullet points
  cleaned = cleaned.replace(/^\s*[-•*]\s*/gm, '• ');
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  
  // Trim each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  return cleaned.trim();
}

function getAppIcon(app: string): string {
  const appLower = app.toLowerCase();
  if (appLower.includes('cursor')) return '⌨️';
  if (appLower.includes('notion')) return '📝';
  if (appLower.includes('chrome') || appLower.includes('edge') || appLower.includes('firefox')) return '🌐';
  if (appLower.includes('comet')) return '☄️';
  if (appLower.includes('snipping')) return '📸';
  if (appLower.includes('terminal')) return '💻';
  return '📱';
}
