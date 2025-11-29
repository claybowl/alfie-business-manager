import React, { useState, useEffect } from 'react';
import { RefreshIcon } from './Icons';
import { fetchRecentWorkstreamSummaries, fetchTodaySummary, updateWorkstreamSummary, WorkstreamSummaryStructured } from '../utils/workstreamSummaries';

type ViewMode = 'compact' | 'expanded';
type SortBy = 'date' | 'modified';

export const WorkstreamSummariesPanel: React.FC = () => {
  const [summaries, setSummaries] = useState<WorkstreamSummaryStructured[]>([]);
  const [todaysSummary, setTodaysSummary] = useState<WorkstreamSummaryStructured | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    setIsLoading(true);
    try {
      const [recent, today] = await Promise.all([
        fetchRecentWorkstreamSummaries(14),
        fetchTodaySummary()
      ]);
      setSummaries(recent);
      setTodaysSummary(today);
    } catch (error) {
      console.error('Failed to load summaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadSummaries();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const toggleLocked = async (summary: WorkstreamSummaryStructured) => {
    if (!summary.id) return;

    const newLocked = new Set(lockedIds);
    const isCurrentlyLocked = newLocked.has(summary.id);

    try {
      await updateWorkstreamSummary(summary.id, { is_locked: !isCurrentlyLocked });

      if (!isCurrentlyLocked) {
        newLocked.add(summary.id);
      } else {
        newLocked.delete(summary.id);
      }
      setLockedIds(newLocked);
    } catch (error) {
      console.error('Failed to update lock status:', error);
    }
  };

  const sortedSummaries = [...summaries].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.summary_date).getTime() - new Date(a.summary_date).getTime();
    }
    return 0;
  });

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-950 to-black">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-amber-500/30 rounded-full animate-ping"></div>
            <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full"></div>
          </div>
          <p className="text-amber-300/80 font-mono text-sm">Loading summaries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-gradient-to-b from-gray-950 to-black">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-900/30 bg-black/50 backdrop-blur-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-amber-300">Workstream Summaries</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
            title="Refresh summaries"
          >
            <RefreshIcon width={20} height={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                viewMode === 'compact'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500'
                  : 'bg-gray-800/30 text-gray-300 border border-gray-700 hover:border-amber-500/50'
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setViewMode('expanded')}
              className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                viewMode === 'expanded'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500'
                  : 'bg-gray-800/30 text-gray-300 border border-gray-700 hover:border-amber-500/50'
              }`}
            >
              Expanded
            </button>
          </div>

          <div className="flex gap-2">
            <label className="text-gray-400 text-sm font-mono">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-gray-800/30 border border-gray-700 rounded text-gray-300 text-sm px-2 py-1 hover:border-amber-500/50"
            >
              <option value="date">By Date</option>
              <option value="modified">By Modified</option>
            </select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {todaysSummary && (
          <div className="p-4 border-b border-amber-900/30 bg-amber-900/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-amber-300 font-bold">Today's Workstream</h3>
                <p className="text-gray-400 text-xs font-mono">{todaysSummary.summary_date}</p>
              </div>
              <span className="text-amber-400 text-xs font-bold">CURRENT</span>
            </div>
            <SummaryContent summary={todaysSummary} expanded={true} viewMode={viewMode} />
          </div>
        )}

        {sortedSummaries.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-mono">
            No workstream summaries available. Start capturing work activity to see summaries here.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sortedSummaries.map((summary) => {
              const isExpanded = expandedIds.has(summary.id || '');
              const isLocked = lockedIds.has(summary.id || '');

              return (
                <div
                  key={summary.id}
                  className="p-4 hover:bg-gray-900/30 transition-colors border-l-2 border-l-gray-800 hover:border-l-amber-500/50"
                >
                  <div className="flex items-start justify-between mb-3 cursor-pointer" onClick={() => toggleExpanded(summary.id || '')}>
                    <div className="flex-1">
                      <h4 className="text-amber-300 font-bold capitalize">{summary.day_label}</h4>
                      <p className="text-gray-400 text-sm font-mono">{summary.summary_date}</p>
                    </div>
                    <div className="flex gap-2">
                      {isLocked && <span className="text-amber-400 text-xs font-bold">🔒</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLocked(summary);
                        }}
                        className="p-1 hover:bg-amber-900/20 rounded transition-colors"
                        title={isLocked ? 'Unlock' : 'Lock from auto-overwrite'}
                      >
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                      <span className="text-gray-500 text-xl">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {(isExpanded || viewMode === 'expanded') && (
                    <SummaryContent summary={summary} expanded={true} viewMode={viewMode} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface SummaryContentProps {
  summary: WorkstreamSummaryStructured;
  expanded: boolean;
  viewMode: ViewMode;
}

const SummaryContent: React.FC<SummaryContentProps> = ({ summary, expanded, viewMode }) => {
  const shouldShow = expanded || viewMode === 'expanded';

  return (
    <div className="space-y-3">
      {summary.core_tasks && (
        <div>
          <h5 className="text-amber-200 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            Core Tasks & Projects
          </h5>
          <div className="text-gray-300 text-sm bg-gray-900/30 p-2 rounded border border-gray-800/50 max-h-32 overflow-y-auto">
            <p className="whitespace-pre-wrap font-mono text-xs">{summary.core_tasks}</p>
          </div>
        </div>
      )}

      {summary.key_discussions && (
        <div>
          <h5 className="text-amber-200 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            Key Discussions & Decisions
          </h5>
          <div className="text-gray-300 text-sm bg-gray-900/30 p-2 rounded border border-gray-800/50 max-h-32 overflow-y-auto">
            <p className="whitespace-pre-wrap font-mono text-xs">{summary.key_discussions}</p>
          </div>
        </div>
      )}

      {summary.documents_reviewed && (
        <div>
          <h5 className="text-amber-200 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            Documents & Code Reviewed
          </h5>
          <div className="text-gray-300 text-sm bg-gray-900/30 p-2 rounded border border-gray-800/50 max-h-32 overflow-y-auto">
            <p className="whitespace-pre-wrap font-mono text-xs">{summary.documents_reviewed}</p>
          </div>
        </div>
      )}

      {summary.next_steps && (
        <div>
          <h5 className="text-amber-200 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            Next Steps
          </h5>
          <div className="text-gray-300 text-sm bg-gray-900/30 p-2 rounded border border-gray-800/50 max-h-32 overflow-y-auto">
            <p className="whitespace-pre-wrap font-mono text-xs">{summary.next_steps}</p>
          </div>
        </div>
      )}

      {summary.tags && summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
