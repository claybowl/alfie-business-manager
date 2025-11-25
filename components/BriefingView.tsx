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

  const handleSaveNotes = () => {
    saveUserNotes(userNotes);
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

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', count: dossier?.activeProjects.length || 0 },
    { id: 'linear' as TabId, label: 'Linear', count: dossier?.linearIssues?.length || 0, icon: '📋' },
    { id: 'notion' as TabId, label: 'Notion', count: dossier?.notionPages?.length || 0, icon: '📝' },
    { id: 'timeline' as TabId, label: 'Timeline', count: dossier?.timeline.length || 0 },
    { id: 'events' as TabId, label: 'Activity', count: dossier?.events.length || 0 },
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
          {activeTab === 'events' && dossier && <EventsTab events={dossier.events} />}
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
              <ProjectCard key={i} project={project} />
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
      
      {/* Data Sources Status */}
      <section className="flex items-center gap-4 p-3 bg-gray-900/20 rounded-lg border border-gray-800/50">
        <span className="text-xs text-gray-500 font-mono">DATA SOURCES:</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono flex items-center gap-1 ${dossier.dataSources?.pieces ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dossier.dataSources?.pieces ? 'bg-green-400' : 'bg-red-400'}`}></span>
            Pieces
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
  return (
    <div className="space-y-4">
      {timeline.length > 0 ? (
        timeline.map((summary, i) => (
          <div key={summary.id} className="relative pl-8 pb-8 border-l-2 border-gray-800 last:pb-0">
            {/* Timeline dot */}
            <div className="absolute left-[-9px] top-0 w-4 h-4 bg-amber-500/20 border-2 border-amber-500 rounded-full"></div>
            
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-amber-500/30 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono text-amber-400 bg-amber-900/20 px-2 py-1 rounded">
                  {summary.readableTime}
                </span>
                <span className="text-xs text-gray-600 font-mono">{summary.timeRange}</span>
              </div>
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {formatSummaryContent(summary.content)}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg mb-2">No timeline data available</p>
          <p className="text-sm">Workstream summaries will appear here as you work.</p>
        </div>
      )}
    </div>
  );
};

const EventsTab: React.FC<{ events: WorkstreamEvent[] }> = ({ events }) => {
  return (
    <div className="space-y-2">
      {events.length > 0 ? (
        events.map((event, i) => (
          <div 
            key={event.id} 
            className="bg-gray-900/30 border border-gray-800/50 rounded p-3 hover:border-gray-700 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-gray-800 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500 font-mono">{getAppIcon(event.app)}</span>
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">{event.app.replace('.exe', '')}</span>
                  <span className="text-xs text-gray-700">•</span>
                  <span className="text-xs text-gray-600">{event.readableTime}</span>
                </div>
                <p className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
                  {event.windowTitle}
                </p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {event.summary}
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs font-mono text-gray-700">
                  {(event.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12 text-gray-600">
          <p className="text-lg mb-2">No activity events available</p>
          <p className="text-sm">Your recent app usage will appear here.</p>
        </div>
      )}
    </div>
  );
};

const LinearTab: React.FC<{ issues: LinearIssueData[]; connected?: boolean }> = ({ issues, connected }) => {
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
        <span className="text-xs font-mono text-gray-500">{issues.length} issues</span>
      </div>
      
      {issues.length > 0 ? (
        <div className="space-y-3">
          {issues.map((issue) => (
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

const ProjectCard: React.FC<{ project: ActiveProject }> = ({ project }) => {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-green-500/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200 truncate">{project.name}</h3>
        <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-mono">
          {project.activityCount}
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
  // Clean up markdown-like formatting for display
  return content
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markers
    .replace(/###\s*/g, '') // Remove headers
    .replace(/\n{3,}/g, '\n\n') // Reduce excessive newlines
    .trim();
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
