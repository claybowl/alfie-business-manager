import React, { useState, useEffect } from 'react';
import { checkMigrationStatus, performMigrationWithFeedback, formatMigrationResults, MigrationStatus, MigrationResult } from '../utils/workstreamMigration';
import { RefreshIcon } from './Icons';

export const WorkstreamMigrationPanel: React.FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  const [days, setDays] = useState(14);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const status = await checkMigrationStatus();
      setStatus(status);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    setMigrationLog([]);
    setMigrationResult(null);

    const result = await performMigrationWithFeedback(days, (message) => {
      setMigrationLog(prev => [...prev, message]);
    });

    setMigrationResult(result);
    setIsMigrating(false);

    // Reload status after migration
    await loadStatus();
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="bg-gray-900/50 border border-amber-900/30 rounded-lg p-6 text-center">
          <div className="animate-spin inline-block">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full"></div>
          </div>
          <p className="text-amber-300 mt-4 font-mono">Loading migration status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-4">
      <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-900/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-amber-300 mb-2">Workstream Data Migration</h2>
        <p className="text-gray-300 text-sm mb-4">
          Import your last 14 days of Pieces workstream data into the new clean summary format. This will parse historical activity into structured sections: Core Tasks, Key Discussions, Documents Reviewed, and Next Steps.
        </p>

        {/* Current Status */}
        <div className="bg-black/30 border border-gray-800 rounded p-4 mb-4 font-mono text-sm">
          <p className="text-gray-400 mb-2">Current Status:</p>
          {status ? (
            <>
              <p className="text-amber-300">
                {status.ready
                  ? `✓ ${status.totalSummaries} summaries stored`
                  : '○ No data migrated yet'}
              </p>
              {status.ready && (
                <>
                  <p className="text-gray-400 text-xs mt-1">Latest: {status.latestDate}</p>
                  <p className="text-gray-400 text-xs">Oldest: {status.oldestDate}</p>
                </>
              )}
            </>
          ) : (
            <p className="text-red-400">Unable to check status</p>
          )}
        </div>

        {/* Migration Log */}
        {migrationLog.length > 0 && (
          <div className="bg-black/50 border border-gray-700 rounded p-3 mb-4 max-h-32 overflow-y-auto">
            <p className="text-gray-400 text-xs font-bold mb-2">Migration Log:</p>
            <div className="space-y-1">
              {migrationLog.map((log, i) => (
                <p key={i} className="text-amber-300/80 text-xs font-mono">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Migration Result */}
        {migrationResult && (
          <div
            className={`border rounded p-4 mb-4 font-mono text-sm whitespace-pre-wrap ${
              migrationResult.success
                ? 'bg-green-900/20 border-green-700/50 text-green-300'
                : 'bg-red-900/20 border-red-700/50 text-red-300'
            }`}
          >
            {formatMigrationResults(migrationResult)}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3 items-center mb-4">
          <label className="text-gray-400 text-sm font-mono">Days to migrate:</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            disabled={isMigrating}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-gray-300 text-sm font-mono disabled:opacity-50"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={isMigrating}
            className="flex-1 px-4 py-2 bg-amber-500/30 hover:bg-amber-500/40 disabled:bg-amber-500/10 border border-amber-500 text-amber-300 font-bold rounded transition-colors disabled:opacity-50 cursor-disabled"
          >
            {isMigrating ? (
              <>
                <RefreshIcon width={16} height={16} className="inline animate-spin mr-2" />
                Migrating...
              </>
            ) : (
              '🚀 Start Migration'
            )}
          </button>

          <button
            onClick={loadStatus}
            disabled={isMigrating}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded transition-colors disabled:opacity-50"
            title="Refresh status"
          >
            <RefreshIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Information Card */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4">
        <h3 className="text-amber-300 font-bold text-sm mb-2">How Migration Works</h3>
        <ul className="text-gray-400 text-xs space-y-1 font-mono">
          <li>• Fetches last N days of Pieces workstream summaries via LTM API</li>
          <li>• Parses each summary into 4 clean sections</li>
          <li>• Auto-extracts tags and keywords for better organization</li>
          <li>• Saves to Supabase for permanent storage</li>
          <li>• Skips dates that already exist (safe to re-run)</li>
        </ul>
      </div>

      {/* Warning */}
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
        <p className="text-yellow-300 text-xs font-mono">
          ⚠️ Requires Pieces OS running with access to 14+ days of LTM history. Migration may take a few minutes depending on data volume.
        </p>
      </div>
    </div>
  );
};
