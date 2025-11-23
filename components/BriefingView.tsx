import React, { useState, useEffect } from 'react';
import { getBriefing, BusinessBriefing } from '../utils/briefing';
import { RefreshIcon } from './Icons';

export const BriefingView: React.FC = () => {
  const [briefing, setBriefing] = useState<BusinessBriefing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadBriefing = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const data = await getBriefing(forceRefresh);
      setBriefing(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load briefing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBriefing();
  }, []);

  if (isLoading && !briefing) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <div className="w-12 h-12 border-4 border-amber-300 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">Analyzing business context...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 sticky top-0 bg-black/80 backdrop-blur z-10 pb-4">
          <h2 className="text-3xl font-bold text-amber-300">Donjon Systems Briefing</h2>
          <button
            onClick={() => loadBriefing(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded border border-amber-600/50 transition-all disabled:opacity-50"
          >
            <RefreshIcon className="w-4 h-4" />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary */}
        {briefing && (
          <div className="space-y-6">
            {/* Overview Section */}
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-100 mb-4">Current Status</h3>
              <div className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {briefing.summary}
              </div>
              {lastUpdated && (
                <div className="text-xs text-gray-500 mt-4">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Priorities Section */}
            <div className="bg-gradient-to-b from-orange-900/20 to-transparent border border-orange-600/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-orange-300 mb-6">[PRIORITY] Top 3 Priorities</h3>
              <div className="space-y-4">
                {briefing.priorities.length > 0 ? (
                  briefing.priorities.map((priority, index) => (
                    <div
                      key={index}
                      className="bg-gray-900/50 border border-orange-600/20 rounded p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-orange-600/30 rounded-full flex items-center justify-center text-orange-300 font-bold">
                          {index + 1}
                        </span>
                        <div className="flex-grow">
                          <p className="text-orange-200 font-semibold mb-2">{priority.issue}</p>
                          <p className="text-gray-400 text-sm mb-2">
                            <span className="text-gray-500">Why:</span> {priority.reason}
                          </p>
                          <p className="text-orange-300/70 text-sm border-l-2 border-orange-600/50 pl-3">
                            {priority.impact}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 italic">No priorities identified at this time</div>
                )}
              </div>
            </div>

            {/* Opportunity Section */}
            <div className="bg-gradient-to-b from-green-900/20 to-transparent border border-green-600/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-green-300 mb-4">[OPPORTUNITY] Key Opportunity</h3>
              <div className="bg-gray-900/50 border border-green-600/20 rounded p-4">
                <h4 className="text-green-200 font-semibold mb-2">{briefing.opportunity.title}</h4>
                <p className="text-gray-400 text-sm mb-3">{briefing.opportunity.description}</p>
                <div className="bg-green-900/20 border-l-2 border-green-600/50 pl-3 py-2">
                  <p className="text-green-300 text-sm font-semibold">
                    Potential Impact: {briefing.opportunity.potentialImpact}
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Section */}
            <div className="bg-gradient-to-b from-red-900/20 to-transparent border border-red-600/30 rounded-lg p-6">
              <h3 className="text-xl font-bold text-red-300 mb-4">[RISK] Critical Risk</h3>
              <div className="bg-gray-900/50 border border-red-600/20 rounded p-4">
                <h4 className="text-red-200 font-semibold mb-2">{briefing.risk.title}</h4>
                <p className="text-gray-400 text-sm mb-3">{briefing.risk.description}</p>
                <div className="bg-red-900/20 border-l-2 border-red-600/50 pl-3 py-2">
                  <p className="text-red-300 text-sm font-semibold">
                    Mitigation: {briefing.risk.mitigation}
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-6 text-center">
              <p className="text-amber-300 font-semibold mb-3">
                Ready to dive deeper? Ask Alfie about any of these priorities or opportunities.
              </p>
              <p className="text-gray-400 text-sm">
                Switch to the Chat tab to discuss strategy with your business advisor.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
