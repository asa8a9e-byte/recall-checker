'use client';

import { Search, ClipboardList, Bell } from 'lucide-react';

export type TabId = 'check' | 'inventory' | 'alerts';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'check', label: 'Check', icon: <Search className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  unreadAlertCount: number;
}

export default function TabNav({ activeTab, onTabChange, unreadAlertCount }: TabNavProps) {
  return (
    <div className="bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <nav className="flex gap-1 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'alerts' && unreadAlertCount > 0 && (
                <span className="ml-1 w-5 h-5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadAlertCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
