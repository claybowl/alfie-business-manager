
import React from 'react';

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <nav className="flex space-x-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-colors duration-200 ${
            activeTab === tab.id
              ? 'bg-amber-400/10 text-amber-400'
              : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
          }`}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};
