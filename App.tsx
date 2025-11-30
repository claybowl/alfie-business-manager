
import React, { useState } from 'react';
import { Tabs } from './components/Tabs';
import { AgentView } from './components/AgentView';
import { ChatView } from './components/ChatView';
import { BriefingView } from './components/BriefingView';
import { ContextView } from './components/ContextView';
import { SettingsView } from './components/SettingsView';
import { MeditationView } from './components/MeditationView';
import { ChatIcon, KnowledgeGraphIcon, MicrophoneIcon, SettingsIcon, DocumentIcon, HaloIcon } from './components/Icons';

type TabId = 'agent' | 'chat' | 'briefing' | 'context' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('agent');
  const [showMeditation, setShowMeditation] = useState(false);

  const tabs = [
    { id: 'agent', label: 'Agent', icon: <MicrophoneIcon className="w-6 h-6" /> },
    { id: 'chat', label: 'Chat', icon: <ChatIcon className="w-6 h-6" /> },
    { id: 'briefing', label: 'Briefing', icon: <DocumentIcon className="w-6 h-6" /> },
    { id: 'context', label: 'Knowledge Graph', icon: <KnowledgeGraphIcon className="w-6 h-6" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-6 h-6" /> },
  ];

  const contentMap: Record<TabId, React.ReactNode> = {
    agent: <AgentView />,
    chat: <ChatView />,
    briefing: <BriefingView />,
    context: <ContextView />,
    settings: <SettingsView />,
  };

  return (
    <div className="bg-black text-white w-screen h-screen overflow-hidden flex flex-col font-mono">
      <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
      
      <header className="relative w-full flex-shrink-0 border-b border-gray-800/50 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 py-3">
              <div className="flex flex-col leading-tight">
                <h1 className="text-2xl font-bold text-amber-300">Alfie</h1>
                <p className="text-xs text-white/80 tracking-wide uppercase">Business Manager</p>
              </div>
              <p className="text-gray-400 italic text-sm hidden md:block">"Intelligence is a very valuable thing, innit, my friend?"</p>
            </div>
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab as (id: string) => void} />
        </div>
      </header>
      
      <main className="flex-grow relative overflow-hidden">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="w-full h-full"
            style={{ display: activeTab === tab.id ? 'block' : 'none' }}
          >
            {contentMap[tab.id as TabId]}
          </div>
        ))}
      </main>

      {/* Inconspicuous Prayer Room Button - bottom right corner */}
      <button
        onClick={() => setShowMeditation(true)}
        className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-slate-900/60 border border-amber-500/20 text-amber-300/40 hover:text-amber-300 hover:border-amber-400/50 hover:bg-slate-800/80 transition-all duration-500 flex items-center justify-center z-20 group"
        title="Sanctuary"
        aria-label="Open meditation sanctuary"
      >
        <HaloIcon className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-all duration-500" />
      </button>

      {/* Meditation View Overlay */}
      {showMeditation && (
        <MeditationView onClose={() => setShowMeditation(false)} />
      )}

      <style>{`
        .bg-grid-white\\[\\[0\\.05\\]] {
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};

export default App;