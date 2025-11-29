import React, { useState, useEffect } from 'react';
import {
  generateIntelligenceDossier,
  saveUserNotes,
  IntelligenceDossier,
  WorkstreamSummary,
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

  // Check for errors in dossier
  useEffect(() => {
    if (dossier?.errors && dossier.errors.length > 0) {
      console.error('Briefing errors:', dossier.errors);
    }
  }, [dossier]);

  const handleSaveNotes = () => {
    saveUserNotes(userNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (isLoading && !dossier) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-950 to-black">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 border-2 border-amber-500/30 rounded-full animate-ping"></div>
          <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-pulse"></div>
          <div className="absolute inset-4 bg-amber-500/20 rounded-full"></div>
          <div className="absolute inset-4 bg-amber-400 rounded-full"></div>
        </div>
        <p className="text-amber-300/80 font-mono text-sm tracking-wider">COMPILING INTELLIGENCE...</p>
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
    { id: 'notes' as TabId, label: 'Notes', count: userNotes.length > 0 ? 1 : 0, icon: '📝' }
  ];

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-gradient-to-b from-gray-950 to-black">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-900/30 bg-black/50 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-amber-300 tracking-tight">Intelligence Dossier</h1>
              <p className="text-xs text-gray-500 font-mono mt-1">
                DONJON INTELLIGENCE SYSTEMS • {dossier?.systemStatus || 'Initializing...'}
              </p>
              {dossier?.errors && dossier.errors.length > 0 && (
                <p className="text-xs text-red-400 font-mono mt-1">
                  ⚠️ {dossier.errors[0]?.source}: {dossier.errors[0]?.error}
                </p>
              )}
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
                    ? 'text-amber-300 bg-amber-900/10'
                    : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                    activeTab === tab.id
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-gray-800 text-gray-500'
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
          {dossier ? (
            <>
              {activeTab === 'overview' && <OverviewTab dossier={dossier} />}
              {activeTab === 'linear' && <LinearTab issues={dossier.linearIssues || []} connected={dossier.dataSources?.linear} />}
              {activeTab === 'notion' && <NotionTab pages={dossier.notionPages || []} connected={dossier.dataSources?.notion} />}
              {activeTab === 'timeline' && <TimelineTab timeline={dossier.timeline} showAll={true} />}
              {activeTab === 'events' && <ConversationsTab />}
              {activeTab === 'notes' && (
                <NotesTab
                  notes={userNotes}
                  setNotes={setUserNotes}
                  onSave={handleSaveNotes}
                  saved={notesSaved}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 border-2 border-amber-500/30 rounded-full animate-ping"></div>
                <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-pulse"></div>
                <div className="absolute inset-4 bg-amber-500/20 rounded-full"></div>
                <div className="absolute inset-4 bg-amber-400 rounded-full"></div>
              </div>
              <p className="text-amber-300/80 font-mono text-sm tracking-wider">COMPILING INTELLIGENCE...</p>
              <h2 className="text-xl text-white/80 mb-2">Failed to Load Intelligence Dossier</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                {dossier?.errors && dossier.errors.length > 0
                  ? `Error: ${dossier.errors[0]?.error}`
                  : 'Unable to connect to intelligence systems. Please check if backend server is running on port 8001.'
                }
              </p>
            </div>
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
            <p className="text-gray-500">No active projects detected.</p>
          )}
        </div>
      </section>
    </div>
  );
};

const LinearTab: React.FC<{ issues: LinearIssueData[]; connected?: boolean }> = ({ issues, connected }) => {
  return (
    <>
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Linear Issues ({connected ? 'Connected' : 'Offline'})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connected ? (
            issues.map((issue, i) => (
              <div key={i} className="border border-gray-800/50 rounded-lg p-4 hover:border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-gray-500 font-mono">
                    <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">ID: {issue.identifier}</span>
                    <span className="ml-2 text-green-600">Status: {issue.status}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{issue.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{issue.project}</p>
                    {issue.dueDate && (
                      <p className="text-xs text-gray-500">
                        <span className="text-amber-400">Due:</span> {new Date(issue.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
            ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-6 opacity-20">📋</div>
              <p className="text-gray-500">
                {connected ? 'Linear integration available' : 'Linear not connected'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const NotionTab: React.FC<{ pages: NotionPage[]; connected?: boolean }> = ({ pages, connected }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Notion Pages ({connected ? 'Connected' : 'Offline'})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connected && pages.length > 0 ? (
            pages.map((page, i) => (
              <div key={i} className="border border-gray-800/50 rounded-lg p-4 hover:border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-gray-500 font-mono">
                    <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">ID: {page.id}</span>
                    <span className="ml-2 text-green-600">Type: {page.type}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{page.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {page.type === 'database' && page.title.includes('Projects') && (
                        <><span className="text-amber-600">📊</span> {page.title} database</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))
            ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-6 opacity-20">📝</div>
              <p className="text-gray-500">
                {connected ? 'Notion integration available' : 'Notion not connected'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Timeline component to be added
const TimelineTab: React.FC<{ timeline: WorkstreamSummary[]; showAll?: boolean }> = ({ timeline, showAll = false }) => {
  console.log('TimelineTab received:', { timelineLength: timeline.length, showAll });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Timeline
      </h2>
      <div className="space-y-4">
        {timeline.map((summary, i) => (
          <div key={i} className="border border-gray-800/50 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs text-gray-500 font-mono">
                <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  {summary.timeRange}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{summary.readableTime}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConversationsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-200 mb-4">Recent Conversations</h2>
      <div className="text-gray-500">
        <div className="text-center py-8">
          <div className="text-6xl mb-6 opacity-20">💬</div>
          <p>Conversation history will appear here after your first conversation.</p>
        </div>
      </div>
    </div>
  );
};

const NotesTab: React.FC<{ notes: string; setNotes: (notes: string) => void; onSave: () => void; saved: boolean }> = ({ notes, setNotes, onSave, saved }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-200 mb-4">Notes to Alfie</h2>
      <div className="space-y-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-32 p-3 bg-black/30 border border-gray-700/50 rounded text-white text-sm font-mono focus:border-amber-500/50 focus:outline-none resize-none"
          placeholder="Add notes for Alfie to remember..."
          rows={6}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={onSave}
            disabled={saved}
            className="px-4 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded border border-amber-600/30 transition-all disabled:opacity-50 text-sm font-mono"
          >
            {saved ? 'Saved' : 'Save Notes'}
          </button>
          {saved && (
            <span className="ml-2 text-green-600">✓</span>
          )}
        </div>
      </div>
    </div>
  );
};

const ProjectCard: React.FC<{ project: ActiveProject }> = ({ project }) => {
  return (
    <div className="border border-gray-800/50 rounded-lg p-4 hover:border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs text-gray-500 font-mono">
          <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
            {project.name}
          </span>
          <span className="ml-2 text-green-600">{project.app}</span>
        </div>
        <div>
          <p className="text-sm text-gray-400">{project.lastAccessed}</p>
          <p className="text-xs text-amber-400">{project.activityCount} activities</p>
        </div>
      </div>
    </div>
  );
};

export default BriefingView;