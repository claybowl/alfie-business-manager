
import React, { useState } from 'react';
import { Tabs } from './components/Tabs';
import { AgentView } from './components/AgentView';
import { ChatView } from './components/ChatView';
import { ContextView } from './components/ContextView';
import { ChatIcon, DocumentIcon, MicrophoneIcon } from './components/Icons';

type TabId = 'agent' | 'chat' | 'context';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('agent');

  const tabs = [
    { id: 'agent', label: 'Agent', icon: <MicrophoneIcon className="w-6 h-6" /> },
    { id: 'chat', label: 'Chat', icon: <ChatIcon className="w-6 h-6" /> },
    { id: 'context', label: 'Context', icon: <DocumentIcon className="w-6 h-6" /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'agent':
        return <AgentView />;
      case 'chat':
        return <ChatView />;
      case 'context':
        return <ContextView />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-black text-white w-screen h-screen overflow-hidden flex flex-col font-mono">
      <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
      
      <header className="relative w-full flex-shrink-0 border-b border-gray-800/50 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-amber-400/80 py-3">Alfie Solomons</h1>
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </header>
      
      <main className="flex-grow relative overflow-hidden">
        {renderContent()}
      </main>

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
